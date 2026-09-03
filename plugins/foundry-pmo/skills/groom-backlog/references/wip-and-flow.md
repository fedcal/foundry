# WIP limits and flow metrics

## Why WIP limits, not effort management

Little's Law, applied to a delivery queue:

```
cycle_time = work_in_progress / throughput
```

Throughput is hard to raise. WIP is a number you can simply choose. Halving WIP halves cycle
time immediately, without anyone working faster. This is the only intervention in project
management with that property, and it is the one most often skipped because it feels like doing
less.

## Default limits

| Column / state | Limit | Reason |
|---|---|---|
| In progress | `1.5 × developers`, floor 1 | one blocked item per person, no more |
| In review | `0.5 × developers`, floor 1 | review is a shared bottleneck; a full review column means stop coding and review |
| Ready (groomed) | `2 × iteration throughput` | more ready items than that go stale before they are pulled |
| Blocked | 2, hard | the third blocked item triggers escalation, not another pull |

Tune from observation, not from comfort: if the in-progress column is never full, the limit is
too loose to do anything; if it is permanently full and cycle time is rising, it is too loose in
a worse way.

## The rule when a limit is breached

**Stop starting, start finishing.** In practice, in order:

1. Can anyone help finish the oldest item in the breached column? Do that.
2. If the blocker is external, escalate it now with a name and a date — do not start something
   else and wait.
3. Only if neither is possible, and only with an explicit recorded decision, raise the limit.

Raising a limit is a decision that gets written down as a `fact.v1` of type `decision`, with the
reason and a review date. Limits that drift upward silently are limits that no longer exist.

## Metrics that matter

### Cycle time

Time from work starting to work delivered. Use first commit → merged, which is measurable:

```bash
gh pr list --state merged --limit 200 --json number,createdAt,mergedAt \
| jq -r '.[] | ((.mergedAt|fromdate) - (.createdAt|fromdate)) / 86400 | floor' \
| sort -n | awk '{a[NR]=$1} END {
    printf "n=%d  p50=%d d  p85=%d d  p95=%d d  max=%d d\n",
    NR, a[int(NR*0.50)], a[int(NR*0.85)], a[int(NR*0.95)], a[NR]}'
```

Report **p50 and p85**, never the mean. Cycle-time distributions are right-skewed: the mean is
dragged by the tail and describes no actual item. p85 is what you use for a forecast, because it
is the promise you can keep.

### Throughput

Items completed per period. This is the input to every forecast:

```bash
gh issue list --state closed --limit 500 --json closedAt \
| jq -r '.[].closedAt[0:10]' | cut -c1-7 | sort | uniq -c
```

Report the **range** across periods, not just the mean. A team delivering 2–7 items per week has
a very different forecast from one delivering 4–5, even with the same mean.

### Work item age

Age of items currently in progress. The single most actionable metric on a board, because it is
the only one that can be acted on *before* the item is late.

```bash
gh issue list --state open --label "status:in-progress" --json number,title,updatedAt \
| jq -r --arg now "$(date -u +%s)" '.[] |
    "\(.number)\t\((($now|tonumber) - (.updatedAt|fromdate))/86400 | floor) d\t\(.title)"' \
| sort -k2 -rn
```

Rule of thumb: any in-progress item older than the p85 cycle time is already an exception. It
goes on the blocker table in the status report, whether or not anyone has called it blocked.

### Flow efficiency

```
flow_efficiency = active_time / total_elapsed_time
```

Typically 5–25% in software teams. Most of an item's life is waiting — for review, for
environments, for a decision. When it is low, adding capacity does nothing; removing wait states
does everything. Measuring it precisely requires per-state timestamps; if the board does not
carry them, say the metric is unavailable rather than estimating it.

## Diagnosing a stalled board

| Symptom | Likely cause | Action |
|---|---|---|
| Review column always full | review not prioritised over new work | reviewers finish reviews before pulling; consider a review WIP limit of 1 per person |
| In progress full, nothing moves | too many parallel items per person | enforce the limit; finish oldest first |
| Blocked column growing | external dependencies unmanaged | escalate each with a name and a date; treat as `risk.v1` |
| Ready column empty | grooming not keeping up | run `groom-backlog` before the iteration, not during |
| Ready column enormous | over-grooming; items will go stale | stop grooming beyond `2 × throughput`; it is inventory, and inventory rots |
| High throughput, rising cycle time | items are being started, not finished | check WIP; throughput may be counting small items only |
| Everything finishes on the last day | scope shaped to the iteration, not to the work | check for status-driven completion; look at work-item-age distribution |

## What these metrics are not for

They describe the **system**, not the people in it. Attributing cycle time or throughput to an
individual guarantees the numbers get managed instead of the work: items get split to inflate
counts, and "in progress" gets set late. Once that happens the data is gone, and with it the
forecast. This is not a matter of tact; it is a measurement-integrity constraint.
