# Baseline recipes, per task and per ecosystem

The baseline is not a formality — it is the number every later claim of "the model works" is
measured against. Score it under the exact validation strategy chosen for the real model.

## Classification

- **Majority class**: predict the most frequent class for every row. scikit-learn:
  `DummyClassifier(strategy="most_frequent")`. Weka: `ZeroR`. R: predict
  `names(which.max(table(y_train)))` for every row.
- **Stratified random**: predict classes with the training-set class proportions, sampled
  randomly. scikit-learn: `DummyClassifier(strategy="stratified")`. Useful alongside majority-class
  because some metrics (e.g. macro-F1) penalise majority-only prediction differently than a
  stratified guesser, and both bounds are informative.
- **Single-rule baseline**, when one exists: if a domain expert already uses a simple threshold or
  rule (e.g. "flag if amount > $X"), implement exactly that rule and score it. Beating a
  statistical dummy is a much lower bar than beating an expert's existing rule, and the second
  comparison is usually the one that matters to the business.

## Regression

- **Mean/median prediction**: predict the training-set mean (or median, if the target is skewed)
  for every row. scikit-learn: `DummyRegressor(strategy="mean")` or `strategy="median"`. Weka:
  `ZeroR` on a numeric class predicts the training mean.
- **Simple linear baseline**: ordinary least squares on the two or three most obviously relevant
  features, with no engineering. This baseline catches cases where a complex model's gain is
  actually coming from feature engineering that could have been given to a simple model too.

## Forecasting

- **Naive**: predict the last observed value forward for every future point.
- **Seasonal-naive**: predict the value from exactly one season ago (last week's Monday for a
  weekly-seasonal daily series, last year's same month for annual seasonality). On strongly
  seasonal data this baseline is often stronger than it looks, and a sophisticated model that does
  not beat it has not demonstrated it captures the seasonal structure at all.
- **Moving average**: predict the mean of the last N observed points, N stated explicitly.

## Ranking / recommendation

- **Popularity baseline**: rank items by overall frequency of past interaction, ignoring the
  individual being ranked for.
- **Recency baseline**: rank items by how recently they were interacted with (globally, or by the
  individual).
- **Existing production ranking**, if one is being replaced: score it exactly as it runs today,
  under the same evaluation set, so the comparison is against reality and not against an idealised
  version of the status quo.

## Clustering / pattern mining (no target, no baseline in the supervised sense)

There is no trivial baseline to beat because there is no label. Instead:

- Record a **null comparison**: does the discovered structure differ from what random partitions
  of the same size would produce (e.g. compare cluster cohesion against cohesion of random
  same-sized partitions)?
- Record a **domain sanity check**: do a domain expert's known groupings roughly align with the
  discovered clusters/patterns, or not? Disagreement is not automatically wrong, but it must be
  reconciled and explained, not silently reported as success.

## Recording the comparison

For every task type, record the baseline's score with the same precision and the same
fold-by-fold detail asked of the real model in `train-model` step 6 — a baseline reported only as
"about 60%" cannot support a claim that the real model's 63% is a real improvement.
