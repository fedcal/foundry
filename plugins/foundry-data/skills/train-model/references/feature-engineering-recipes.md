# Feature engineering recipes, per data type

Every recipe below carries the same rule from the main skill: any step that is *fit* (learns a
statistic, a mapping or a threshold from data) is fit on the training fold only, then applied as a
pure transform elsewhere. Only stateless, row-local transforms (a log, a date-part extraction, a
fixed unit conversion) are safe to compute before the split.

## Numeric features

- **Scaling** (standardisation, min-max): fit the scaler's mean/std or min/max on the training
  fold only. scikit-learn `Pipeline` handles this automatically when the scaler is a pipeline step
  refit per fold; a scaler fit once on the whole dataset before `train_test_split` does not.
- **Transforms for skew** (log, Box-Cox, Yeo-Johnson): the transform itself is stateless for log,
  but Box-Cox/Yeo-Johnson fit a parameter — fit it in-fold like a scaler.
- **Binning**: if bin edges are learned from the data (quantile binning), fit edges on the training
  fold; if edges are domain-fixed (age bands defined by policy), they are safe to apply globally.
- **Interaction terms**: create explicitly and justify each one — an automatically generated full
  interaction matrix multiplies leakage-review surface area for no clear gain in most tabular
  problems; prefer interactions a domain hypothesis motivates.

## Categorical features

- **One-hot encoding**: safe to fit in-fold; handle unseen categories at inference explicitly
  (a dedicated "unknown" bucket), not by erroring or silently dropping the row.
- **Target/mean encoding**: the highest-risk categorical encoding — it directly uses the label.
  Fit strictly inside the training fold, and use a smoothing/regularisation scheme (e.g. leave-one-
  out or k-fold target encoding within the training fold itself) to avoid the encoding memorising
  rare categories.
- **Frequency/count encoding**: fit counts on the training fold; treat unseen categories at
  inference as count zero, not as an error.
- **High-cardinality identifiers** (ids, free-text codes): do not one-hot; either drop, hash into a
  fixed number of buckets, or replace with a genuinely predictive derived property (see the proxy-
  leakage entry in `explore-dataset`'s leakage-patterns reference before keeping any form of a raw
  identifier as a feature).
- **Java/Weka equivalents**: `NominalToBinary` for one-hot, `StringToWordVector` for free text
  turned into token features, custom `Filter` implementations for target encoding (Weka has no
  built-in leak-safe target encoder — implement the in-fold fit manually).

## Text features

- **Bag-of-words / TF-IDF**: fit the vocabulary and IDF weights on the training fold only; applying
  a vectoriser fit on the full corpus before the split leaks vocabulary statistics from the
  validation/test text.
- **Pretrained embeddings**: safe to apply without in-fold fitting only if the embedding model was
  not trained or fine-tuned on this dataset; if it was fine-tuned on this data, treat the whole
  fine-tuning step as something that must respect the split.
- **Simple derived features**: text length, punctuation counts, language detected — stateless, safe
  to compute globally.

## Time-based features

- **Calendar parts** (day of week, month, is-holiday against a fixed calendar): stateless, safe
  globally.
- **Lag and rolling-window features**: window boundaries must respect the temporal split exactly as
  described in `explore-dataset`'s temporal-leakage entries — a rolling mean computed once over the
  full series before splitting leaks future folds' values into earlier ones through the window.
  Compute lag/rolling features **after** establishing the fold boundaries, windowed within each
  fold's available history.
- **Time-since-event features** (days since last purchase): safe as long as the reference "now" used
  for each row is that row's own prediction cutoff, not the dataset's overall latest date.

## Feature selection

- Any supervised selection method (correlation with target, mutual information, embedded selection
  from a fitted model) is fit in-fold, exactly like an encoder. Report which features were selected
  in how many folds — a feature selected in 2 of 5 folds is a much weaker signal than one selected
  in all 5, even if both ended up in the final feature list.
