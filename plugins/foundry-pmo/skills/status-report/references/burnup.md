# Burn-up charts

## Why burn-up and not burn-down

A burn-down plots remaining work against time. When scope is added at the same rate work is
completed, the line falls at a normal-looking angle and the chart reports health while the
project drifts. The information that would have explained the eventual slip — that scope grew
27% — is not in the chart at all.

A burn-up plots two lines: **total scope** and **work completed**. The gap between them is the
remaining work, and the slope of the scope line is the scope growth. Both facts are visible at a
glance, and the scope line is the one that usually explains the outcome.

## Choosing the unit

| Unit | Pros | Cons | Verdict |
|---|---|---|---|
| Acceptance criteria met | Resists scope inflation and estimate drift; directly ties to `requirement.v1` | Requires criteria to exist — which the DoR mandates anyway | **Preferred** |
| Issues closed | Trivial to measure from `gh` | Issue size varies wildly; splitting an item inflates progress | Acceptable if item sizes are enforced by the size ceiling |
| Story points | Familiar to many teams | Inflate over time; not comparable across teams or quarters | Use only if already established |
| Hours | Feels precise | Measures effort spent, not value delivered; the least informative option | Avoid |

Pick one and keep it **forever**. Changing the unit resets the history and destroys every
forecast that depended on it. If a change is unavoidable, publish both units in parallel for at
least four periods.

## Building it from repository data

```bash
M="M2 — Merchants can take card payments"

# completed per week (closed issues in the milestone)
gh issue list --milestone "$M" --state closed --limit 500 --json closedAt \
| jq -r '.[].closedAt[0:10]' \
| while read -r d; do date -u -d "$d" +%G-W%V; done | sort | uniq -c

# scope per week requires history: when each issue entered the milestone.
# The issue timeline carries milestoned/demilestoned events.
gh api "repos/{owner}/{repo}/issues/318/timeline" \
  --jq '.[] | select(.event=="milestoned" or .event=="demilestoned")
        | {event, milestone: .milestone.title, at: .created_at}'
```

The scope line is the expensive part: GitHub does not store a milestone's size over time, so it
must be reconstructed from timeline events or recorded at each report. Recording it at each
report is far cheaper and entirely sufficient — keep a small table in the repository:

```markdown
<!-- docs/status/burnup-M2.md -->
| week | scope | done | note |
|---|---|---|---|
| 2026-W27 | 41 | 6 | baseline |
| 2026-W31 | 44 | 24 | +3: refund edge cases (#402-#404) |
| 2026-W34 | 52 | 33 | +8: 3-D Secure step-up (#420-#427) |
```

The `note` column is what makes scope growth explainable rather than merely visible. Without it,
the conversation becomes "why did it grow?" and nobody remembers.

## Reading it

| Pattern | Meaning | Action |
|---|---|---|
| Scope flat, done rising steadily | Healthy | forecast is reliable |
| Scope rising as fast as done | The milestone is a treadmill; it will never converge | stop adding, or split the milestone |
| Done flat for two periods | Work in progress is not finishing | check WIP limits and work-item age; the problem is flow, not effort |
| Done rising, scope rising faster | Discovery is outpacing delivery | the requirements were not stable enough to plan against; pause and re-groom |
| Both lines jump at the end | Status-driven completion — everything marked done at the deadline | check whether the DoD was applied; usually it was not |
| Scope drops | Descoping happened | good, if it was deliberate and recorded; alarming if nobody knows who did it |

## Scope changes mid-flight

Never adjust the baseline silently. When scope changes:

1. Add a point to the scope line at the date of the change.
2. Annotate it with the issue numbers and one reason.
3. Report cumulative growth against the **original** baseline every time, not against the most
   recent figure. Growth measured against a moving baseline is always small, which is precisely
   why it must not be measured that way.
4. When cumulative growth crosses the re-planning trigger threshold (default 10%), say so and
   hand to the `roadmap` skill in revise mode.

## Percent complete

Only ever as a fraction with its denominator:

```
33/52 criteria (63%)   scope 41 → 52 since baseline (+27%)
```

Never "we're about 80% done". The number without the denominator is unfalsifiable, and it is the
most common inaccuracy in project reporting because it can be asserted at any time without
evidence and cannot be checked.

## Rate and its range

Report the completion rate as an observed range, not a mean:

```
rate over 7 weeks: 2, 5, 7, 4, 6, 3, 3   →  mean 4.3/wk, range 2–7/wk
```

The range is the input to the forecast. Publishing only the mean produces a single-date forecast,
which is the thing this whole practice exists to avoid. Fewer than four data points means the
range is not yet meaningful — say so and label the forecast indicative.

## Multiple milestones

One chart per milestone, plus one for the release if several milestones share a date. Do not
aggregate milestones with different units or different owners into a single line: the composite
hides exactly the divergence that a reader needs to see, and it can only be reconstructed by
someone who has the underlying data — which the reader does not.
