# Forecasting delivery dates

Every forecast is a range with a stated method and stated assumptions. A single date without a
percentile label is not a forecast; it is a promise made accidentally.

## Method 1 — Rate-based (default)

Cheap, transparent, good enough for most reporting.

```
remaining          = scope − done
observed rates     = completed units per period, over the last N periods (N ≥ 4)
optimistic  weeks  = remaining / max(rate)
likely      weeks  = remaining / mean(rate)
pessimistic weeks  = remaining / min(rate)
PERT expected      = (optimistic + 4 × likely + pessimistic) / 6
p80               ≈ expected + 0.8 × (pessimistic − expected)
```

Worked:

```
remaining = 19 criteria
rates (7 wks) = 2, 5, 7, 4, 6, 3, 3   mean 4.3, min 2, max 7
optimistic  = 19/7   = 2.7 wk → 16 Sep
likely      = 19/4.3 = 4.4 wk → 27 Sep
pessimistic = 19/2   = 9.5 wk → 2 Nov
expected    = 4.9 wk → 1 Oct
p80         = 4.9 + 0.8 × (9.5 − 4.9) = 8.6 wk → 22 Oct
```

Caveats to state alongside it: using `min(rate)` as pessimistic understates the tail if the worst
observed week was not actually bad; the method assumes the future resembles the observed window;
and it assumes scope stops growing.

## Method 2 — Monte Carlo (when the stakes justify it)

Resample historical throughput rather than assuming a distribution. This handles the right-skew
of real delivery data, which the rate method smooths away.

```
for each of 10 000 trials:
    remaining_units = R
    weeks = 0
    while remaining_units > 0:
        remaining_units -= random_choice(historical_weekly_throughput)
        weeks += 1
    record(weeks)
sort trials; read the 50th, 80th and 95th percentiles
```

Inputs: at least **10–12** weekly throughput observations. Fewer, and the sampled distribution is
mostly the accident of which weeks you have.

Improvements worth the effort when the date matters:
- Sample scope growth too, from its own history, instead of assuming zero growth.
- Sample from the most recent 12 weeks rather than all history when the team or process changed.
- Report the full distribution shape, not only percentiles — a bimodal result usually means two
  different regimes are being averaged (before and after a change), and the average describes
  neither.

## Choosing which percentile to publish

| Percentile | Meaning | Use for |
|---|---|---|
| p50 | as likely as not | internal planning only; **never** as a commitment |
| p80 | comfortable | external communication, roadmap dates, milestone due dates |
| p95 | safe | contractual commitments, regulatory deadlines |

A team that publishes p50 dates misses half of them, and after two quarters nobody believes any
date it publishes. p80 costs a little apparent ambition and buys the ability to be believed.

Always publish the label with the date. `"18 Dec"` is a promise; `"p80: 18 Dec (range 11–22 Dec)"`
is a forecast. Stripping the label is the single most common way a forecast becomes a commitment
nobody intended to make.

## Assumptions to list every time

Minimum four, each phrased so it can be checked as false:

1. **Scope stops growing** at the current figure. State the observed growth rate so the reader
   can discount this themselves — if scope has grown 27%, the reader should not accept a forecast
   that assumes 0%.
2. **Team composition and availability unchanged** over the forecast window. Name known absences,
   holidays and rotations.
3. **Historical rate is representative.** State the window and the count of observations. Fewer
   than four makes the forecast indicative only; say so in those words.
4. **No unmitigated risk above the escalation threshold materialises.** List the top three by
   exposure with their probability, explicitly as exclusions. A forecast silently excludes every
   risk; naming the biggest three is honest, and it is what lets a reader ask the right question.

Additional assumptions when relevant: no dependency on an external party inside the window; no
freeze period; no environment or infrastructure change.

## Forecasting a milestone with a dependency chain

Rate-based forecasting assumes the remaining work is fungible. It is not, when a chain must run
in sequence. When the remaining work has a critical path:

1. Forecast the chain with three-point estimates per task and sum along the path (see
   `roadmap/references/estimation.md`).
2. Forecast the rest of the work with the rate method.
3. The milestone forecast is the **later** of the two, not their sum.
4. If the chain dominates, say so — adding people will not move the date, and that is the single
   most useful sentence in the report.

## Re-forecasting

Re-forecast every reporting period. A forecast that never moves is not being updated with
evidence, and a forecast that swings wildly every period signals that the unit or the window is
wrong (usually too small a window).

Report the movement explicitly: *"p80 moved from 8 Oct to 22 Oct (+2 weeks) — cause: 8 criteria
added 18 Aug and a 9-day block on #305."* The movement plus its cause is more informative than
either date alone.

## What invalidates a forecast entirely

Stop forecasting and say why, rather than publishing a number you do not believe:

- Fewer than four throughput observations.
- Scope changed by more than 25% since the baseline — the denominator is a different project.
- Team changed by more than a third — the historical rate belongs to a team that no longer exists.
- The remaining work is dominated by a single task nobody has done before (ratio p/o > 5) — the
  honest output is a spike, not a date.
- Nobody is measuring completion in a consistent unit — fix the measurement first.

"I cannot forecast this yet, and here is what I need in order to" is a legitimate, professional
report. A confident number with no basis is not.
