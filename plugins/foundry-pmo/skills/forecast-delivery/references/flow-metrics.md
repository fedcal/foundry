# Flow metrics — definitions, preconditions, and how to read them

## Definitions

| Metric | Formula | Notes |
|---|---|---|
| Cycle time | `flow.enteredDone − flow.enteredInProgress` | needs transition history |
| Lead time | `closedAt − createdAt` | always longer; what the requester experiences |
| Throughput | count of `state: done` per period | `cancelled` never counts |
| WIP | items in `in-progress`, `in-review`, `blocked` | sample daily, not once |
| Ageing WIP | `now − flow.enteredInProgress`, unfinished items | the most actionable daily number |
| Flow efficiency | active time ÷ cycle time | needs `flow.blockedDays`; omit rather than guess |

## Always percentiles, never the mean

Cycle time is right-skewed in every real dataset: a floor near zero, a long tail of items that
got stuck. The mean sits above the median and describes no actual item.

```
p50  "most items finish within N days"        planning
p85  "we are confident within N days"          commitments
p95  "the tail"                                risk conversations
```

A mean of 6.2 days on a distribution of `1,1,2,2,3,3,4,28` is arithmetically true and practically
useless — no item took 6 days, and the 28 is the only interesting number in the set.

## Little's Law

```
average cycle time = average WIP ÷ average throughput
```

**Preconditions, which must be checked before use:** the window is long enough to be stable,
arrivals roughly equal departures, and little work is abandoned mid-flight. State that you checked
them.

Its value is not prediction — it is the lever it exposes. With throughput fixed, halving WIP
halves cycle time. That is the only reliable way to make a board faster without adding people,
and it is counter-intuitive enough that teams resist it until they see their own numbers.

## Ageing WIP

For every unfinished item, `now − enteredInProgress`, compared against the p85 of recent cycle
time.

An item past the p85 line is not "nearly done" — it is an outlier that will keep getting older.
Surface those by name daily. This single practice catches more missed commitments than any
forecast, because it catches them while there is still time to act.

## Cumulative flow diagram

Stacked area of item counts per state over time. Read three things and ignore the rest:

- **A widening band** = a state accumulating work. That state is the constraint.
- **Flat top line** = nothing arriving. Either intake stopped, or intake is not being recorded.
- **Flat bottom line** = nothing completing, regardless of how busy the middle looks.

Band width at any point approximates WIP for that state; horizontal distance between the top and
bottom lines approximates lead time.

## Segmentation that changes decisions

Pool everything and the signal disappears. Segment by:

- **Item type** — bugs and stories have different distributions; a mixed p85 describes neither.
- **Size class** — if the tail is all large items, the fix is splitting, not process.
- **Provider** — different state models are not comparable. Never pool them.
- **Blocked vs never-blocked** — separates "our work is slow" from "we wait on other people".

## What these do not measure

Not quality, not value, not effort, and not individual performance. A team can improve every
metric here by shipping smaller irrelevant items faster.

Pair them with an outcome measure — the Sprint Goal met or not met, the DORA change failure rate,
an actual user-facing metric — or optimise the board into a machine that produces motion.
