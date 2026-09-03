# AI spend — <<TBC: project>>, <<TBC: window>>

> Analytical decision support, **not financial advice**. Prices come exclusively from
> `pricing.json`. Token counts come exclusively from `.foundry/metrics/events.jsonl` and the
> `token_report` MCP tool.

<<IF NO pricing.json — reproduce this block verbatim as the first content:>>

> No `pricing.json` found in this project. All figures below are **token counts only**;
> monetary values are shown as `<<UNPRICED>>`. Create `.foundry/economics/pricing.json` from
> `references/pricing.template.json` and fill it from your provider's current published
> pricing to get costs.

- **Window:** <<TBC>> to <<TBC>> · **Sessions observed:** <<TBC>> (lower bound — `session_end`
  is missing for crashed sessions)
- **Prices:** `<<TBC: path>>`, `asOf` <<TBC>> <<TBC: STALE if >90 days>>
- **Model priced:** <<TBC>> · **Currency:** <<TBC>>
- **Artifact:** `.foundry/blackboard/ai-spend/ai-cost-controller.json`
- **Worksheet:** `.foundry/economics/ai-spend.csv`

## 0. What this data can and cannot say

`.foundry/metrics/events.jsonl` is a gate-and-memory ledger, **not** a token ledger. The only
token-bearing event is `subagent_return`. Whole-session totals require a provider usage export
or `/cost` output.

- Whole-session totals available? <<TBC: yes, from [given: <export>] / no>>
- Feature attribution: <<TBC: measured / heuristic on branch name, confidence <<TBC>> / not attempted>>
- Unassigned share of usage rows: <<TBC>>% — <<TBC: if large, say attribution is weak rather
  than spreading the remainder pro-rata>>

## 1. Headline

| Metric | Value | Provenance |
|---|---|---|
| Total spend in window | <<TBC>> / `<<UNPRICED>>` | <<TBC>> |
| Cost per session | <<TBC>> | derived |
| Cost per merged change | <<TBC>> | derived |
| Subagent return tokens (total) | <<TBC>> | [measured: events.jsonl] |
| **Retry waste rate** | <<TBC>> | `contract_violation` / all artifact writes |
| Memory zero-hit rate | <<TBC>> | `memory_search` with `hits: 0` |

## 2. Per agent

| Agent | model / effort | Runs | Total return tokens | p50 | p80 | Max | Cost |
|---|---|---|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

Budget with the **p80**, not the mean. Frontmatter values from
`grep -rn "^model:\|^effort:" plugins/*/agents/*.md`.

## 3. Per feature

<<TBC: table, or the sentence "Feature attribution is not reliably derivable from this data;
recommend adding a feature tag. Reporting per agent and per session only.">>

## 4. Waste

| Signal | Value | Meaning | Fix |
|---|---|---|---|
| Contract violations | <<TBC>> | artifact produced, rejected, produced again — zero output | correct the agent's `## Output contract` |
| Zero-hit memory searches | <<TBC>> | facts titled by topic instead of by fact | retitle via `memory_write` |
| Gate overrides used | <<TBC>> | a gate being routed around | re-tune or remove the gate |
| Oversized subagent returns | <<TBC>> | context firewall not enforced | agent body + `handoffSummaryTokenBudget` |

## 5. Prompt-cache economics

```
w  = cacheWritePerMTok / inputPerMTok − 1 = <<TBC>>
r  = cacheReadPerMTok  / inputPerMTok     = <<TBC>>
N* = (1 + w − r) / (1 − r)                = <<TBC>>
```

- Observed reuses per cached prefix: <<TBC: measured, or "cache token counts unavailable">>
- Currently paying? <<TBC: yes / no / cannot tell from this data>>
- Prefix-stability check: <<TBC: is anything volatile — a timestamp, a session id — sitting
  near the top of the prompt?>>

## 6. Token budgets

| Workflow | Agents | Expected runs | p80 tokens/run | Headroom | Budget | Breach policy | Owner |
|---|---|---|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC: warn/degrade/stop>> | <<TBC>> |

## 7. Is the memory system paying for itself?

```
eager_baseline (counterfactual) = fact_tokens + blackboard_tokens   = <<TBC>>
lazy_actual                     = index_tokens + retrieved_tokens   = <<TBC>>
memory_write_cost                                                    = <<TBC>>
net saving per session          = eager − lazy − write_cost          = <<TBC>>
net saving over window          = × <<TBC>> sessions                 = <<TBC>>
net saving in money                                                  = <<TBC>> / `<<UNPRICED>>`
```

The eager baseline is a **counterfactual**, not an observation. Sessions that never queried
memory get no credit. **If the net is negative, state it in this section in the first
sentence** — a cost control that only ever validates its own system is not a control.

Verdict: <<TBC: one sentence, with the sign>>

## 8. Levers

| # | Lever | File to change | Measured now | Expected delta | Risk accepted | Owner | Verify (metric + when) |
|---|---|---|---|---|---|---|---|
| 1 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 2 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 3 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

A lever without a Verify column is a suggestion, not a control.

## 9. Baselines banked to memory

Recorded with `memory_write` as facts of type `metric`, so the next report has a reference
class: <<TBC: list the fact ids returned>>.

## 10. Re-measure

Re-run after applying any lever, and on: a provider pricing change, a new model entering a
workflow, a new agent, or <<TBC: cadence>>. Compare against the banked baselines above.
