# Jira Cloud API — the parts that bite

## Two APIs, one product

| Path | Covers |
|---|---|
| `/rest/api/3/` | issues, fields, projects, workflows, permissions, search |
| `/rest/agile/1.0/` | boards, sprints, backlog, epics as a board concept |

Sprints exist **only** in the Agile API. Looking for them under `/rest/api/3/` returns 404 and is
the most common first-hour mistake.

## Auth

HTTP Basic, email plus an API token created from the Atlassian account page. Never a password.

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/3/myself"
```

The token carries the full permissions of that user. There is no scoping mechanism for a personal
token, so a migration or bulk operation run with an admin's token can do anything that admin can.
Use the least-privileged account that works, and say which account performed a change.

## Project style decides what is possible

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/3/project/$KEY"
```

`style` is `classic` (company-managed) or `next-gen` (team-managed).

| | company-managed | team-managed |
|---|---|---|
| Schemes | shared objects across projects | project-local |
| Workflow editing | scheme APIs apply | largely UI-only |
| Field configuration | shared, high blast radius | project-local |
| Who administers | Jira admin | project admin |

**The shared-scheme trap:** in a company-managed project, editing a workflow or field
configuration can change six other projects. Always check what references a scheme before
editing; if it is shared, create a project-scoped copy instead, and say which projects were
spared.

## Status categories

Every status belongs to exactly one category:

| `statusCategory.key` | Meaning |
|---|---|
| `new` | not started |
| `indeterminate` | in flight |
| `done` | closed |

Reports read the category, not the name. A status named "Blocked" placed in the `done` category
makes blocked work count as delivered, and nothing in the UI warns about it. **Verify the category
of every status after creating it.**

## Resolutions

`done` category plus a resolution. The resolution is what separates delivered from abandoned —
Done vs Won't Do vs Duplicate. Keep the set tiny and make "not delivered" unambiguous, because
every throughput number downstream depends on it.

## Custom fields

Per-instance ids. `customfield_10016` is story points on one instance and something unrelated on
the next, and the API returns a value either way — so the failure is silent.

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/3/field"
```

Resolve `Story Points` (company-managed) or `Story point estimate` (team-managed) and `Sprint` by
name, at runtime, every run. Cache within a run, never across runs.

## Search and pagination

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -G "$JIRA_BASE_URL/rest/api/3/search" \
  --data-urlencode "jql=project = $KEY ORDER BY created ASC" \
  --data-urlencode "startAt=0" --data-urlencode "maxResults=100"
```

Always `ORDER BY` a stable field. Without it, a paginated read over changing data returns
duplicates and skips items — quietly, and the counts look plausible.

`maxResults` is capped server-side, often below what is requested. Read the value Jira returns
rather than the one that was sent.

## Errors

Jira returns structured errors with `errorMessages[]` and `errors{}`. A 200 can still carry a
partial failure on bulk endpoints, so parse the body rather than trusting the status code.

| Status | Usual cause |
|---|---|
| 400 | malformed JQL, or a field id that does not exist on this instance |
| 401 | bad token, or email not matching the token owner |
| 403 | authenticated but lacking the project permission |
| 404 | wrong API base path, or no permission to even see the resource |
| 429 | rate limited — honour `Retry-After` |

403 and 404 are frequently interchangeable here: Jira hides resources the caller cannot see.
Report both as "not visible to this account" rather than asserting the resource does not exist.

## Irreversibility

Deleting a status, field, scheme or sprint in Jira is rarely recoverable, and deletion can cascade
into historical issues that referenced it. Deprecate and hide instead. Bulk transitions rewrite
issue history and destroy the changelog that cycle time is computed from — never use one to "fix"
a report.
