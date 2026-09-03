---
title: foundry-data
description: Data science and classical machine learning — exploratory analysis that reaches a verdict, baselines before models, evaluation beyond accuracy, and notebooks turned into production systems.
sidebar:
  order: 2.2
---

`foundry-data` covers the work that happens before and after a model is trained: profiling a
dataset until you can say whether it can answer the question at all, refusing to train a complex
model before a trivial baseline exists, evaluating beyond the single headline metric, and turning
a notebook into something that keeps working when nobody is watching it.

It detects the stack instead of assuming it. Data mining is as often hand-rolled Java — decision
trees, regression trees, pattern miners — as it is a pandas notebook, and every agent runs an
ecosystem check before it chooses tools or vocabulary. R and SQL-only pipelines are recognised
too.

## Install

```bash
/plugin install foundry-data@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- A dataset arrives with no documentation and someone wants a model built on it this week.
- A notebook reports an accuracy nobody can reproduce, or one so high it should be suspicious.
- Only accuracy has been reported, on an imbalanced problem, with no baseline comparison and no
  per-subgroup breakdown.
- A model is about to move from someone's laptop to a scheduled job or a service endpoint, and
  nothing versions the data it was trained on.

## When not to use it

- It does not build LLM or retrieval systems. Those are `foundry-ai`: RAG pipelines, agent
  topologies, prompt hardening and judge-based evaluation.
- It does not build the data platform underneath. Warehouse modelling, ingestion and query
  performance belong to `foundry-dev`.
- The question is a business metric someone can compute with a SQL query. A model is not the
  answer to every question, and these agents will say so.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `data-analyst` | Exploratory analysis as a discipline: dataset profiling, integrity and quality checks, missingness characterised by mechanism rather than percentage, outlier method chosen per column family, target and temporal leakage hunted deliberately, and statistics reported with effect size, confidence interval and sample size instead of a bare p-value. Reaches an explicit verdict on whether the data can answer the stated question. | `sonnet` | `medium` |
| `ml-engineer` | Model building that generalises: a trivial baseline before anything complex, split strategy chosen for the data's real structure (i.i.d., grouped or temporal, treated as three different cases), leakage-safe pipelines with in-fold feature engineering, tuning that never touches the test set, and seeds, package versions and data snapshots recorded so the number can be reproduced. | `sonnet` | `medium` |
| `model-evaluator` | Evaluation beyond accuracy: metric family matched to the problem and its cost structure, confusion matrix and error analysis on real misses, probability calibration, performance broken out per subgroup with row counts, comparison against a trivial baseline restated with uncertainty, and drift between training and current data. | `sonnet` | `medium` |
| `mlops-engineer` | The gap between "it works on my machine" and "it keeps working unattended": data and model versioning, experiment tracking, reproducible runs, serving pattern chosen for how it will actually run, monitoring for both system health and model quality, retraining triggers, and a rollback path that has been exercised rather than documented. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `explore-dataset` | Starting a new analysis or ML project, when a dataset is handed over undocumented, before any pipeline is built on top of it, or when a suspiciously high accuracy needs an explanation. Produces `docs/data/<dataset>.profile.md` and a leakage checklist. |
| `train-model` | After a dataset has been explored and judged sufficient, before writing "the model achieves X%" anywhere, or when someone proposes more model complexity without a baseline comparison. Produces `docs/models/<model>.card.md` and a versioned training run. |
| `evaluate-model` | Before a model is approved for production, before a stakeholder repeats an accuracy or R² figure in a meeting, when the metric was picked before the problem was understood, or when subgroup performance has never been checked. Produces `docs/models/<model>.evaluation.md`. |
| `productionise-notebook` | When a notebook produces a result someone wants to rely on repeatedly, when it cannot be re-run top to bottom and reproduce its own output, or when there is no plan for noticing that a shipped model has gone stale. Produces modules with tests, a pinned environment manifest and a monitoring checklist. |

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `data-analyst` | `requirement.v1` | `review.v1` |
| `ml-engineer` | `plan.v1` | `review.v1` |
| `model-evaluator` | `review.v1` | `review.v1` |
| `mlops-engineer` | `review.v1` | `review.v1` |

The chain is deliberate: `data-analyst` profiles, `ml-engineer` trains against that profile,
`model-evaluator` independently re-derives what `ml-engineer` reported, and `mlops-engineer`
refuses to ship without the evaluator's sign-off — or ships explicitly marked conditional on it.

## What else it ships

Each skill bundles `references/` with concrete recipes: ecosystem marker files and a
pandas/Weka/Smile/R tool-equivalence table, a catalogue of twelve leakage patterns with symptom,
check and fix, missing-value and outlier recipes by column family, validation strategies for the
three split cases, baseline recipes per task type (with the `ZeroR` and `Dummy*` equivalents
named), metric families with a "when it misleads" table, calibration and subgroup procedures, an
error-analysis playbook, a notebook-to-modules checklist, reproducibility and packaging per
ecosystem (pip, Maven, Gradle, renv), and minimum monitoring checks.

## Limits

- Baselines and splits are enforceable; domain knowledge is not. These agents can prove a feature
  leaks the target statistically, but they cannot tell you that a column is unavailable at
  prediction time in your business process. That input is yours.
- Fairness measurement requires subgroup labels. Where a protected attribute is not recorded —
  often for good legal reasons — the evaluation says the breakdown is impossible rather than
  reporting a number it cannot compute.
- Drift detection compares distributions; it does not explain them. A flagged shift is a prompt
  to investigate, not a conclusion.
- No library version, dataset or public benchmark is asserted anywhere in this plugin. Every
  recipe instructs runtime detection from lockfiles, `dependency:tree` or marker files, because a
  version written into an asset is stale the week after it ships.
