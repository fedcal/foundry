# TCO — <<TBC: system or decision name>>

> Analytical decision support, **not financial advice**. Every figure is marked
> `[measured: …]`, `[given: …]` or `[ASSUMPTION — confirm]`.

- **Horizon:** <<TBC: N>> years · **Discount rate:** <<TBC: r>> (<<TBC: basis>>)
- **Convention:** <<TBC: nominal | real>> · **Currency:** EUR
- **Boundary:** <<TBC: what is inside; what shared cost is allocated and how>>
- **Model:** `.foundry/economics/tco-model.csv` · **Artifact:** `.foundry/blackboard/tco/cost-engineer.json`

## 1. The number

| Option | Build (y0) | Run+maintain (y1–yN) | Decommission | Undiscounted | **TCO (PV)** | EAC |
|---|---|---|---|---|---|---|
| <<TBC: option A>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | **<<TBC>>** | <<TBC>> |
| <<TBC: option B>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | **<<TBC>>** | <<TBC>> |

Build is <<TBC>>% of the discounted total. State it explicitly — it is the number that
corrects the instinct to decide on build cost alone.

**Comparability check:** <<TBC: confirm both options deliver the same outcome, or state how
scope was normalised. If they are not comparable, say the comparison is void.>>

## 2. Where the money goes

| Rank | Cost line | PV | % of TCO | Shape | Provenance |
|---|---|---|---|---|---|
| 1 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 2 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 3 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

## 3. Lines that are usually forgotten — status here

| Line | Included? | Value | Note |
|---|---|---|---|
| Backups and cross-region copies | <<TBC>> | <<TBC>> | |
| Egress (internet, cross-region, cross-AZ, NAT) | <<TBC>> | <<TBC>> | |
| Log ingestion and retention | <<TBC>> | <<TBC>> | |
| Metrics cardinality | <<TBC>> | <<TBC>> | |
| On-call compensation | <<TBC>> | <<TBC>> | |
| Non-production environments | <<TBC>> | <<TBC>> | |
| Licence uplift clause | <<TBC>> | <<TBC>> | clause: <<TBC>> |
| Runtime/platform EOL migration | <<TBC>> | <<TBC>> | EOL date: <<TBC>> |
| Parallel run during transition | <<TBC>> | <<TBC>> | |
| **Decommissioning** | <<TBC>> | <<TBC>> | zero requires justification |
| Archive retention after shutdown | <<TBC>> | <<TBC>> | obligation: <<TBC>> |
| Contract exit fees and exit egress | <<TBC>> | <<TBC>> | clause: <<TBC>> |

Any "no" in this table is a deliberate exclusion with a reason, or a defect.

## 4. Excluded from this model

- <<TBC>> — why: <<TBC>>
- Benefits and revenue — this is the cost side only; see `business-plan`
- <<TBC>>

## 5. Sensitivity

| Change | TCO | Ranking changes? |
|---|---|---|
| Base case | <<TBC>> | — |
| r = 0 | <<TBC>> | <<TBC>> |
| r + 2pp | <<TBC>> | <<TBC>> |
| Horizon N−2 | <<TBC>> | <<TBC>> |
| Horizon N+2 | <<TBC>> | <<TBC>> |
| Pessimistic volume | <<TBC>> | <<TBC>> |

**Crossover:** <<TBC: "Option A is cheaper below X <units>; option B above it. The current
forecast is Y, which is Z% from the crossover.">>

If the ranking flips within the plausible range of any input, the honest conclusion is
"it depends on <input>, and here is how to find out" — not a recommendation.

## 6. The assumption that decides it

> The conclusion depends most on **<<TBC: assumption>>**. The ranking flips if it is worse
> than **<<TBC: switching value>>**, which is **<<TBC>>%** from the current assumption of
> **<<TBC>>**. That assumption is <<TBC: [ASSUMPTION — confirm] / [given by X]>>, and the
> cheapest way to test it before committing is **<<TBC: specific test>>**.

## 7. Review trigger

Re-run this model when any of these change: <<TBC: volume forecast, contract renewal date,
EOL announcement, headcount plan>>. Re-baseline via `budget-tracking` rather than editing this
document in place; a TCO model quietly amended loses its value as a record of what was decided
and why.
