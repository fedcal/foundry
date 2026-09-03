# Sampling, uncertainty and honest reporting

The purpose of this file is to stop three sentences being said: "it's better", "accuracy went
from 81% to 84%", and "we tested it and it works".

## Pair everything

Run both configurations on the **same items** and compare per item. Paired analysis removes item
difficulty from the variance and detects much smaller real effects than comparing two independent
averages at the same sample size. There is no reason to run unpaired comparisons on a frozen
dataset, and doing so wastes the dataset's main advantage.

## Paired binary outcomes: look at the discordant pairs

With pass/fail outcomes, build the table:

|  | B pass | B fail |
|---|---|---|
| **A pass** | a | b |
| **A fail** | c | d |

Cells `a` and `d` carry no information about the difference: both systems agreed. The evidence is
entirely in `b` and `c`, the **discordant pairs**. McNemar's test operates exactly on those two
counts. Practical consequence: on 200 items where the systems agree on 180, your comparison rests
on 20 items — and reporting "84% vs 81% on 200 items" hides that. Report `b` and `c`.

## Intervals, not points

Report an interval for every rate. Bootstrap over items is the simplest defensible method: resample
items with replacement many times, recompute the metric, and take the empirical 2.5th and 97.5th
percentiles. It assumes nothing about the distribution and it is a few lines of code.

For a k-run design, resample **items** (not runs) and use each item's pass *rate* across its k
runs as the item's value. Resampling runs instead treats correlated repeats as independent
observations and produces intervals that are far too narrow.

## Say what your set can resolve, before you run it

State the minimum difference the set can distinguish from noise before you look at the result.
The mechanics: small differences need many items; paired designs need fewer than unpaired ones;
per-stratum conclusions need items *within* that stratum. If the set cannot resolve the difference
the decision needs, there are exactly two honest moves — grow the set, or make the decision on
other grounds and say so. Squinting at overlapping intervals is not a third option.

A stratum with 4 items supports no conclusion. Report its count next to its rate, always, so that
nobody quotes "100% on multi-hop" from four questions.

## Multiplicity

Twenty criteria across six strata is 120 comparisons. Some will look significant by chance.
Controls, in order of preference: pre-register the small number of criteria that actually gate
the release; report the rest as descriptive with their intervals and no significance claim; if
you must test many, apply a multiple-comparison correction and say which one.

## Non-determinism is part of the measurement

Report the per-item pass rate over k runs, and report the distribution — "18 items passed 3/3, 4
items passed 2/3, 1 item passed 0/3" is informative in a way that "88% pass rate" is not. Items
that are unstable are a different defect class from items that are wrong, and they need a
different fix.

## Report cost and latency in the same table

Every quality claim carries: dataset version, configuration hash, model id, prompt version, k,
date, tokens per item, cost per item, and p50/p95 latency. A quality gain with a large cost or
latency increase is a trade-off for a human to weigh, and hiding the denominator turns a trade-off
into a marketing claim.

## The four ways eval numbers get oversold

1. **Aggregate hides a stratum regression.** Always publish the per-stratum table.
2. **A single run reported as a result.** k ≥ 3, gate on the rate.
3. **The improvement was measured on the items used to iterate.** Report the held-out slice
   separately; it is the only number with predictive value.
4. **The comparison changed two things.** Model *and* prompt *and* retrieval configuration moved
   together, so the result attributes to nothing. One variable per comparison, or the number tells
   you only that something happened.

## The most valuable sentence in this file

"There is no measurable difference at this sample size." Say it when it is true. A team that
cannot hear it will keep shipping noise and calling it progress.
