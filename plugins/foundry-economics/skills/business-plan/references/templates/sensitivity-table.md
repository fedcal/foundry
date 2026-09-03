# Sensitivity pack — <<TBC: venture or decision>>

> Analytical decision support, **not financial advice**. Every input is `[measured: …]`,
> `[given: …]` or `[ASSUMPTION — confirm]`.

- **Decision metric:** NPV at r = <<TBC>> (<<TBC: basis>>), horizon <<TBC>> years
- **Base case NPV:** <<TBC>> · **Do-nothing baseline NPV:** <<TBC>> · **Incremental:** <<TBC>>

## 1. Input ranges

All ranges taken at the **same subjective confidence level** (<<TBC: e.g. 10th/90th
percentile). Mixing confidence levels ranks your pessimism, not the model's sensitivity.

| Input | Low | Base | High | Provenance | Basis for the range |
|---|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

## 2. Tornado — one-way sensitivity

`swing(input) = NPV(input high) − NPV(input low)`, ranked by `|swing|`.

| Rank | Input | NPV at low | NPV at high | Swing | Sign flips? |
|---|---|---|---|---|---|
| 1 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 2 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 3 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| 4 | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

Everything below rank 3 is usually noise. Say so and move on.

## 3. Two-way table — the top two drivers

Decision metric: NPV. Shade the sign change.

| NPV | <<driver B>> low | B mid | B high |
|---|---|---|---|
| **<<driver A>> low** | <<TBC>> | <<TBC>> | <<TBC>> |
| **A mid** | <<TBC>> | <<TBC>> | <<TBC>> |
| **A high** | <<TBC>> | <<TBC>> | <<TBC>> |

Build with a two-variable data table, not by copying values — copied tables go stale silently.

## 4. Switching values

`switching value of x = the x for which NPV(x) = 0` · `margin of error = (base − switching) / base`

Spreadsheet: Goal Seek on the NPV cell, changing the input cell.

| Input | Base | Switching value | Margin of error | Reading |
|---|---|---|---|---|
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>>% | <<TBC: robust / monitor / FRAGILE / already fails>> |
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>>% | <<TBC>> |
| <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>>% | <<TBC>> |

| Margin | Reading |
|---|---|
| > 50% | Robust. Stop arguing about it. |
| 20–50% | Monitor. Name the leading indicator. |
| < 20% | **Fragile.** The decision rests on this being right. |
| < 0% | The base case already fails on this input. |

## 5. Scenarios — coherent bundles

Each scenario is a story about the world, with the inputs that story implies. Correlated
drivers move **together**; moving one while holding correlated inputs at base understates the
downside, often severely.

| Scenario | Narrative (one sentence) | Drivers that move together | P | NPV |
|---|---|---|---|---|
| Base | <<TBC>> | — | <<TBC>> | <<TBC>> |
| Downside | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |
| Upside | <<TBC>> | <<TBC>> | <<TBC>> | <<TBC>> |

```
Expected NPV = Σ P(scenario) × NPV(scenario) = <<TBC>>
```

Probabilities are subjective. A challengeable number beats an unstated intuition, and the
argument about the probability is the argument worth having.

## 6. Conjunction check

The base case requires <<TBC: n>> assumptions to hold. If each independently held with
probability <<TBC>>, all holding has probability <<TBC: p^n>>.

Caveats to state alongside it: the assumptions are usually **not** independent (correlated
assumptions fail together, so the joint probability of success is higher than the naive
product but the downside is worse than it implies), and the per-assumption probabilities are
subjective. The point is not the number — it is that a base case is a **conjunction**, and
conjunctions get less likely with every additional term.

## 7. The closing statement

> The conclusion depends most on **<<TBC: input>>**. It flips from go to no-go if
> **<<TBC: input>>** is worse than **<<TBC: switching value>>**, which is **<<TBC>>%** from
> the base assumption of **<<TBC: base>>**. That assumption is currently
> **<<TBC: [ASSUMPTION — confirm] / [given by X]>>**, and the cheapest way to test it before
> committing is **<<TBC: specific, time-boxed test>>**.

## 8. Recommendation

<<TBC: one of>>

- **Proceed.** The conclusion is robust across the plausible range of every material input.
- **Proceed with a gate.** Commit to <<TBC: the first tranche>>; the gate is
  <<TBC: measurable condition, by date>>.
- **Buy information first.** The case is fragile on <<TBC: n>> inputs. Run
  <<TBC: the specific experiment>> for <<TBC: cost>> over <<TBC: duration>>; it resolves
  <<TBC: which assumption>> and costs <<TBC>>% of the committed capital.
- **Do not proceed.** <<TBC: reason>>.

If the recommendation flips inside the plausible range, say the decision is genuinely
uncertain and recommend the information-buying option. Manufacturing a recommendation from an
uncertain model is the most expensive thing an analyst can do.
