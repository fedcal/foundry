# State mapping — defaults and overrides

Mapping a provider's states onto `tracker-item.v1.state` is a **decision**, not a fact. It is
written down so it can be reviewed, and it is versioned with the project.

## Where it lives

`.foundry/tracker.json` at the project root:

```json
{
  "provider": "jira",
  "project": "PROJ",
  "stateMap": {
    "Selected for Development": "ready",
    "In Progress": "in-progress",
    "Peer Review": "in-review",
    "Waiting on vendor": "blocked",
    "Done": "done",
    "Won't Do": "cancelled",
    "Duplicate": "cancelled"
  },
  "typeMap": {
    "Story": "story",
    "Task": "task",
    "Bug": "bug",
    "Investigation": "spike"
  },
  "cancelledLabels": ["wontfix", "duplicate", "invalid"]
}
```

An entry here overrides the default. Anything absent falls through to the defaults below, and
anything the defaults cannot place becomes `unmapped`.

## Defaults

| `state` | GitHub | Jira category | Linear `state.type` | GitLab |
|---|---|---|---|---|
| `triage` | open, no status label | `new` | `triage`, `backlog` | opened, no board list |
| `ready` | `status:ready` | `new` + "Selected…" | `unstarted` | `workflow::ready` |
| `in-progress` | `status:in-progress` | `indeterminate` | `started` | `workflow::in-progress` |
| `in-review` | linked open PR, or `status:in-review` | `indeterminate` + review status | `started` + review state | open MR |
| `blocked` | `status:blocked` | `indeterminate` + blocked status | `started` + blocked label | `workflow::blocked` |
| `done` | closed, `stateReason: completed` | `done` + delivered resolution | `completed` | closed with merged MR |
| `cancelled` | closed, `stateReason: not_planned` | `done` + Won't Do / Duplicate | `canceled` | closed, no merge |

## The two rules that matter

**Map on the stable key, not the display name.**

- Jira: `statusCategory.key` (`new` / `indeterminate` / `done`).
- Linear: `state.type`.
- GitHub: `state` + `stateReason`.

Display names get renamed by whoever administers the project, and a mapping built on them breaks
silently — the sync still succeeds, the numbers just become wrong.

**`done` and `cancelled` never merge.** Both are "closed" to the provider. Only one is delivery.
Merging them inflates throughput, and every forecast built on that throughput is optimistic in a
way nobody can see from the output.

The awkward case: Jira's `done` category contains both. The resolution field decides, and the set
of resolutions meaning "not delivered" is instance-specific — which is exactly why it belongs in
`.foundry/tracker.json` rather than in code.

## `in-review` is the state most often missing

Many boards have no review column; the work sits in "In Progress" until merged. That is a legal
configuration, but it means cycle time cannot be broken down, and the most common real constraint
— review latency — becomes invisible.

When `in-review` is absent, say so in the sync summary. It is the difference between "we do not
know where time goes" and "we know, and it is here".

## Verifying a mapping

After changing `.foundry/tracker.json`, pull ten items and check:

1. `unmapped` count is zero, or every unmapped item is genuinely unmappable and named.
2. No item is `done` without a completion timestamp.
3. Items the team considers abandoned come back as `cancelled`, not `done`.
4. At least one item exercises each mapped state — an unexercised mapping is untested.

A mapping that looks right in a table and fails this check is the normal outcome of a first
attempt. Run the check before any forecast is computed on the data.
