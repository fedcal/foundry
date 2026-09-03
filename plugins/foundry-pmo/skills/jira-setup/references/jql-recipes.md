# JQL recipes — queries a team actually opens

Saved filters earn their place by being opened. Each of these answers a question somebody asks
out loud during a working week.

## Flow health

**Ageing work in progress** — the most useful query on any board. Items in flight and untouched.

```
project = KEY AND statusCategory = "In Progress" AND updated <= -5d ORDER BY updated ASC
```

**Blocked and going stale** — blocked is tolerable; blocked and unattended is not.

```
project = KEY AND status = Blocked AND updated <= -3d ORDER BY updated ASC
```

**Ready queue depth** — is there pullable work, or will the team idle?

```
project = KEY AND status = "Selected for Development" AND assignee IS EMPTY
```

**In flight per person** — WIP, not performance. Read it to spot someone carrying four items.

```
project = KEY AND statusCategory = "In Progress" AND assignee IS NOT EMPTY ORDER BY assignee
```

## Readiness

**Missing acceptance criteria** — cannot be estimated, will expand mid-Sprint.

```
project = KEY AND issuetype = Story AND description IS EMPTY AND statusCategory != Done
```

**Oversized items** — anything above the team's split threshold.

```
project = KEY AND "Story Points" >= 8 AND statusCategory != Done
```

**Unestimated in the current sprint**

```
project = KEY AND sprint IN openSprints() AND "Story Points" IS EMPTY
```

## Sprint

**Current sprint, not done**

```
project = KEY AND sprint IN openSprints() AND statusCategory != Done ORDER BY status
```

**Added after the sprint started** — scope creep, measured rather than asserted.

```
project = KEY AND sprint IN openSprints() AND created >= startOfDay(-14d)
```

**Carried over** — items that have seen more than one sprint.

```
project = KEY AND sprint IN openSprints() AND sprint IN closedSprints()
```

That last one is the honest carry-over query: an item belonging to both an open and a closed
sprint has rolled at least once.

## Closure hygiene

**Cancelled work, still visible** — so abandonment stays a decision, not a disappearance.

```
project = KEY AND resolution = "Won't Do" AND resolved >= -30d
```

**Closed without a resolution** — breaks `done` vs `cancelled` and inflates throughput.

```
project = KEY AND statusCategory = Done AND resolution IS EMPTY
```

Run the second one after any workflow change. A non-zero count means the Done transition does not
require a resolution, and every throughput number is suspect until it is fixed.

## Stale backlog

```
project = KEY AND statusCategory = "To Do" AND created <= -180d ORDER BY created ASC
```

Six months untouched is a decision nobody made. Close them explicitly or accept the backlog stops
describing reality.

## Functions worth knowing

| Function | Use |
|---|---|
| `openSprints()` | every non-closed sprint on the board |
| `closedSprints()` | combine with `openSprints()` to find carry-over |
| `startOfDay(-14d)`, `endOfWeek()` | relative dates that stay correct in a saved filter |
| `membersOf("group")` | team-scoped filters that survive people joining and leaving |
| `linkedIssues("KEY-1")` | dependency inspection |
| `issueHistory()` | items the current user touched recently |

## Rules

- **Never hardcode a person** into a saved filter. Use `membersOf` or `currentUser()`; a filter
  naming someone who left is a filter nobody fixes.
- **Always add `ORDER BY`.** Unordered results paginate inconsistently and read differently each
  time.
- **A filter with no owner gets deleted.** Shared filters accumulate faster than anything else in
  Jira, and an unowned one is opened by no one and trusted by someone.
- **Prefer `statusCategory` to `status`** in saved filters. Category survives the workflow
  renames that break every name-based filter at once.
