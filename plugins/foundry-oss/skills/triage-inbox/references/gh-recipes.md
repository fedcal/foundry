# gh recipes for triage

All commands assume `gh auth status` succeeds. Guard every block:

```bash
if ! command -v gh >/dev/null || ! gh auth status >/dev/null 2>&1; then
  echo 'DEGRADED: gh unavailable — producing an action list only'; GH=0; else GH=1; fi
```

## Queues

```bash
# Unlabelled backlog, oldest first
gh issue list --state open --search 'no:label sort:created-asc' --limit 100 \
  --json number,title,createdAt

# Awaiting the reporter, past the window
gh issue list --state open --label 'status:needs-info' \
  --search 'updated:<2026-08-13' --json number,title,updatedAt

# PRs where the project spoke last (review debt) — needs a second pass per PR
gh pr list --state open --json number,title,updatedAt,author \
  --jq '.[] | [.number,.author.login,.updatedAt] | @tsv'
gh pr view 688 --json comments,reviews \
  --jq '[.comments[],.reviews[]] | sort_by(.createdAt) | last | .author.login'

# First-time contributors still waiting
gh pr list --state open --json number,author,createdAt,reviews \
  --jq '.[] | select(.reviews|length==0) | [.number,.author.login,.createdAt] | @tsv'

# Suspected security content in the public tracker
gh issue list --state open --limit 200 --json number,title,body \
  --jq '.[] | select(.title + .body | test("vulnerab|exploit|CVE-|RCE|traversal|injection";"i")) | .number'
```

## Duplicate search

```bash
gh search issues --repo owner/repo 'exact error fragment' --state all --limit 20 \
  --json number,title,state,url
gh search issues --repo owner/repo 'in:title keyword' --state all --limit 20
gh issue view 45 --json title,body,comments --jq '.body'   # compare root causes, not symptoms
```

## Mutations (all reversible)

```bash
gh issue edit 123 --add-label 'type:bug,priority:p2' --remove-label 'status:needs-triage'
gh issue comment 123 --body-file comments/123.md
gh issue close 123 --reason 'not planned' --comment-file comments/123.md
gh issue reopen 123
gh issue edit 123 --milestone 'v2.1' --add-assignee '@me'
gh label create 'type:regression' --color 'B60205' --description 'Worked in a previous release'
```

`--body-file` over `--body` always: the text is reviewable, diffable and editable before it is
sent to a human being.

## Metrics

```bash
# Time to first non-author comment, per issue (hours)
gh issue list --state all --limit 100 --json number,createdAt,author,comments \
  --jq '.[] | . as $i | (.comments | map(select(.author.login != $i.author.login)) | first) as $c
        | select($c != null)
        | [$i.number, (( ($c.createdAt|fromdateiso8601) - ($i.createdAt|fromdateiso8601) ) / 3600 | floor)]
        | @tsv'
```

Feed the medians to `community-manager`. Report the sample size; a median over fewer than 10
items is `insufficient data`.

## Rate limits and batching

```bash
gh api rate_limit --jq '.resources.core, .resources.search'
```

Search is limited far more tightly than core. Fetch the list **once** into
`.foundry/scratch/<session>/`, then work offline from the JSON; re-query only for duplicate
searches, and batch those. On `403`/secondary-limit, stop and report — do not retry in a loop.

## Never generate

`gh issue delete` · `gh api -X DELETE .../comments/*` · `gh api -X PUT .../blocks/*` ·
branch deletion · `gh repo edit` · anything touching branch protection or required checks.
Recommend them in prose; a human executes.
