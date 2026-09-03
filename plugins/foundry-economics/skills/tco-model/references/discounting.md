# Discounting, EAC, and the conventions that quietly break models

No project figures appear in this file. The illustrative numbers are labelled as such and
must not be reused.

## 1. Present value

```
PV(C_t) = C_t / (1 + r)^t
TCO     = Σ_{t=0..N} C_t / (1 + r)^t
```

`t = 0` is the present, so `(1+r)^0 = 1` and year-0 costs are undiscounted. Decide and state
whether a cost lands at the start or the end of its period; mid-year convention
(`(1+r)^(t−0.5)`) is more accurate for costs spread evenly through a year, and is worth using
when the horizon is short enough for the difference to matter.

## 2. Choosing `r`

State the rate and its basis. There is no universally correct value, and you must never supply
one from memory.

| Basis | When appropriate | What you need |
|---|---|---|
| Corporate hurdle rate | An internal rate already exists | `[given]` by finance |
| WACC | Company-level investment appraisal | `E`, `D`, `Re`, `Rd`, `Tc` — all `[given]` |
| Cost of debt | The project is debt-financed | The actual borrowing rate |
| Public-sector discount rate | Public bodies usually publish a mandated rate | The rate from the relevant published guidance, cited |
| `r = 0` | Very short horizons, or a deliberate simplification | **Say you are doing it and why** |

```
WACC = (E/V)·Re + (D/V)·Rd·(1 − Tc)          V = E + D
Re   = Rf + β·ERP                             (CAPM)
```

Every input — `Rf`, `β`, `ERP`, `Rd`, `Tc`, `E`, `D` — is `[given]` or a visible placeholder.
**Never state a risk-free rate, an equity risk premium or a beta from memory.** These change
continuously and are the inputs a reviewer will check first.

### The `r = 0` trap

Using zero is not neutral. It asserts that €1 in year 5 equals €1 today, which systematically
favours options with high recurring cost and low upfront cost. If you use zero, write it in
the assumptions in as many words: *"No discounting applied; this favours low-capex options."*

## 3. Nominal vs real

- **Nominal** cash flows include inflation; discount at a **nominal** rate.
- **Real** cash flows are in today's money; discount at a **real** rate.

```
(1 + r_nominal) = (1 + r_real) · (1 + inflation)
```

Mixing them is a common and material error. If you escalate salaries by an inflation
assumption but discount at a real rate, you double-count inflation and overstate future costs.
Pick one convention, state it in the model header, and apply it to every line.

The inflation assumption itself is `[given]` or a placeholder. Do not supply a rate.

## 4. Equivalent annual cost

Raw TCO is only comparable between options with the **same lifetime**. When lifetimes differ,
convert to an annual equivalent:

```
annuity_factor A(r, N) = (1 − (1 + r)^(−N)) / r          (for r > 0; A = N when r = 0)
EAC = TCO / A(r, N)
```

*Illustrative arithmetic only — not a benchmark:* with `r = 0.08` and `N = 5`,
`A = (1 − 1.08^-5)/0.08 = (1 − 0.6806)/0.08 = 3.993`. A TCO of 1,000,000 gives an EAC of
`1,000,000 / 3.993 = 250,438` per year.

Compare EACs, not TCOs, whenever a 3-year option sits next to a 7-year one. The alternative —
"extending" the short option by assuming a like-for-like replacement — hides the replacement
decision inside the model, which is exactly the decision the model should be exposing.

## 5. Spreadsheet formulas

| Quantity | Spreadsheet |
|---|---|
| PV of a single cost | `=C_t/(1+$r$)^t` |
| NPV of a cost stream starting at t=1 | `=NPV(r, C1:CN)` |
| NPV including a t=0 cost | `=C0 + NPV(r, C1:CN)` — **`NPV()` discounts the first argument by one period**, so year 0 must sit outside it |
| Annuity factor | `=(1-(1+r)^-N)/r` |
| EAC | `=TCO/((1-(1+r)^-N)/r)` or `=PMT(r, N, -TCO)` |
| Real from nominal rate | `=(1+r_nom)/(1+infl)-1` |
| Escalated cost line | `=base*(1+escalation)^t` |

The `NPV()` off-by-one-period error is the single most common spreadsheet defect in TCO
models. Check it on every model you receive: if the year-0 build cost is inside the `NPV()`
range, the model is wrong.

## 6. Sensitivity on `r` — always run it

Discount rate sensitivity is cheap and revealing. Re-run the total at `r`, `r ± 2pp` and
`r = 0`. Then say which of these is true:

- **The ranking is stable across the range.** Report that; the decision is robust to the rate
  and you can stop arguing about it.
- **The ranking flips.** Then the decision is really a judgement about the cost of capital,
  not about the technology. That is a materially different conversation and it belongs with
  whoever owns the hurdle rate — say so explicitly rather than picking a rate that wins.

## 7. What discounting does not fix

- It does not make an invented cost line real.
- It does not compensate for an optimistic volume forecast — run the pessimistic volume too.
- It does not capture **option value**. An option that is more expensive but reversible may be
  worth more than a cheaper irreversible one, and standard discounting cannot see that. Note
  it qualitatively where it matters; do not fake a real-options valuation.
- It does not capture **risk differences** between options unless you adjust the cash flows.
  Prefer adjusting the cash flows (via scenarios and explicit risk exposures) over inflating
  the discount rate: a risk-loaded rate penalises later years arbitrarily and hides what the
  actual risk is.
