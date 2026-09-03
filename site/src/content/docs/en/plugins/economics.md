---
title: foundry-economics
description: Project cost engineering, TCO and business cases, cloud FinOps, AI and token spend control, grant funding.
sidebar:
  order: 7
---

`foundry-economics` puts numbers on decisions: what work will cost, what a system costs to run,
what running the AI itself costs, and whether the thing is worth building at all.

Every estimate it produces is a three-point range with the assumptions written down, because a
single number presented without assumptions is a guess wearing a suit.

## Install

```bash
/plugin install foundry-economics@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- Someone asks "how much will this cost", "how long will this take", "what is the TCO" or
  "are we on budget".
- The cloud bill is rising and nobody can attribute it to a feature or a request.
- You want to know what Claude Code itself is costing, which model an agent should use, or whether
  prompt caching is worth it.
- A grant budget, a public-call structure, timesheets or milestone reporting has to be prepared.

## When not to use it

- These are engineering estimates, not accounting. Nothing here is an audited financial statement
  or tax advice.
- It does not sequence work — that is `roadmap-planner` in `foundry-pmo`.
- Cloud cost analysis needs billing data. Without it, `finops-analyst` reasons about architecture,
  not about your actual bill.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `cost-engineer` | Project cost engineering: decomposes work, produces three-point estimates and answers "how much", "how long", "what is the TCO", "build or buy". | `opus` | `high` |
| `business-case-analyst` | Business case and financial plan: whether to build something, break-even, the numbers a funding or board paper needs. | `opus` | `high` |
| `finops-analyst` | Cloud and infrastructure run-cost analysis: why spend is up, what a request costs, whether reserved capacity is worth buying. | `opus` | `high` |
| `funding-analyst` | Grants and public funding mechanics: grant budgets, structuring a project for a public call, timesheets and evidence, milestone reporting. | `opus` | `high` |
| `ai-cost-controller` | The cost of running AI itself: what Claude Code is costing, which model an agent should use, prompt-cache economics, token budgets per workflow. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `estimate-project` | A structured estimation session: decompose the work, collect three-point ranges, compute PERT expected value and p50/p80/p95, sanity-check. |
| `tco-model` | A multi-year total cost of ownership model over a stated horizon, with discounting and the cost lines teams routinely forget. |
| `business-plan` | A financial plan: P&L projection, cash flow, break-even, unit economics, NPV/IRR at a stated discount rate, with scenarios and a sensitivity table. |
| `ai-spend-report` | A report of AI and token spend from real metrics — per-agent and per-feature attribution, retry waste, prompt-cache economics, token budgets. |
| `budget-tracking` | Setting up and running budget-versus-actual tracking with earned-value variance analysis, forecast at completion, and an agreed escalation threshold. `setup` once, `review --period YYYY-MM` thereafter. |

`tco-model` and `business-plan` take an explicit `--horizon` and `--rate`, so the discount rate is
a stated input rather than a hidden assumption.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `cost-engineer` | `plan.v1` | `estimate.v1` |
| `business-case-analyst` | `estimate.v1` | `estimate.v1` |
| `finops-analyst` | `estimate.v1` | `estimate.v1` |
| `funding-analyst` | `estimate.v1` | `compliance-check.v1` — funding-programme obligations assessed as controls |
| `ai-cost-controller` | `estimate.v1`, optionally, plus the project's own instrumentation | `estimate.v1`, one item per attribution unit (feature, agent or workflow) |

`estimate.v1` requires `scope`, at least one `items` entry with `optimistic`, `likely` and
`pessimistic`, and at least one `assumptions` entry. An estimate with no stated assumptions cannot
be written to the blackboard — the schema rejects it.

## The AI-cost loop

`ai-cost-controller` and `ai-spend-report` read what `foundry-core` records. Every
`memory_search`, `memory_write`, `blackboard_write`, gate block, subagent return and session end
is appended to `.foundry/metrics/events.jsonl`, and the `token_report` MCP tool and the
`foundry tokens` command summarise it. That makes "which agent is expensive" a measurement rather
than an opinion.

## Limits

- Token figures are estimated at roughly four characters per token. They are consistent enough to
  compare agents against each other; for billed amounts use `/cost` and `/usage`.
- `.foundry/metrics/` is gitignored by `foundry init`, so the history is local to a machine unless
  you deliberately collect it.
- Currency defaults to EUR in `estimate.v1` and `risk.v1` (`impactEur`). Other currencies are
  expressible in `estimate.v1` via `currency`, but the risk schema's exposure field is EUR-named.
- Funding rules differ per programme and per call. `funding-analyst` produces evidence structure
  and budget mechanics; it does not certify eligibility.
