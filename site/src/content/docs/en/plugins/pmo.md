---
title: foundry-pmo
description: Roadmap and milestone governance, backlog health, requirements, risk register, Scrum events, flow metrics and forecasting, tracker operations across GitHub, Jira, Linear and GitLab, and status reporting.
sidebar:
  order: 6
---

`foundry-pmo` is the project-office layer: turning intent into verifiable requirements, sequencing
work against real capacity, keeping a backlog and a risk register that people actually use, and
reporting status from repository data rather than from optimism.

Everything it produces is a contract artifact, which means the roadmap, the requirements and the
risk register are machine-checkable rather than a slide.

## Install

```bash
/plugin install foundry-pmo@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- Requirements exist only as conversation, and "done" is decided after the fact.
- The roadmap has dates but no exit criteria, no dependency analysis and no capacity basis.
- The backlog contains items nobody will ever pick up and duplicates nobody has noticed.
- Risks are discussed but not owned, not quantified and not reviewed.
- Status reports are written by hand and disagree with the repository.
- Sprints end without a Sprint Goal, and undone work rolls forward without being re-decided.
- Somebody is about to commit to a single delivery date with no measured throughput behind it.
- Work lives in Jira, Linear or GitLab, and every report has to be rebuilt by hand per tool.

## When not to use it

- On a solo project with a short horizon, most of this is overhead. The `startup-mvp` profile
  deliberately excludes it.
- It does not estimate cost in money — that is `foundry-economics`. `roadmap-planner` sequences;
  `cost-engineer` prices.
- `github-operator` needs the `gh` CLI, authenticated. Without it the agent announces the gap and
  falls back to describing the changes rather than applying them.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `requirements-analyst` | Turns stakeholder intent into verifiable requirements: story mapping, Given/When/Then acceptance criteria, non-functional requirements with measurable targets, traceability. | `opus` | `high` |
| `roadmap-planner` | Builds a roadmap that survives contact with reality: outcome-framed milestones with exit criteria, dependency and critical-path analysis, capacity-based sequencing. | `opus` | `high` |
| `risk-manager` | Maintains a risk register that is used: category-driven identification, probability against impact quantified in money and time, mitigations with a named owner and a review date. | `opus` | `high` |
| `backlog-manager` | Keeps a backlog healthy: splitting oversized items with SPIDR, definition of ready and done, WIP limits, retiring ageing items, duplicate detection. | `sonnet` | `medium` |
| `github-operator` | Runs a repository through the `gh` CLI: label taxonomy, milestones, Projects v2 fields and views, branch protection and rulesets, issue and PR templates, required checks. | `sonnet` | `medium` |
| `delivery-reporter` | Produces a status report a stakeholder can act on: progress against `plan.v1` read from real repository data, burn-up rather than burn-down, blockers with owners and ageing. | `sonnet` | `medium` |
| `scrum-facilitator` | Runs and repairs the Scrum events as the 2020 Scrum Guide defines them, separates the framework's rules from common practice mistaken for rules, and classifies what a team actually runs as Scrum, Kanban or an unnamed hybrid. | `sonnet` | `medium` |
| `flow-analyst` | Measures delivery empirically — cycle time percentiles, throughput, WIP, ageing work in progress, Little's Law, DORA's four keys — and forecasts with Monte Carlo over measured throughput. Refuses single-date answers and per-person metrics. | `sonnet` | `medium` |
| `tracker-operator` | Reads and mutates GitHub, Jira, Linear or GitLab through one interface, detects the provider in use, and normalises everything into `tracker-item.v1` so nothing downstream touches a provider payload. | `sonnet` | `medium` |
| `slack-operator` | Makes Slack a working delivery surface: channel taxonomy with owners, a suppression policy, Block Kit messages that lead with the ask, incident channel protocol, least-privilege scopes, and a measured alert-fatigue audit. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `write-requirements` | Eliciting and recording requirements as `requirement.v1` with the ambiguity checklist applied. |
| `roadmap` | Starting a project, planning a quarter, or when a re-planning trigger has fired. Produces `plan.v1` plus a human-readable `ROADMAP.md`. |
| `groom-backlog` | A working grooming session over the real issue tracker — split, estimate as ranges, order by value density, close stale items. |
| `github-setup` | Bootstrapping repository governance with `gh`: labels, milestones, a Projects v2 board, branch protection, templates and required checks. Idempotent. |
| `status-report` | Generating a status report from real repository and plan data — burn-up against `plan.v1`, gate progress with the actual check output, blockers with measured age. |
| `risk-review` | A periodic risk review — re-score existing `risk.v1` artifacts, identify new risks with category prompts, check detection signals against real repository data, escalate what has moved. |
| `run-sprint` | One Sprint end to end, with a gate per phase: Planning that produces a Sprint Goal before it selects items, a Daily that replans, a Review that changes the backlog, and a close-out that returns undone work instead of rolling it. |
| `run-retrospective` | A retrospective that ends with one owned, dated change — evidence from the board before opinions, a format chosen for the situation, blameless rewriting, and a check that last cycle's action actually happened. |
| `forecast-delivery` | Monte Carlo forecasting over measured throughput with scope growth included, plus cycle time percentiles, WIP, ageing work in progress and the DORA four keys. Emits p50/p85/p95, never one date. |
| `sync-tracker` | Detects the provider, reads the board, and normalises every item into `tracker-item.v1` — mapping on stable status categories rather than renameable names, and reporting what it could not map. |
| `jira-setup` | Brings a Jira Cloud project under governance with idempotent REST v3 and Agile API calls: issue types, a workflow whose statuses sit in the right categories, fields resolved by name, board, sprints and saved JQL. |
| `slack-workflow` | Wires delivery events into Slack without creating a channel nobody reads: taxonomy, suppression policy decided before the integration, Block Kit patterns, incident protocol and a measured alert-fatigue audit. |

`groom-backlog`, `github-setup` and `status-report` all take `--dry-run` or an explicit scope
argument, so nothing is applied to a live tracker by accident.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `requirements-analyst` | stakeholder intent in any raw form — transcript, issue body, meeting note, ticket cluster. There is no schema for intent. | `requirement.v1`, one artifact per requirement |
| `roadmap-planner` | `requirement.v1` | `plan.v1` |
| `risk-manager` | `plan.v1` | `risk.v1` |
| `backlog-manager` | `requirement.v1` | `plan.v1` |
| `github-operator` | `plan.v1` | `handoff.v1` |
| `delivery-reporter` | `plan.v1` and `requirement.v1` | `handoff.v1` |
| `scrum-facilitator` | `plan.v1`, `tracker-item.v1` | `review.v1` |
| `flow-analyst` | `tracker-item.v1`, `plan.v1` | `review.v1` |
| `tracker-operator` | `plan.v1`, `requirement.v1` | `tracker-item.v1` and `handoff.v1` |
| `slack-operator` | `handoff.v1`, `risk.v1`, `finding.v1` | `handoff.v1` |

`requirement.v1` requires at least one acceptance criterion in Given/When/Then form and a MoSCoW
`priority`. A requirement without a testable criterion is rejected by the contract, not by a
reviewer.

`risk.v1` requires `probability`, `impactEur`, `mitigation`, `owner` and `status`. An unowned risk
cannot be written to the blackboard.

`tracker-item.v1` is the provider-independent work item. Flow metrics, forecasts and sprint
reports read it and never a provider payload, so changing tracker rewrites one mapping table
instead of every consumer. Anything that cannot be mapped honestly becomes `unmapped` with the
provider's own word preserved beside it — a normalisation that reports zero unmapped items on a
real board has almost certainly forced values into the nearest bucket.

## Limits

- `github-operator` and `github-setup` are GitHub-specific and require an authenticated `gh`.
  `tracker-operator` covers GitHub, Jira Cloud, Linear and GitLab; Azure DevOps is not covered.
- Cycle time needs transition history. Where a tracker's changelog is unreadable,
  `flow.historyRead` is false and every figure degrades to lead time — labelled, never silently.
- Monte Carlo forecasting needs at least six complete periods. Below that it still forecasts, with
  a widened interval marked `low-confidence`, because silence gets filled by somebody's guess.
- `flow-analyst` refuses per-person metrics and single-date forecasts. Both refusals are deliberate
  and are not configurable.
- `slack-operator` never posts to a channel that was not confirmed by name, and treats
  `channels:history` as an audit-only scope rather than a standing grant.
- Burn-up reporting is only as good as the issue hygiene underneath it. On a tracker where items
  are closed in bulk at the end of a sprint, the chart will be honest and useless.
- Capacity-based sequencing needs someone to state the capacity. The agent will ask rather than
  assume a team size.
