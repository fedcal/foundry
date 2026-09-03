# Monitoring minimum checks, per deployment target

"Minimum" means the smallest set of checks below which a shipped model's decay would go unnoticed
until a stakeholder complains. It is a floor, not a target ceiling — add more as the model's stakes
justify it.

## Data (input) drift

- Track the distribution of the model's most important input features over time, compared against
  the training distribution recorded in the model card.
- State the method proportionate to the model's stakes: a simple summary-statistic comparison
  (mean/variance/percentile shift against a stated threshold) is often enough for a low-stakes
  model; a population stability index or a distributional distance measure is more appropriate when
  the decision is high-stakes and a subtle shift matters.
- Alert on the stated threshold, not on "looks different" — an undefined threshold means the alert
  will either never fire or fire on every run.

## Prediction (output) drift

- Track the distribution of the model's own predictions over time (for classification: the
  predicted class proportions; for regression: the prediction distribution's summary statistics).
- A prediction-distribution shift with no corresponding input-distribution shift is worth
  investigating on its own — it can indicate the input drifted in a way the input-drift check did
  not capture, or that something changed in the serving pipeline itself (a feature computed
  differently than in training, a version mismatch).

## Performance decay

- As ground truth becomes available, recompute the primary metric from `evaluate-model` on a
  rolling window (state the window size) and compare it against the baseline-comparison margin
  established there.
- Alert when the rolling metric regresses past that margin — reusing the same margin keeps
  monitoring and evaluation consistent, rather than picking a new, arbitrary drift threshold that
  was never validated against the original evaluation.
- If ground truth arrives with a delay, state the delay explicitly in the runbook and treat
  performance-decay monitoring as running on a lag — do not silently treat the most recent window
  as "no regression detected" when it is actually "not yet measurable".

## Operational health

- Latency (state the percentile that matters, typically p95 or p99 for a service endpoint) and
  error rate, with an alert threshold.
- Request/throughput volume against expectation — for a service endpoint, a silent drop in traffic
  is as much an incident as a spike in errors, and it is invisible to error-rate monitoring alone.
- For a batch or scheduled job: run completion and duration tracked against the expected schedule,
  with an alert on a missed or significantly delayed run.

## Per deployment target, the minimum set

| Target | Minimum monitoring |
|---|---|
| Batch job | Run completion/duration, output row-count sanity check against the previous run, input drift on the batch's key features |
| Service endpoint | Latency (stated percentile), error rate, request volume, prediction drift |
| Scheduled pipeline step | Upstream dependency success, this step's completion/duration, output sanity check consumed by the next step |
| JVM artifact embedded in another application | Whatever the embedding application's own monitoring already covers, plus a periodic scoring smoke test against a known input to catch silent artifact corruption or version mismatch |

## What triggers what

Every alert in the runbook names the decision it is meant to trigger: investigate manually,
roll back to the previous model version, or trigger a scheduled retraining. An alert with no
attached decision is noise that will be muted the first time it is inconvenient.
