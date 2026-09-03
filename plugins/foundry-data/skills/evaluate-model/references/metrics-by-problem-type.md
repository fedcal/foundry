# Metrics by problem type, and when each one misleads

## Classification

| Metric | Use when | Misleads when |
|---|---|---|
| Accuracy | Classes roughly balanced, all errors roughly equal cost | Any class imbalance — a 95/5 split makes "always predict majority" 95% accurate |
| Precision / recall per class | Errors have asymmetric cost (false positive vs. false negative matter differently) | Reported only in aggregate/macro form when one class dominates volume — check per-class, not just macro-averaged |
| F1 | A single number balancing precision/recall is needed for one class | Used as the sole metric when the two error types have genuinely different business cost — report the costed version instead |
| PR-AUC | Class imbalance is significant | Compared across datasets with different class balance — PR-AUC is not balance-invariant the way ROC-AUC approximately is |
| ROC-AUC | Reasonably balanced classes, or a ranking-quality question independent of the operating threshold | Strong imbalance — ROC-AUC can look good while precision at any usable threshold is poor |
| Confusion matrix (counts, not just rates) | Always report alongside any single-number metric | Reported as percentages only — raw counts reveal small-subgroup and rare-class issues that percentages hide |
| Cohen's kappa | Comparing agreement/performance against a baseline that itself is imperfect (e.g. against a noisy human label) | Used without stating the base rate — like the judge-calibration warning in `foundry-ai:build-eval-suite`, kappa near 0 can co-exist with high raw agreement under imbalance |

## Regression

| Metric | Use when | Misleads when |
|---|---|---|
| MAE | Errors should be weighted linearly; robust summary wanted | Large errors are disproportionately costly (a $10,000 miss matters more than 10× a $1,000 miss) — MAE treats them proportionally |
| RMSE | Large errors are disproportionately costly | Target has extreme outliers not meant to dominate the metric — a handful of extreme rows can dominate RMSE |
| MAE and RMSE together | Always — the gap between them is itself informative (large gap = a few big misses drive the error) | Reported as one number only; the comparison between the two is often the actual finding |
| R² | Explaining variance is the actual question, comparing to a mean-only baseline | Target has low variance to begin with (a high R² is easy) or the model is compared across different datasets — R² is not directly comparable across different target distributions |
| MAPE | Percent error is genuinely the business-relevant unit | Target can be zero or near-zero — MAPE explodes or is undefined near zero |

## Forecasting

| Metric | Use when | Misleads when |
|---|---|---|
| MASE (mean absolute scaled error) | Comparing against a naive/seasonal-naive baseline directly, across series of different scale | Rarely misleads for its intended purpose — prefer it over MAPE when the target can approach zero |
| Per-horizon error | Always — report 1-step, mid-horizon and longest-horizon error separately | Reported as a single averaged-over-horizon number — a model can be excellent at 1-step and useless at 10-step, and the average hides which |
| Coverage of prediction intervals | An interval/quantile forecast is produced, not just a point forecast | Reported without checking realised coverage against the nominal level (a "90% interval" that contains the true value 60% of the time is silently wrong) |

## Ranking / recommendation

| Metric | Use when | Misleads when |
|---|---|---|
| Precision@k / Recall@k | k matches how results are actually consumed | k chosen for convenience rather than the real display size (top-3 vs. top-50 are different questions) |
| nDCG@k | Relevance is graded, not just binary, and position matters | Relevance labels themselves are unreliable — nDCG is only as trustworthy as its labels |
| MRR | The question is "how quickly does the first relevant result appear" | Used when multiple relevant results matter (e.g. a shopping list), where recall/nDCG fit the actual task better |

## Clustering / unsupervised

| Metric | Use when | Misleads when |
|---|---|---|
| Silhouette score | Comparing candidate cluster counts/algorithms on the same data | Treated as an absolute quality bar — it has no universal "good" threshold across datasets |
| Domain validity check (do discovered groups match a known taxonomy where one exists) | Always, alongside any internal metric | Skipped entirely in favour of only internal metrics — internal metrics can be optimised without producing anything domain-useful |

## Always alongside the primary metric

Report the sample size the metric was computed on, and whether it was computed on the same test
set used for the baseline comparison in `train-model` — a metric computed on a different slice of
data than the baseline comparison is not comparable to it, however similar the numbers look.
