# Provider APIs — auth, pagination, history

Exact mechanics per provider. Everything here assumes credentials come from the environment and
are never printed or written to an artifact.

## GitHub

Auth: `gh auth status`. Scopes: `repo` for private, `read:project` for Projects v2.

```bash
gh issue list --state all --limit 500 \
  --json number,title,body,state,stateReason,labels,assignees,milestone,createdAt,updatedAt,closedAt,url
```

`stateReason` is the field that separates `done` from `cancelled`: `completed` vs `not_planned`.
Without it, closed issues are indistinguishable and throughput is inflated.

History is per-issue and therefore expensive — one call each:

```bash
gh api "repos/{owner}/{repo}/issues/{number}/timeline" --paginate
```

Look for `labeled` / `unlabeled` events carrying `status:*`, and `closed`. Respect `--since` and
cache; on a 500-issue board this is 500 calls and will hit the rate limit.

Rate limit: 5000 requests/hour authenticated. Check with `gh api rate_limit`.

## Jira Cloud

Auth: HTTP Basic with email and API token. REST v3 for issues, Agile 1.0 for boards and sprints —
two different base paths, a routine source of 404s.

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -G "$JIRA_BASE_URL/rest/api/3/search" \
  --data-urlencode "jql=project = $KEY AND updated >= -90d ORDER BY created ASC" \
  --data-urlencode "expand=changelog" \
  --data-urlencode "maxResults=100" \
  --data-urlencode "startAt=0"
```

Paginate on `startAt` until `startAt + maxResults >= total`. **Order by a stable field** — an
unordered paginated query can return duplicates and skip items when the data changes mid-read.

History comes from `changelog.histories[]`, filtered to `items[].field == "status"`. Note that
`expand=changelog` truncates on very long histories; the per-issue
`/rest/api/3/issue/{key}/changelog` endpoint paginates properly when that happens.

Custom fields are per-instance. Resolve by name:

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/3/field"
```

## Linear

Auth: `Authorization: <LINEAR_API_KEY>` — note there is no `Bearer` prefix for personal API keys.
GraphQL only, at `https://api.linear.app/graphql`.

```graphql
query($after: String) {
  issues(first: 100, after: $after, filter: { updatedAt: { gt: "2026-06-01" } }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      identifier title url createdAt updatedAt completedAt canceledAt
      state { name type }
      estimate
      cycle { id name startsAt endsAt }
      history(first: 50) { nodes { createdAt fromState { name } toState { name } } }
    }
  }
}
```

`state.type` (`triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`) is the stable
mapping key — the analogue of Jira's status category. Map on it, never on `state.name`.

## GitLab

Auth: `glab auth status`, or a token in `PRIVATE-TOKEN`.

```bash
glab api "projects/:id/issues?updated_after=$SINCE&per_page=100&page=1"
```

Paginate on the `X-Next-Page` response header rather than incrementing blindly.

History needs two endpoints, and both are required for a correct cycle time:

```bash
glab api "projects/:id/issues/:iid/resource_state_events"
glab api "projects/:id/issues/:iid/resource_label_events"
```

Closed-without-merge is the `cancelled` signal, and GitLab does not model it explicitly — the
convention has to come from a label, which must be recorded in `.foundry/tracker.json`.

## Common failure modes

| Symptom | Cause |
|---|---|
| item count differs between runs | unordered pagination |
| impossibly short cycle times | took the latest transition into in-progress instead of the earliest |
| throughput too high | `cancelled` counted as `done` |
| every `estimate` empty on Jira | hardcoded custom field id from another instance |
| 200 response, nothing happened | Slack-style `ok: false` body; not applicable here, but Jira returns 200 with an `errorMessages` array on some endpoints — parse the body |
| sudden 429s | per-issue history calls on a large board with no cache |
