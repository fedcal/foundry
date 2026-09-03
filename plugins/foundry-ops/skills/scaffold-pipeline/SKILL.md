---
name: scaffold-pipeline
description: Generate a complete, hardened GitHub Actions pipeline for the project type detected in the repository (Node/Angular, Java with Maven or Gradle, containerised service) with build, test, quality gate, security scan, SBOM, release and environment-gated deploy. Use when a repository has no CI, when CI covers only tests, or when an existing pipeline needs OIDC, SHA-pinned actions and least-privilege permissions.
user-invocable: true
argument-hint: "[--type node|angular|maven|gradle|container] [--deploy k8s|paas|none] [--dry-run]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: operations
  foundry.io: "repository -> .github/workflows/*.yml + plan.v1"
license: Apache-2.0
---

# Scaffold pipeline

Produces workflows a team can make required checks on day one. Everything it writes is pinned,
least-privilege, and keyless where the provider supports it.

**Use it when** a repository has no CI, has CI that only runs tests, or has CI that authenticates
to a cloud with a long-lived key.

**Do not use it when** the CI system is not GitHub Actions (the principles port, the YAML does
not — say so and stop), or when the request is really about slow or flaky tests, which belongs to
`foundry-quality`.

## Step 1 — Detect, do not assume

Run the detection block and record the answers. If `--type` was given, still run it and report
any disagreement rather than silently trusting the flag.

```bash
ls -1 package.json angular.json nx.json pom.xml build.gradle build.gradle.kts \
      Dockerfile Containerfile go.mod pyproject.toml 2>/dev/null
test -f package.json && node -e "const p=require('./package.json');console.log('scripts:',Object.keys(p.scripts||{}).join(','))"
ls -1 package-lock.json pnpm-lock.yaml yarn.lock 2>/dev/null   # decides the install command
ls -1 .github/workflows/ 2>/dev/null
git remote -v | head -1
```

| Signal | Type | Reference workflow |
|---|---|---|
| `angular.json` | Angular | `references/node-angular.yml` |
| `package.json`, no `angular.json` | Node | `references/node-angular.yml` (drop the Angular-only steps) |
| `pom.xml` | Maven | `references/java-maven.yml` |
| `build.gradle[.kts]` | Gradle | `references/java-gradle.yml` |
| `Dockerfile` present with any of the above | also containerised | add `references/container-service.yml` |
| More than one of the above in subdirectories | monorepo | stop; ask which package, or scope with `paths:` filters |

Also record: default branch (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`),
whether a container registry is in use, and the deploy target.

## Step 2 — Resolve every pin

**Never write a SHA or a version from memory.** The reference workflows contain
`<OWNER>/<REPO>@<SHA> # <TAG>` placeholders. Resolve each one now:

```bash
# for each action referenced in the chosen template
gh api repos/<OWNER>/<REPO>/commits/<TAG> --jq '.sha'
```

Also resolve, and write down where they came from:

- runtime versions — read them from the repository, not from habit:
  `jq -r '.engines.node // .volta.node' package.json`, `.nvmrc`,
  `mvn help:evaluate -Dexpression=maven.compiler.release -q -DforceStdout`,
  `grep -r 'JavaLanguageVersion\|sourceCompatibility' build.gradle*`
- base image digests, if the container workflow is included — see the `containerise` skill.

If a value cannot be resolved, leave the placeholder in place, add a `# TODO(resolve):` comment
with the exact command, and list it in the summary. **A placeholder left visible is acceptable;
a fabricated value is not.**

## Step 3 — Write the workflows

Copy from `references/`, adapting only what detection told you. Standard layout:

```
.github/
  workflows/
    ci.yml            # PR + push: build, test, quality gate, scan
    release.yml       # tag push: build once, SBOM, provenance, publish
    deploy.yml        # workflow_call / workflow_dispatch: environment-gated deploy
    _build.yml        # reusable: the single build definition both ci and release call
  dependabot.yml      # github-actions ecosystem, weekly
```

Non-negotiables in everything you write — see `references/pinning-and-oidc.md` for the detail:

1. Top-level `permissions: { contents: read }`, elevated per job only where needed.
2. Every third-party action pinned to a 40-character SHA with the tag in a comment.
3. `concurrency` group per workflow: `cancel-in-progress: true` on validation,
   **`false` on anything that deploys**.
4. Cloud authentication via OIDC (`permissions: id-token: write`); zero long-lived keys.
5. Untrusted context values (`github.event.*.title`, `.body`, branch names) passed through `env:`
   before use in `run:`, never interpolated directly.
6. `timeout-minutes` on every job — the default is 6 hours of billed runner time.
7. Deploy jobs carry `environment: <name>` so approvals and environment secrets apply.
8. Artefacts flow by **digest**, from one build, to every downstream job.

## Step 4 — The five gates

The pipeline is not scaffolded until all five exist and can fail.

| Gate | What runs | Fails when |
|---|---|---|
| Build | compile / bundle, once | non-zero exit |
| Test | unit + integration | any failure; coverage below the project threshold |
| Quality | lint, format check, type check, static analysis | any error-level finding |
| Security | dependency audit, secret scan, container scan if applicable | any **fixable** HIGH/CRITICAL |
| Supply chain | SBOM produced, provenance attested, both verified | artefact published without either |

Thresholds come from the repository if it has them (`jest.config`, `jacoco` rules,
`sonar-project.properties`); if it does not, propose a number, say it is a proposal, and put it
in one place the team can change.

**Gate on fixable findings only.** A gate that fires on an unfixable CVE gets bypassed, and a
bypassed gate protects nothing. Record suppressions with an owner and an expiry date.

## Step 5 — Deploy job (only if `--deploy` is not `none`)

- `environment: <name>` with required reviewers configured on the GitHub environment — that is
  where the approval lives, not in an `if:` condition.
- Concurrency: `group: deploy-<env>`, `cancel-in-progress: false`. Cancelling a deploy mid-apply
  is how you get a half-migrated database.
- The job consumes `needs.build.outputs.digest`. It never rebuilds.
- It verifies provenance before applying:
  `gh attestation verify oci://<REGISTRY>/<IMAGE>@sha256:<DIGEST> --repo <OWNER>/<REPO>`.
- It ends with a smoke check and a **stated rollback command** printed into the job summary.

## Step 6 — Make the checks required

A check protects nothing until the ruleset requires it.

```bash
gh api repos/<OWNER>/<REPO>/rulesets --jq '.[] | "\(.id) \(.name)"'
gh api repos/<OWNER>/<REPO>/branches/<BRANCH>/protection --jq '.required_status_checks.contexts'
```

Require the **aggregation** job (`ci-complete`), not each matrix leg. Matrix leg names are
generated and change when the matrix changes; the aggregation job's name is stable.

Watch the skip trap: a skipped job reports success to branch protection. If you added
`paths:` filters or a `paths-filter` job, the "nothing to do" path must emit an explicit success,
or the gate is bypassable by touching only excluded files.

## Step 7 — Prove it

```bash
git switch -c chore/ci-scaffold && git add .github && git commit -m "ci: scaffold pipeline"
git push -u origin HEAD
gh run watch --exit-status
# durations, for the before/after claim
gh run list --limit 20 --json workflowName,conclusion,createdAt,updatedAt
```

If `superpowers` is installed, invoke `superpowers:verification-before-completion` before
reporting done. If it is not, paste the run URL and the two duration numbers.

Then emit `plan.v1` to `.foundry/blackboard/<wave>/pipeline-engineer.json` via `blackboard_write`:
one wave per stage, `gate` holding the required check name and threshold, `rollback` set to the
revert procedure below.

## Rollback

The pipeline is production for the development team.

1. `git revert <SHA>` on the default branch — one minute, and the primary path.
2. If a renamed required check now blocks every merge, remove that check from the ruleset first,
   then revert, then restore it. Log the temporary removal.
3. If a deploy job already ran, the pipeline revert does not undo it — use the deployment
   target's rollback (`deploy-strategy` skill, `kubernetes-engineer`).
4. If a secret was printed or an action was compromised, **rotate first, revert second**.

## References

- `references/node-angular.yml` — Node/Angular CI with cache, matrix and coverage.
- `references/java-maven.yml` — Maven CI with dependency cache and JaCoCo gate.
- `references/java-gradle.yml` — Gradle CI with the build cache and configuration cache notes.
- `references/container-service.yml` — build, scan, SBOM, provenance, push by digest.
- `references/reusable-deploy.yml` — `workflow_call` deploy with environment gate and rollback.
- `references/pinning-and-oidc.md` — resolving SHAs, OIDC trust policies per cloud, permission
  matrix, script-injection safe patterns.

## Deliberately not covered

- CI systems other than GitHub Actions.
- Self-hosted runner provisioning and hardening.
- Writing or repairing the tests, or choosing coverage thresholds for a team that has none.
- Monorepo release orchestration across many packages — `release` skill and `release-engineer`.
- The Dockerfile itself — `containerise` skill.

## Exit criteria

- [ ] Every workflow file parses (`gh workflow list` shows them; a `yq . <file>` round-trip works).
- [ ] All five gates exist and each has been observed to fail on a deliberately broken commit.
- [ ] `grep -rn 'uses:' .github/workflows | grep -v '@[0-9a-f]\{40\}'` returns nothing except
      documented first-party exceptions.
- [ ] Zero long-lived cloud credentials in repository or environment secrets.
- [ ] Every job has `timeout-minutes`; every workflow has a top-level `permissions:` block.
- [ ] Deploy jobs: `environment:` set, `cancel-in-progress: false`, digest consumed from `needs`.
- [ ] p50 time to all required checks **< 10 min** over at least five runs, recorded.
- [ ] Cache hit observed in the log on the second run.
- [ ] SBOM and provenance published and verified from a clean shell.
- [ ] Required checks configured, verified through `gh api`, and the skip trap tested.
- [ ] Every unresolved placeholder is listed in the summary with the command that resolves it.
