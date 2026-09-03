# Error analysis playbook

## Building a failure taxonomy from real misses (classification)

1. Pull the highest-confidence wrong predictions first — cases where the model was most sure and
   most wrong are the most informative and the most likely to reveal a systematic issue rather
   than noise.
2. Read each one; do not summarise the batch with a model before reading it — exactly the same
   caution as `foundry-ai:build-eval-suite` step 1, and for the same reason: a summary drops the
   specific detail the taxonomy needs.
3. Assign each miss to a category as it emerges from what is actually there, not from a
   pre-written list. Typical categories that recur across problems (adapt, do not assume all
   apply): confusion between two specific classes, systematic error under a specific feature
   condition, mislabelled ground truth (the model may be right and the label wrong — check this
   before blaming the model), a genuinely ambiguous case, and a subgroup-specific failure pattern.
4. Count occurrences per category. The output is a table, exactly like the taxonomy table in
   `foundry-ai:build-eval-suite`:

```
confuses-class-A-and-B          14
systematic-miss-under-condition-X 9
mislabelled-ground-truth          6
genuinely-ambiguous               4
```

5. The counts decide where the next iteration's effort goes — a category with a handful of cases
   found by chance is not the same priority as one appearing across a large share of the misses.

## Residual analysis (regression)

1. Compute residuals (predicted − actual) for the full test set.
2. Plot or tabulate residuals against the predicted value. A funnel shape (residual spread growing
   with the prediction) indicates heteroscedasticity — a fixed-variance error assumption behind
   some models and intervals will not hold, and the model may need a transform of the target or a
   model family that handles varying variance.
3. Plot or tabulate residuals against each major feature individually. A visible trend (residuals
   consistently positive or negative across a feature's range) indicates a missing nonlinearity or
   interaction the model has not captured for that feature.
4. Check residuals against a subgroup dimension the same way — a regression can have a low
   aggregate error while being systematically biased (all residuals positive, i.e. systematic
   under-prediction) for one subgroup, which the aggregate MAE/RMSE will not reveal.
5. Read the largest few residuals by hand, the same way the highest-confidence misses are read for
   classification — an extreme residual is sometimes a data error in that row, not a model failure.

## Mislabelled ground truth is a real finding, not an excuse

When error analysis surfaces cases where the "wrong" prediction turns out to be a labelling error,
this is not a way to inflate the model's apparent performance after the fact — it is a data-quality
finding that belongs back in `explore-dataset`'s missingness/quality process for the next
iteration, and it must be reported honestly: relabel and re-score if a defensible correction
exists, and be explicit about how many cases were reclassified this way and why, so the number is
auditable rather than quietly adjusted.

## From findings to a fix list

Turn the counted taxonomy into a short, prioritised list: which category, how many cases, what a
plausible fix looks like (a new feature, a different model family, a data-quality fix upstream, a
labelling-guideline fix, or "irreducible — genuinely ambiguous cases, note as a known limitation").
This list is what `evaluate-model` step 7 records as the evaluation document's actionable output,
distinct from the metric numbers themselves.
