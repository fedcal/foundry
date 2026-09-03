---
name: train-model
description: Go from a trivial baseline to a defensible model — pick the split strategy correctly (temporal, grouped or random, treated as three genuinely different cases), cross-validate honestly, engineer features without leaking the target, tune within the fold, and pass the model through the single gate that matters: does it actually beat the baseline by more than noise. Use when a dataset has already been explored and judged sufficient, before writing "the model achieves X%" anywhere, when someone proposes adding model complexity without a baseline comparison, or when a Java data-mining pipeline (regression trees, pattern mining) needs the same rigour as a Python one. Produces docs/models/<model>.card.md and a versioned training run.
allowed-tools: Read Grep Glob Bash Write Edit
argument-hint: "[dataset-profile] [--task classification|regression|forecasting|ranking]"
user-invocable: true
agent: foundry-data:ml-engineer
model: sonnet
effort: medium
metadata:
  foundry.vertical: data
  foundry.io: "plan.v1 (from explore-dataset) -> plan.v1 + docs/models/<model>.card.md"
license: Apache-2.0
---

# Train a model

One task, one baseline, one honest comparison. The deliverable is a model whose improvement over
doing the trivial thing is a number with a stated uncertainty, not a demo that looks better than
guessing on the one run someone happened to show.

Do not start this skill on a dataset that has not been through `explore-dataset` and reached at
least a SUFFICIENT WITH CAVEATS verdict — a leak found after training invalidates every number
produced here.

## When not to use this

- **The dataset has not been profiled or the leakage check was skipped** → run `explore-dataset`
  first; a model trained on unaudited data produces a number, not evidence.
- **The task is a deterministic rule** (a lookup table, a fixed threshold a domain expert already
  knows works) — write the rule and test it; a model is a cost you pay when a rule cannot capture
  the pattern, not a default choice.
- **You need to choose or trust evaluation metrics, calibration or subgroup performance** for a
  model that already exists → `evaluate-model`.
- **The system under test is an LLM or agent, not a fitted model over tabular/structured
  features** → `foundry-ai:build-eval-suite`; the failure modes and the calibration protocol
  there are for judged, non-deterministic outputs, not for this kind of model.
- **The goal is packaging an already-good model for production** → `productionise-notebook`.

## Step 1 — detect the ecosystem and the task type

Reuse the ecosystem detection from `explore-dataset`'s ecosystem-detection reference rather than
re-deriving it — the training stack (scikit-learn, a Java library such as Weka/Smile,
R) should match where the model will actually run, not the author's habitual toolchain.

State the task type explicitly, because it decides the baseline, the split strategy and the metric
family used later in `evaluate-model`: binary/multiclass classification, regression, time-series
forecasting, ranking, or clustering (which has no target and therefore no baseline in the sense
used below — treat it separately and say so).

## Step 2 — build the trivial baseline first, and record its score before anything else

The baseline must be the naive thing a domain expert would do with no model:

- **Classification** — majority-class prediction, and a stratified-random prediction. Weka's
  `ZeroR` is exactly this; scikit-learn's `DummyClassifier(strategy="most_frequent")` is its
  equivalent.
- **Regression** — predict the training mean or median. `DummyRegressor(strategy="mean")` /
  `ZeroR` for numeric targets in Weka.
- **Forecasting** — naive (last observed value) and seasonal-naive (value from one season ago).
  A model that cannot beat seasonal-naive on seasonal data is not adding value, however good its
  R² looks in isolation.
- **Ranking** — the existing production order, or a popularity/recency heuristic, whichever the
  new model is meant to replace.

Record the baseline's score under the *same* validation strategy chosen in step 3 before touching
a real model — a baseline scored under a different, easier split is not a valid bar.

Full baseline recipes per task and per ecosystem: `references/baseline-recipes.md`.

## Step 3 — choose the split strategy for what the data actually is

Treat these as three different problems, not variations of one:

1. **Temporal data** (anything with an event timestamp that the model will predict forward from in
   production) — split by time. Train on the earliest period, validate on the period right after
   it, and if doing cross-validation use expanding or rolling time-based folds, never k-fold with
   shuffling. A random split on time-ordered data silently leaks the future into training and
   produces an optimistic score that will not survive contact with production.
2. **Grouped data** (multiple rows per customer, patient, session, device) — split by group. Every
   row for one entity goes entirely to one side. `GroupKFold`/`GroupShuffleSplit` or the manual
   equivalent in a Java pipeline.
3. **Independent rows with no time or group structure** — ordinary random split or k-fold, with
   stratification on the target for classification to keep class proportions stable across folds.

Full method, including nested CV for honest hyperparameter tuning and the failure modes of getting
this wrong: `references/validation-strategies.md`.

**Gate:** name which of the three cases applies and why, in the model card, before running a
single fold. If the data has both a temporal and a group dimension (a customer observed over
time), the split must respect both — group first, then order what remains in time.

## Step 4 — feature engineering, inside the fold

- Every fitted step — scaling, imputation, encoding, feature selection — is fit on the training
  fold only and applied as a pure transform to validation/test. This is the pipeline-leakage class
  from `explore-dataset`'s leakage-patterns reference; re-check it here because it is most
  often introduced at this step, not at profiling time.
- Domain features earn their place with a one-sentence justification for why they are legitimately
  available at prediction time — the same test used for leakage in `explore-dataset` step 7 applies
  to every new feature created here, not only to the raw columns.
- Encode categoricals appropriately to the algorithm family (one-hot or target encoding fit
  in-fold for linear/distance-based models; native categorical handling for tree ensembles that
  support it; Weka's `NominalToBinary`/`StringToWordVector` filters for the Java side).

Recipes per data type (numeric, categorical, text, time-based) and per ecosystem:
`references/feature-engineering-recipes.md`.

## Step 5 — model selection and tuning

- Start with a simple, interpretable model family (linear/logistic regression, a single decision
  tree) even if a more complex one is expected to win — it is the second baseline, and it tells you
  whether the complex model's gain is worth its cost in interpretability and maintenance.
- Tune hyperparameters **inside** the training fold only (nested cross-validation, or a held-out
  tuning split separate from the final test set) — tuning against the test set is the single most
  common way a reported score stops meaning anything.
- Record every configuration tried and its cross-validated score, not only the winner — the search
  history is what makes "we tried X and it didn't help" a defensible statement later.

## Step 6 — the gate: does it actually beat the baseline?

Compare the tuned model's cross-validated score against the baseline from step 2, **on the same
folds**, and report the difference with a measure of spread across folds (standard deviation, or a
paired test across fold-level scores where the task supports one). A model that beats the baseline
on the mean but overlaps it heavily fold-to-fold has not demonstrated an improvement — say so.

**Gate:** the model card states, as a sentence, whether the model beats the baseline by more than
fold-to-fold noise. "The model scores higher on average" is not sufficient; "the model beats the
baseline in N of N folds by at least X" is.

## Step 7 — write it down

`docs/models/<model>.card.md`: task type; ecosystem and library/version actually used; the dataset
profile referenced by hash; split strategy and why; baseline definition and score; every
configuration tried with its cross-validated score; the final model, its hyperparameters, and its
seed; the gate verdict from step 6; known limitations; review date ≤ 90 days.

Emit `plan.v1` to `.foundry/blackboard/<wave>/train-model.json` with waves for baseline, split
design, feature engineering, tuning and the gate, and `outOfScope` naming every segment, time
range or feature family deliberately excluded.

## Exit criteria

1. Dataset profile referenced by hash; a SUFFICIENT or SUFFICIENT-WITH-CAVEATS verdict confirmed
   before training started.
2. Trivial baseline implemented and scored under the same validation strategy as the real model,
   before the real model was trained.
3. Split strategy named as temporal, grouped or random with a one-line justification; if data has
   both a group and a time dimension, both are respected.
4. Every fitted preprocessing step confirmed fit inside the training fold only.
5. Every non-raw feature passed the "legitimately available at prediction time" sentence test.
6. Hyperparameter tuning confirmed to have never touched the final test set.
7. Every configuration tried is recorded with its cross-validated score, not only the winner.
8. The baseline-comparison gate answered explicitly, with fold-to-fold spread reported, not just a
   mean.
9. `docs/models/<model>.card.md` exists; `plan.v1` validates with a non-empty `outOfScope`.

## Degradation

- **Too little data for a held-out test set** → use nested cross-validation for both tuning and
  the final estimate, and say explicitly that no untouched final holdout exists — the reported
  score is a cross-validated estimate, not a single confirmatory test result.
- **No labels at all yet** (a clustering or pattern-mining task) → there is no baseline in the
  supervised sense; instead validate against a domain sanity check (do the discovered clusters or
  patterns correspond to anything a domain expert recognises) and record that as the gate.
- **Class imbalance severe enough that accuracy is meaningless** → do not silently switch metrics
  here; note the imbalance and defer the metric choice to `evaluate-model`, which owns metric
  selection.
- **`superpowers` installed** → use `superpowers:test-driven-development` when building the
  feature-engineering and split code itself (write the leakage/split-boundary test before the
  transform), and `superpowers:verification-before-completion` before the model card's gate
  verdict is shared with anyone. If absent, write the split-boundary and leakage tests anyway —
  they are cheap and they are what step 4's re-check depends on.

## Deliberately not covered

Dataset profiling and leakage discovery (`explore-dataset`), metric selection, calibration and
subgroup performance analysis (`evaluate-model`), packaging and serving the trained model
(`productionise-notebook`), and evaluation of LLM/agent outputs (`foundry-ai:build-eval-suite`).

## Bundled references

- `references/validation-strategies.md` — temporal, grouped and random splits in depth, nested
  cross-validation for honest tuning, and the failure modes of each.
- `references/baseline-recipes.md` — trivial baselines per task type, with the scikit-learn, Weka
  and R equivalents named.
- `references/feature-engineering-recipes.md` — per data type (numeric, categorical, text,
  time-based), with the in-fold fitting rule restated for each.
