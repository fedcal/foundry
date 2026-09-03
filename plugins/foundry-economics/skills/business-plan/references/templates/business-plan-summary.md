# Business case — <<TBC: venture or product>>

> **Not financial, tax or investment advice.** Analytical decision support. Every figure is
> `[measured: …]`, `[given: …]` or `[ASSUMPTION — confirm]`. Investment decisions and
> investor-facing use require professional review.

- **Prepared:** <<TBC: YYYY-MM-DD>> by `business-case-analyst`
- **Horizon:** <<TBC>> · **Granularity:** monthly to M<<TBC>>, then annual
- **Currency:** <<TBC>> · **Convention:** <<TBC: nominal | real>>
- **Discount rate r:** <<TBC>> — basis: <<TBC>>
- **Model:** `.foundry/economics/model/` · **Artifact:** `.foundry/blackboard/business-case/business-case-analyst.json`

## 1. The decision

<<TBC: one paragraph — what is being decided, by whom, by when, and what the money buys.>>

**Recommendation:** <<TBC: proceed / proceed with a gate / buy information first / do not proceed>>

## 2. Headline numbers

| Metric | Value | Note |
|---|---|---|
| NPV (incremental vs do-nothing) | <<TBC>> | at r = <<TBC>> |
| IRR | <<TBC>> | sign pattern checked: <<TBC>>; NPV decides, IRR informs |
| Discounted payback | <<TBC>> months | |
| Break-even — volume | <<TBC>> customers | |
| Break-even — time (P&L) | M<<TBC>> | |
| **Break-even — cash** | **M<<TBC>>** | the one that sets the funding need |
| Minimum closing cash (the trough) | <<TBC>> in M<<TBC>> | |
| Total financing required | <<TBC>> | before buffer |
| LTV / CAC (discounted) | <<TBC>> | heuristic, not a law |
| CAC payback | <<TBC>> months | on gross profit |

## 3. Cost base

From `estimate.v1` artifacts, not invented:

| Block | Source | Value |
|---|---|---|
| Build | `cost-engineer` | <<TBC>> |
| Cloud run | `finops-analyst` | <<TBC>> |
| AI / tokens | `ai-cost-controller` | <<TBC>> |
| Maintain + decommission | `tco-model` | <<TBC>> |

## 4. Revenue driver tree

```
customers_t = customers_{t−1} × (1 − churn) + new_t
revenue_t   = customers_t × ARPA_t
```

| Driver | Base | Provenance | Capacity limit | Month the ceiling is hit |
|---|---|---|---|---|
| <<TBC: channel>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

Built bottom-up. No market-share percentage appears anywhere in this model.

## 5. Unit economics

| Metric | Value | Definition / caveat |
|---|---|---|
| CAC (blended) | <<TBC>> | includes: <<TBC — write it out in full>> |
| CAC by channel | <<TBC>> | <<TBC>> |
| ARPA | <<TBC>> | "customer" = <<TBC>> |
| GM% (attributable) | <<TBC>> | |
| Payback (gross profit) | <<TBC>> | billing basis: <<TBC>> |
| Retention evidence | <<TBC>> cohorts, oldest <<TBC>> months | |
| LTV undiscounted / discounted | <<TBC>> / <<TBC>> | churn is <<TBC: [measured] / [ASSUMPTION]>> |

## 6. Cash

- Trough: <<TBC>> in M<<TBC>>
- Runway at horizon end: <<TBC>> months
- Cash buffer policy: <<TBC>> — respected? <<TBC>>
- Working capital assumptions: DSO <<TBC>>, DPO <<TBC>>, billing <<TBC>>
- Grant receipt timing, if any: <<TBC — pre-financing / interims / retained balance>>

## 7. Scenarios

| Scenario | Narrative | P | NPV | Trough |
|---|---|---|---|---|
| Base | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| Downside | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| Upside | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

Expected NPV = Σ P × NPV = <<TBC>>

Full pack: `sensitivity-table.md`.

## 8. The assumption that decides it

> The conclusion depends most on **<<TBC>>**. It flips if **<<TBC>>** is worse than
> **<<TBC: switching value>>**, which is **<<TBC>>%** from the base of **<<TBC>>**. That
> assumption is **<<TBC: provenance>>**, and the cheapest way to test it before committing is
> **<<TBC: specific, time-boxed test>>**.

Number of independent assumptions that must all hold: <<TBC>>.

## 9. Risks

Emitted as `risk.v1` artifacts with `exposureEur = probability × impactEur`:

| id | Risk | P | Impact | Exposure | Mitigation | Owner |
|---|---|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

## 10. Honesty checks

- [ ] Do-nothing baseline modelled; result presented as incremental
- [ ] Sunk costs excluded
- [ ] Opportunity cost of the team counted
- [ ] No double counting between cost savings and revenue uplift
- [ ] Every benefit has a named owner who will be held to it
- [ ] Option value of waiting noted where the decision is deferrable
- [ ] No number in this document lacks a provenance marker

## 11. Benefit owners

| Benefit | Value | Owner | Measured by | Review date |
|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

An unowned benefit is decoration. Track delivery against these with `budget-tracking`.

## 12. Decision record

If the decision is taken on this basis, write an ADR under `docs/adr/` capturing: the decision,
the assumption it rests on, the switching value, and the condition that would reverse it.
