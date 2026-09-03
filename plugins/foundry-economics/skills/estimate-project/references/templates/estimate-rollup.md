# Estimate — <<TBC: scope name>>

> Analytical decision support, **not financial advice**. Every figure below is marked
> `[measured: …]`, `[given: …]` or `[ASSUMPTION — confirm]`. Unmarked figures do not exist
> in this document by design.

- **Produced by:** cost-engineer · **Date:** <<TBC: YYYY-MM-DD>>
- **Artifact:** `.foundry/blackboard/estimation/cost-engineer.json` (`estimate.v1`)
- **Worksheet:** `.foundry/economics/estimate-worksheet.csv`
- **Confidence class:** <<TBC: order-of-magnitude | budgetary | definitive>> (AACE 18R-97 Class <<TBC>>)
- **Currency:** EUR · **Unit:** <<TBC: hours | days | eur>>

## 1. Headline

| Measure | Value | Meaning |
|---|---|---|
| Expected (PERT mean) | <<TBC>> | coin-flip planning number |
| p50 | <<TBC>> | median outcome |
| **p80 — recommended commitment** | **<<TBC>>** | 80% chance of landing at or below |
| p95 | <<TBC>> | fixed-price / hard-deadline level |
| Risk premium (p80 − p50) | <<TBC>> | carried by: <<TBC: named person>> |

One sentence, no hedging: <<TBC: "Expected X; commit to Y at p80; the dominant uncertainty is Z.">>

## 2. Basis of estimate

| Item | Value | Provenance |
|---|---|---|
| Scope | <<TBC: one paragraph>> | [given: …] |
| Rate basis | <<TBC: per role, not blended — or say it is blended and why>> | [given: …] |
| Availability factor | <<TBC>> | [ASSUMPTION — confirm] |
| Working days per month | <<TBC>> | [given: …] |
| Correlation ρ used | <<TBC>> | reason: <<TBC: shared causes>> |
| Effort vs duration | <<TBC: which one this estimate measures>> | — |

## 3. Excluded

Everything below is **not** in the number. This is the section readers should check first.

- <<TBC: exclusion>> — why: <<TBC>>
- <<TBC: exclusion>> — why: <<TBC>>
- Infrastructure run cost beyond delivery → see `tco-model`
- AI/token spend → see `ai-spend-report`

## 4. Decomposition and arithmetic

<<TBC: paste the leaf table from the worksheet — id, label, role, o, m, p, E, σ, variance share>>

```
E_total   = Σ Eᵢ                                    = <<TBC>>
Var_indep = Σ σᵢ²                                   = <<TBC>>
σ_indep   = √Var_indep                              = <<TBC>>
n         = <<TBC>>      ρ = <<TBC>>
σ_total   = σ_indep · √(1 + ρ·(n − 1))              = <<TBC>>
p80       = E_total + 0.84·σ_total                  = <<TBC>>
p95       = E_total + 1.64·σ_total                  = <<TBC>>
```

**Variance concentration:** the largest single leaf holds <<TBC>>% of total variance.
<<TBC: if above 40%, name the leaf and say it is the first thing to de-risk>>

**Gate results:** <<TBC: leaves flagged TOO NARROW or SPLIT, and what was done about them>>

## 5. Reference-class check (outside view)

| Field | Value |
|---|---|
| Source of comparables | <<TBC: blackboard / memory metrics / gh / git>> |
| n comparable items | <<TBC>> |
| uplift p50 / p80 | <<TBC>> / <<TBC>> |
| `E_adjusted = E_total × uplift_p80` | <<TBC>> |

**Reconciliation:** <<TBC: do the two views agree? If the outside view is higher, which
category of work does history say the decomposition omits?>>

If no history exists, state exactly: *"No reference class available in this project;
confidence class capped at order-of-magnitude."*

## 6. Contingency

| Risk id | Description | P | Impact (EUR) | Exposure = P × Impact | Owner |
|---|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

```
contingency = Σ exposure of the risks carried = <<TBC>>
```

Not a flat percentage. Each risk is a `risk.v1` artifact with a named owner.

## 7. The assumption that matters most

> If **<<TBC: assumption>>** is wrong, the total moves by **<<TBC: amount>>**.
> It is currently <<TBC: [ASSUMPTION — confirm] / [given by X]>>.
> The cheapest way to test it before committing is **<<TBC: specific, concrete test>>**.

## 8. Validity

This estimate is valid only for the scope in §2 and expires on <<TBC: date>> or on any change
to <<TBC: the named dependency/decision>>, whichever comes first. Re-baseline via
`budget-tracking` rather than quietly adjusting this document.
