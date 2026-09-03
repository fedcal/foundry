# Workflow design — statuses that survive reporting

A Jira workflow is a state machine that every report reads through. Most workflow pain is not the
transitions; it is statuses placed in the wrong category, and columns that aggregate states.

## Target shape

Six statuses. Each maps to exactly one `tracker-item.v1.state` and sits in the correct category.

| Status | Category | Normalised | Exists to answer |
|---|---|---|---|
| To Do | `new` | `triage` | is this even accepted? |
| Selected for Development | `new` | `ready` | is it pullable now? |
| In Progress | `indeterminate` | `in-progress` | is someone working on it? |
| In Review | `indeterminate` | `in-review` | is it waiting on another person? |
| Blocked | `indeterminate` | `blocked` | is it waiting on something outside the team? |
| Done | `done` | `done` | delivered |

Plus the Won't Do **resolution** on the Done status, normalising to `cancelled`.

## Why six

Each status must answer a question somebody asks. A status nobody queries is a click everyone
pays for and nobody reads.

Fewer than five and cycle time cannot be broken down, so the constraint stays invisible. More
than about seven and the transition matrix stops being maintained: teams start skipping states,
which makes the history — and therefore cycle time — wrong rather than merely coarse.

## The two verifications

**Category, not name.** After creating each status:

```bash
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/3/status" 
```

Confirm `statusCategory.key`. A "Blocked" status in the `done` category reports blocked work as
delivered, and the UI gives no warning. This is the single highest-value check in this document.

**Board columns one-to-one with statuses.** A column aggregating "In Progress" and "In Review"
makes per-state cycle time uncomputable, which removes the ability to answer the most common
question: is the delay in the work or in the waiting?

## Blocked: status or flag?

Both are defensible; pick one and record it.

- **As a status:** visible on the board, easy to count, but the item leaves its real state, so
  "how long was it actually in progress" becomes harder.
- **As a flag or label on the existing status:** preserves the underlying state, needs the
  normaliser to read it, and is easier to forget to remove.

Whichever is chosen, `flow.blockedDays` must be derivable, or flow efficiency is unavailable and
"we are waiting on other people" stays an opinion.

## Transitions

Keep them permissive. Restrictive transition rules are usually an attempt to enforce process
through tooling, and the observed result is that people move items to whichever state the tool
allows rather than the one that is true. Wrong data is a higher price than an out-of-order
transition.

Two restrictions that do earn their cost:

- **Require a resolution when entering Done.** Otherwise `done` and `cancelled` cannot be
  separated, and throughput inflates.
- **Require an assignee when entering In Progress.** Otherwise ageing WIP has no owner to ask.

## What not to do

- **Do not add a status per team.** Statuses are shared vocabulary; team-specific ones make
  cross-team reporting impossible and are never removed.
- **Do not add "Ready for QA", "Ready for Deploy", "Ready for…"** as separate statuses. They are
  queues. If they matter, they are `in-review`-class waiting states, and adding three of them
  buries the signal in ceremony.
- **Do not delete a status** to tidy up. Deprecate and hide; deletion cascades into historical
  issues.
- **Do not bulk-transition** issues to make a report look right. It rewrites the changelog that
  cycle time is computed from, permanently.

## Verifying the design end to end

Configuration that looks correct in the UI can still normalise wrong. After building the
workflow, pull ten issues through `sync-tracker` and confirm:

1. `unmapped` count is zero.
2. Each of the six states appears at least once.
3. A Won't Do item comes back `cancelled`, not `done`.
4. Cycle time is computable — `flow.historyRead` is true and the transitions are present.

Only then is the workflow finished.
