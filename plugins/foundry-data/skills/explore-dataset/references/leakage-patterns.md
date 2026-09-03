# Leakage patterns, with diagnostics

Work through every category before trusting a promising correlation, a suspiciously high early
model score, or a feature someone insists is "obviously fine". Each entry names the symptom, the
check that confirms it, and the fix that addresses the cause.

## Target leakage

1. **Feature is a transform of the outcome.** Symptom: one feature alone predicts the target
   almost perfectly. Check: fit the trivial baseline plus this one feature; if it beats the full
   model, inspect how the feature is computed. Fix: remove it, or replace it with the
   information legitimately available before the outcome occurred.
2. **Post-outcome field.** Symptom: a field is only ever populated after the event being predicted
   (a "resolution notes" column for a churn model). Check: read the field's population logic or
   ask who writes it and when. Fix: drop it, or replace with its state as of the prediction time.
3. **Aggregate computed over the full history including the label period.** Symptom: a rolled-up
   feature like `avg_spend_all_time` computed after the label window closed. Check: recompute the
   aggregate restricted to data available strictly before the prediction cutoff and compare. Fix:
   window every aggregate to end at the cutoff, per row.

## Temporal leakage

4. **Future information inside a feature.** Symptom: a feature's value could not have been known
   at prediction time (next month's price used to predict this month's churn). Check: for each
   feature, write down the timestamp at which its value became knowable; any feature whose
   timestamp is after the prediction cutoff fails. Fix: recompute as-of the cutoff, or drop.
5. **Random split of time-ordered data.** Symptom: validation performance is far better than
   performance on genuinely new, later data. Check: compare a random split's score against a
   forward time-based split's score on the same data. Fix: split by time (see `train-model`
   references/validation-strategies.md); never shuffle time series or event sequences.
6. **Rolling window computed after the label, not before it.** Symptom: a "last 7 days" feature
   whose window includes days after the labelled event. Check: verify the window's end boundary
   against the label timestamp for a sample of rows by hand. Fix: anchor every window to end
   strictly before the cutoff.

## Group / entity leakage

7. **Same entity's rows split across train and test.** Symptom: validation score drops sharply on
   genuinely new entities. Check: count entities (customer, patient, session, device) present in
   both splits. Fix: split by group, not by row — every row for one entity goes to one side only.
8. **Near-duplicate rows split across sets.** Symptom: two rows differ only in an id or a
   timestamp but describe the same underlying event. Check: deduplicate on a normalised content
   hash of the non-id columns and count cross-split matches. Fix: deduplicate before splitting, or
   group by the underlying event.

## Proxy / identifier leakage

9. **High-cardinality identifier correlates with the label via row order or database sequencing.**
   Symptom: a raw id or its numeric suffix has non-trivial feature importance. Check: shuffle the
   id column and confirm importance drops to noise; check whether ids were assigned in an order
   correlated with time or outcome. Fix: drop raw ids as features, or replace with a property that
   is legitimately predictive (e.g. account age, not the account id itself).
10. **Encoding fit on train+test together.** Symptom: target encoding, mean encoding or a fitted
    embedding computed using the full dataset before the split. Check: read the pipeline order —
    does the encoder see test rows during `fit`? Fix: fit every encoder inside the training fold
    only, applied to validation/test as a pure transform.

## Pipeline leakage

11. **Preprocessing fit before the split.** Symptom: scaling, imputation or feature selection
    statistics computed on the whole dataset, then split. Check: read the pipeline order; the
    correct order is split → fit preprocessing on train → transform validation/test. Fix: move
    every `fit` inside the cross-validation fold, never outside it.
12. **Feature selection using the target on the full dataset.** Symptom: a supervised
    feature-selection step (e.g. selecting by correlation with the target) run once before any
    split. Check: same as above — was the target visible to the selector before the split existed?
    Fix: perform selection inside each fold; report which features were selected how often across
    folds as a stability signal, not as a single fixed list.

## After finding a leak

State which rows or features are affected, whether the model's headline number must be
recomputed, and whether the leak also invalidates any conclusion already shared. A leak found
after a number was published is a correction, not a footnote — say so explicitly in the profile
doc's revision history.
