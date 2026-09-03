# Calibration and subgroup performance, in depth

## Reliability diagram, step by step

1. Take the model's predicted probabilities (or scores rescaled to [0, 1]) on the test set.
2. Bucket predictions into ranges (deciles are a common default: 0.0–0.1, 0.1–0.2, …).
3. For each bucket, compute the mean predicted probability and the observed frequency of the
   positive class among rows in that bucket.
4. Plot or tabulate predicted vs. observed per bucket, and the count of rows per bucket (a bucket
   with very few rows produces a noisy observed frequency — report the count next to it, exactly
   as with subgroup counts below).
5. A perfectly calibrated model has predicted ≈ observed in every bucket with enough rows. A model
   whose predicted probabilities are systematically higher than observed is overconfident;
   systematically lower is underconfident; and a model can be well-calibrated on average while
   badly miscalibrated in specific ranges — read the buckets, not just an averaged score.

## Brier score

Mean squared error between predicted probability and the binary outcome (0/1). Lower is better; it
rewards both good discrimination and good calibration jointly, which is exactly why it must be
reported *alongside* the reliability diagram rather than instead of it — two very different
reliability diagrams can produce similar Brier scores.

## Recalibration, done without leaking

If recalibration is needed (Platt scaling: fit a logistic regression on the model's raw score
against the true label; isotonic regression: fit a monotonic mapping from raw score to calibrated
probability):

- Fit the recalibration mapping on a **calibration split** that is disjoint from both the training
  fold used to fit the model and the test set used to report final performance.
- Report both the pre- and post-recalibration reliability diagrams and Brier scores — recalibration
  should be shown to help, not merely asserted to.
- If no separate calibration split can be afforded, say explicitly that calibration and performance
  numbers share data and that the calibration quality reported is optimistic.

## Subgroup breakdown protocol

1. **Choose subgroups from the domain**, not from whatever columns happen to be easy to group by:
   the ones a stakeholder will ask about, and any group `explore-dataset` flagged as
   under-represented or subject to a missingness/leakage caveat.
2. **Report the primary metric per subgroup with the row count.** A subgroup metric with no count
   next to it invites over-trusting a number computed on a handful of rows.
3. **State a minimum count** below which a subgroup's metric is reported as "insufficient data to
   conclude" rather than as a number (a common default is enough rows to make the metric's
   confidence interval usable — for a proportion-based metric, a rough rule of thumb is at least
   dozens of positive and negative cases each; state whatever threshold was actually used).
4. **Check for Simpson's-paradox-style masking**: compute the aggregate metric, then check whether
   any subgroup moves in the opposite direction from the aggregate when comparing model vs.
   baseline. An aggregate improvement that hides a subgroup regression is reported as a finding,
   not smoothed over.
5. **Intersectional subgroups** (e.g. region × tier) usually have too few rows to support an
   independent conclusion — check the count before reporting one, and prefer flagging it as an open
   question over fabricating a false-precision number.

## What "checked" means

A subgroup is "checked" only if its row count, its metric, and a comparison against both the
aggregate and the baseline are all recorded. Naming the subgroup in a bullet list with no numbers
attached is not a check — it is a promise of one.
