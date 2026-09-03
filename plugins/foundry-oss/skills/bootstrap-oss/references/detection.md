# Detection command set

Every value in a generated file traces to one row here. A value with no row is a question for
the maintainer, never a guess.

## Identity

| Token | Command | If it fails |
|---|---|---|
| `{{REPO}}` | `git remote get-url origin \| sed -E 's#.*[:/]([^/]+/[^/]+?)(\.git)?$#\1#'` | ask |
| `{{PROJECT}}` | manifest `name` field, else repo name | ask |
| `{{DEFAULT_BRANCH}}` | `git symbolic-ref --short HEAD`, or `gh api repos/{owner}/{repo} --jq .default_branch` | `main` only if the branch exists locally |
| `{{LICENSE}}` | `head -3 LICENSE`, `gh api repos/{owner}/{repo} --jq .license.spdx_id`, or `grep -m1 SPDX-License-Identifier` | report "no licence file" as a **blocking** finding |
| `{{DOCS_URL}}` | `gh api repos/{owner}/{repo} --jq .homepage`, README badge links | ask |

## Size and people

```bash
git shortlog -sne --since='12 months ago' --no-merges           # contributors + emails
git shortlog -sn  --since='12 months ago' --no-merges | head    # concentration
git log --since='12 months ago' --format='%ae' | sed 's/.*@//' | sort | uniq -c | sort -rn
gh api repos/{owner}/{repo}/collaborators --paginate --jq '[.[]|select(.permissions.push)|.login]'
git log -1 --format=%cs                                          # last activity
```

`{{MAINTAINER_COUNT}}` = push-access count (gh) or count of authors with > 10% of commits
(git fallback — label it approximate).

## Language and workflow

Detect by manifest presence, then **read the declared scripts**:

```bash
jq -r '.scripts // {} | to_entries[] | "\(.key)\t\(.value)"' package.json
ls pnpm-lock.yaml yarn.lock package-lock.json bun.lockb 2>/dev/null   # picks the install cmd
grep -nE '^\[tool\.(pytest|ruff|mypy)' pyproject.toml
grep -nE '^\s*(test|lint|build|check):' Makefile Taskfile.yml justfile 2>/dev/null
ls .github/workflows/*.y*ml && grep -hE '^\s{0,6}(name|run):' .github/workflows/*.y*ml | head -40
```

`{{VERSION_CMD}}` per ecosystem: `npm ls {{PROJECT}}`, `pip show {{PROJECT}}`,
`{{PROJECT}} --version`, `go list -m`, `cargo pkgid`. Verify it prints something before
putting it in an issue form.

`{{SETUP_MINUTES}}`: time the clean-clone run once; do not estimate.

## Community signals

```bash
gh api repos/{owner}/{repo} --jq '{has_discussions,has_issues,visibility,archived}'
gh label list --limit 200 --json name,description
gh issue list --state open --limit 200 --json number,createdAt,comments,labels
gh pr   list --state all  --limit 100 --json number,createdAt,reviews,author,mergedAt
gh api repos/{owner}/{repo}/community/profile --jq '.files | keys'
```

`{{RESPONSE_ISSUE_H}}` = median hours from `createdAt` to the first comment whose author is not
the issue author, over the last 50 closed+open issues. Round **up** to 24/48/72/168.
`{{RESPONSE_PR_D}}` = same, on first review event, in days. Sample < 10 ⇒ report
`insufficient data` and ask the maintainer for a number they can keep.

## Security posture

```bash
gh api repos/{owner}/{repo}/private-vulnerability-reporting --jq .enabled
ls .github/dependabot.yml .github/workflows/codeql*.yml 2>/dev/null
git tag --sort=-creatordate | head -5        # feeds the supported-versions table
```

`{{SUPPORTED_VERSIONS}}` is proposed from the tag list as markdown rows, then **confirmed by a
maintainer** — a support commitment cannot be inferred from tags.

## Never inferred

Security contact address · CoC contacts · funding accounts · CLA decision · credential holders ·
succession · commercial support · legal statements. All of these are asked, once, in one batch.
