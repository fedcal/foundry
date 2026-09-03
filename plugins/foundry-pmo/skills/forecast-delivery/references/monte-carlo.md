# Monte Carlo forecasting, worked by hand

The method has one idea: instead of assuming next month looks like the average of last month,
resample what actually happened, thousands of times, and read the spread.

## The data

Throughput per week, last 10 weeks, counting only items that reached `done`:

```
H = [7, 9, 4, 8, 11, 6, 0, 9, 7, 8]
```

The `0` is a real week — a holiday, an incident, a migration. **Do not remove it.** Outlier
removal is how a forecast becomes optimistic: those weeks recur, and a model that excludes them
predicts a team that does not exist.

Remaining items: `R = 60`.

## The simulation

```
for trial in 1..10000:
    delivered = 0
    weeks     = 0
    while delivered < R:
        delivered += random_choice(H)     # with replacement
        weeks     += 1
    record(weeks)

sort(records)
p50 = records[5000]
p85 = records[8500]
p95 = records[9500]
```

Sampling **with replacement** is the whole mechanism: any week can be drawn any number of times,
so a trial can contain two zero-weeks in a row, exactly as reality can.

## Reading the result

Typical output for this dataset:

| Percentile | Weeks | Meaning |
|---|---|---|
| p50 | 9 | half of futures finish by here — coin-flip, internal use only |
| p85 | 12 | the number you commit to externally |
| p95 | 14 | for a deadline with an external cost of being late |

The gap between p50 and p85 is the honest measure of this team's variability. A tight gap means a
predictable system; a wide gap means the estimate is dominated by variance, and the lever is
reducing variance rather than working faster.

## Sanity bracket

Always compute alongside, never instead:

```
optimistic  = R ÷ p85(H) = 60 ÷ 9  ≈ 7 weeks
pessimistic = R ÷ p15(H) = 60 ÷ 4  = 15 weeks
```

The simulation's p50 and p95 should fall inside that bracket. If they do not, the simulation is
wrong — check for an empty history, an off-by-one in the accumulation loop, or `cancelled` items
leaking into throughput.

## Scope growth

Measure the arrival rate of new in-scope items over the same window and inflate `R`.

```
arrivals    = 22 items over 10 weeks = 2.2 / week
R_effective = R + 2.2 × forecast_weeks     # solve iteratively, 2-3 passes converge
```

With `R = 60` and this arrival rate, p85 moves from 12 weeks to roughly 16. That difference is
not a detail — it is usually the difference between the forecast people believed and what
happened. **State the measured growth rate in the output**, so nobody reads the date as
conditional on a backlog freeze nobody agreed to.

## Why not velocity × remaining points

Velocity-based forecasting multiplies an average by a scope estimate, which compounds two errors
and reports the result as one date. It implicitly assumes next quarter resembles the mean of last
quarter — precisely the assumption that fails, because the bad weeks are what move deadlines.

Item counts also cannot be inflated. Points can, and are, the moment velocity becomes a target.

## Preconditions

- At least 6 complete periods. Fewer: forecast anyway, widen the interval, mark `low-confidence`.
- Periods of equal length. Mixing weeks and Sprints in one history invalidates the resample.
- One team, one board. Pooling teams pools incomparable units.
- `cancelled` excluded from throughput.
