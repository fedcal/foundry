# gh recipes

Every command here is read-first or idempotent. Substitute `{owner}` and `{repo}` — `gh api`
expands them automatically from the current repository, so they can usually be left literal.

## Detection and degradation

```bash
gh --version                     # exit 127 → not installed
gh auth status                   # exit 1  → not authenticated
gh auth status 2>&1 | grep -i 'token scopes'
gh auth refresh -s project       # add a scope without a full re-login
gh api rate_limit --jq '.resources.core | {remaining, reset}'
gh api user --jq .login
```

Never proceed past a failed preflight by guessing. Emit the commands for the user to run, and
set `handoff.v1.status` to `blocked` with the reason.

## Issues

```bash
# read the whole backlog once, work from the file
gh issue list --state open --limit 500 \
  --json number,title,body,labels,assignees,milestone,createdAt,updatedAt \
  > .foundry/scratch/backlog.json

# search before creating — always --state all, a closed issue may explain why not to build it
gh issue list --state all --search "expired card checkout in:title" --json number,title,state

gh issue create --title "..." --body-file .foundry/scratch/issue.md \
  --label "type:feat" --label "prio:must" --milestone "M2" --assignee @me

gh issue edit 318 --add-label "status:ready" --remove-label "needs:criteria" --milestone "M2"
gh issue comment 318 --body "Blocked by #305"
gh issue close 318 --reason "not planned" --comment "Duplicate of #204; repro copied across."
gh issue reopen 318
gh issue transfer 318 <owner>/<other-repo>
```

`--body-file` avoids shell quoting problems and keeps multi-line acceptance criteria readable.
GitHub has no hard dependency edge between issues: use `Blocked by #N` plus the `blocked` label
consistently, so it stays queryable.

## Bulk label operations

```bash
# every open issue with no prio: label
gh issue list --state open --limit 500 --json number,labels \
| jq -r '.[] | select([.labels[].name] | map(startswith("prio:")) | any | not) | .number'

# apply one label to a list of numbers, one call each (there is no bulk endpoint)
for n in 301 305 318; do gh issue edit "$n" --add-label "needs:criteria"; done
```

Rate limits: the REST API allows 5000 requests/hour for an authenticated user. A loop over 500
issues making three calls each will exhaust a meaningful share of it — batch reads with `--json`
and only loop over writes.

## Pull requests

```bash
gh pr list --state open --json number,title,isDraft,createdAt,author,reviewDecision
gh pr list --state merged --limit 200 --json number,createdAt,mergedAt,labels
gh pr view 412 --json statusCheckRollup --jq '.statusCheckRollup[] | {name, conclusion}'
gh pr checks 412
gh pr create --fill --base main --head feature/x --draft
gh pr ready 412
```

Cycle time in days from the merged list:

```bash
gh pr list --state merged --limit 200 --json createdAt,mergedAt \
| jq -r '.[] | ((.mergedAt|fromdate) - (.createdAt|fromdate)) / 86400 | floor' \
| sort -n | awk '{a[NR]=$1} END {printf "n=%d p50=%d p85=%d\n", NR, a[int(NR*0.5)], a[int(NR*0.85)]}'
```

## Milestones (API only)

```bash
gh api repos/{owner}/{repo}/milestones --paginate --jq '.[] | {number,title,state,open_issues,closed_issues,due_on}'
gh api repos/{owner}/{repo}/milestones -X POST -f title='M3' -f description='...' -f due_on='2026-12-31T23:59:59Z'
gh api repos/{owner}/{repo}/milestones/3 -X PATCH -f state='closed'
```

`due_on` must be RFC 3339. GitHub stores it at UTC midnight of the given day regardless of the
time you send, so do not rely on the time component.

## Projects v2

```bash
gh project list --owner <owner> --format json
gh project view <number> --owner <owner> --format json
gh project field-list <number> --owner <owner> --format json
gh project item-list <number> --owner <owner> --format json --limit 500
gh project item-add <number> --owner <owner> --url <issue-url>
gh project item-edit --id <item-id> --project-id <project-id> \
  --field-id <field-id> --single-select-option-id <option-id>
```

Ids are opaque and repository-specific. Resolve them at runtime:

```bash
PROJECT_ID=$(gh project view 7 --owner myorg --format json --jq '.id')
FIELD_ID=$(gh project field-list 7 --owner myorg --format json \
  --jq '.fields[] | select(.name=="Status") | .id')
OPTION_ID=$(gh project field-list 7 --owner myorg --format json \
  --jq '.fields[] | select(.name=="Status") | .options[] | select(.name=="Ready") | .id')
```

Projects v2 is GraphQL-backed; anything `gh project` does not cover is available through
`gh api graphql -f query='...'`. Board automation rules are configured in the Project's own
Workflows UI and are not scriptable — document them as manual steps rather than reporting them
as applied.

## Releases

```bash
gh release list --limit 20 --json tagName,publishedAt,isDraft,isPrerelease
git tag --list 'v1.4.0'                       # never move an existing tag
gh release create v1.4.0 --title "v1.4.0" --generate-notes --draft
gh release edit v1.4.0 --draft=false
gh release view v1.4.0 --json url,tagName,isDraft
```

Always `--draft` first; publish after a human reads the notes. `--generate-notes` uses
`.github/release.yml` categories, so the label taxonomy is what makes the notes readable.
A pre-release (`--prerelease`) must not close a milestone.

## Workflows and runs

```bash
gh workflow list
gh run list --limit 100 --json workflowName,conclusion,createdAt,headBranch
gh run list --workflow ci.yml --status failure --limit 20 --json databaseId,displayTitle
gh run view <id> --log-failed
```

Build-health signal for a status report or a risk detection threshold:

```bash
gh run list --workflow ci.yml --limit 50 --json conclusion \
| jq -r 'group_by(.conclusion)[] | "\(.[0].conclusion): \(length)"'
```

## Repository metadata

```bash
gh repo view --json nameWithOwner,defaultBranchRef,visibility,isArchived,isFork,licenseInfo
gh api repos/{owner}/{repo} --jq '{permissions, allow_squash_merge, allow_merge_commit,
  allow_rebase_merge, delete_branch_on_merge, has_issues, has_projects}'

# sensible defaults, idempotent
gh api repos/{owner}/{repo} -X PATCH \
  -F delete_branch_on_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false
```

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `gh: command not found` | not installed | emit commands as a block; mark blocked |
| `HTTP 401` | token expired/revoked | `gh auth login` |
| `HTTP 403 Resource not accessible` | missing scope or permission | name the exact scope; `gh auth refresh -s <scope>` |
| `HTTP 404` on a repo you can see in a browser | SSO not authorised for the token | authorise the org for the token |
| `HTTP 422 already_exists` | idempotency path | switch to the update call |
| `HTTP 429` / secondary rate limit | too many writes in a loop | back off; batch reads; write serially |
| `gh project` says unknown command | old `gh` version | report the installed version and the minimum needed |
| Empty JSON where data was expected | wrong `--jq` path or a filter matched nothing | print the raw JSON before filtering; never treat empty as zero without checking |

**Never** interpret an error as "the resource does not exist" without confirming with a read.
Reporting a label as missing when the token simply could not see it produces confidently wrong
governance changes.
