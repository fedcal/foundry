# Validation strategies, in depth

## The three cases, and why they are not interchangeable

### 1. Temporal data

If the model will predict forward in time in production, validation must simulate that: train on
the past, validate on the future relative to training, never the reverse and never shuffled.

- **Simple holdout by time**: pick a cutoff date; everything before is train, everything after is
  validation/test. Simple, but wastes data and gives one estimate.
- **Expanding-window cross-validation**: fold 1 trains on period 1, validates on period 2; fold 2
  trains on periods 1–2, validates on period 3; and so on. Every fold's training window grows.
  This mirrors how the model will actually be retrained in production.
- **Rolling-window cross-validation**: like expanding, but the training window has a fixed size
  and slides forward. Use this when older data is known to be less relevant (concept drift) and
  you want every fold trained on a comparable amount of data.
- **Gap between train and validation**: if predictions in production are made some time before the
  label is known (e.g. predicting 30-day churn), leave that same gap between the end of the
  training window and the start of the validation window in every fold — omitting the gap is a
  subtle form of temporal leakage.

**Failure mode to check for explicitly**: k-fold cross-validation with `shuffle=True` (or its
equivalent) applied to time-ordered data. It produces a score 5–20 points better than what the
model will see in production, because every fold trains on some rows from after the validation
rows' timestamps.

### 2. Grouped data

If the target is at the entity level but there are multiple rows per entity (repeated
measurements, multiple sessions, multiple transactions), the entity — not the row — is the unit
that must not cross the train/validation boundary.

- **Group k-fold**: partition entities into k folds; every row for an entity stays in one fold.
- **Group shuffle split**: a single random partition at the entity level, useful when k-fold is too
  expensive to run repeatedly during early iteration.
- **Nested grouping**: if entities are themselves nested in a higher-level group that must also not
  leak (patients within hospitals, where the model must generalise to a new hospital), split at the
  *higher* level, not the entity level, or you will overstate generalisation to new sites while
  correctly protecting against overstating generalisation to new patients.

**Failure mode to check for explicitly**: a validation score that looks excellent in cross-
validation and then drops sharply on the next batch of genuinely new entities. That gap is usually
group leakage from an ordinary (non-grouped) k-fold applied to grouped data.

### 3. Random / independent rows

Only valid when rows are genuinely exchangeable — no shared entity, no time ordering the model
must respect. Use stratified k-fold for classification (keeps class proportions stable per fold,
which matters most under imbalance) and plain k-fold for regression, with a stated `k` (5 or 10 are
common defaults, not laws) and a stated random seed.

## Combining time and group

When data has both dimensions (a customer observed repeatedly over time), split by group first
(assign whole customers to train or test) and then, if a temporal element also matters (predicting
forward for a customer based on their own history), order what remains within each side by time as
well. Skipping either dimension leaks in the direction you skipped.

## Nested cross-validation for honest tuning

Tuning hyperparameters against the same folds used to report the final score inflates the report —
the tuning process has effectively seen the validation data many times. Nested CV avoids this:

- **Outer loop**: k folds used only to produce the final, reported score.
- **Inner loop**: within each outer training fold, a further split (or its own k-fold) used only
  for hyperparameter search.
- The outer fold's validation data is never touched during the inner loop's search.

This costs roughly k × (inner folds) times the compute of a single fit — state explicitly when
compute constraints forced a single held-out tuning split instead, and say what that costs in
confidence (one estimate of generalisation from tuning, rather than k of them).

## What to record per fold

Per-fold score, not just the mean and standard deviation — per-fold numbers are what let someone
later ask "was fold 3 unusual?" and answer it, which the aggregate alone cannot.
