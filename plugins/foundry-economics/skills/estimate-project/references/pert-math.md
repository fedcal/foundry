# PERT maths, correlation and what the percentiles actually mean

Everything here is arithmetic you can reproduce in a spreadsheet. Nothing in this file
contains project figures; the numbers in the worked example are labelled as illustrative and
must never be copied into a real estimate.

## 1. Per-leaf statistics

For a leaf with optimistic `o`, most likely `m`, pessimistic `p`:

```
E = (o + 4m + p) / 6           beta-PERT expected value
σ = (p − o) / 6                classical PERT standard deviation
Var = σ²
```

### Why the 4

The beta-PERT approximation weights the modal value four times as heavily as the extremes,
producing a mean that sits between the mode and the midpoint of the range. It is a convention
from the original PERT work, not a law of nature. Two consequences worth knowing:

- When the distribution is strongly skewed (`m` close to `o`, `p` far away), the **mean sits
  above the mode**. The most likely single outcome is cheaper than the expected value. This is
  precisely why "we'll probably be done in 5 days" and "budget 7 days" are both true.
- `σ = (p − o)/6` assumes the range spans roughly ±3 standard deviations. If your `o` and `p`
  are honest extremes rather than practical bounds, σ is overstated; if they are polite
  hedges around `m`, σ is understated. The `1.5 ≤ p/o ≤ 10` gate exists to keep this usable.

### Sanity gates, restated

| Condition | Diagnosis | Action |
|---|---|---|
| `p/o < 1.5` | False precision — nobody knows effort this well | Re-elicit; widen `p` |
| `p/o > 10` | Not one piece of work, or pure unknown | Split the leaf, or make it a spike |
| `m` equals `o` | Optimism collapsed the distribution | Re-elicit `m` after `p` |
| `m` equals `p` | Either genuinely capped work, or fear | Ask what the cap is |

## 2. Aggregation

```
E_total   = Σ Eᵢ                     always exact, correlation-independent
Var_indep = Σ Varᵢ                   only if the leaves are independent
```

The expected value adds regardless of correlation. **The variance does not.** This is the
single most common error in bottom-up estimating: people sum the means (correct) and then sum
the variances (usually wrong), which understates the tail and produces a p80 that behaves like
a p55.

### General form

```
Var_total = Σ Varᵢ + 2 · Σ_{i<j} ρᵢⱼ · σᵢ · σⱼ
```

With uniform pairwise correlation ρ and `n` leaves of similar σ this collapses to a factor you
can quote in a meeting:

```
Var_total ≈ n·σ² · (1 + ρ·(n − 1))
σ_total   ≈ σ_indep · √(1 + ρ·(n − 1))
```

The inflation factor `√(1 + ρ(n−1))` grows with `n`, which is counter-intuitive and important:
**the more leaves you have, the more correlation matters.** A 40-leaf estimate with ρ = 0.2
carries roughly `√(1 + 0.2·39) ≈ 2.97` times the independent standard deviation. Decomposing
further does not reduce risk if the leaves share causes; it only makes the illusion of
precision more convincing.

### Choosing ρ

There is no correct value to look up. Reason from shared causes and state your reasoning:

| Situation | Direction |
|---|---|
| One team, one codebase, one architecture | ρ well above zero |
| An unproven platform or vendor under most leaves | ρ high; consider modelling it as a scenario instead |
| A key stakeholder whose availability is uncertain | ρ high across everything needing decisions |
| Genuinely separate teams, separate systems, separate skills | ρ near zero is defensible |
| Estimates all produced by the same optimistic person | ρ high — the bias is common-mode |

Where a single unproven assumption dominates, do **not** bury it in ρ. Model it explicitly as
a scenario (see the `business-plan` skill) so the decision-maker sees the bimodal outcome
rather than a smeared average.

## 3. Percentiles

```
p50 ≈ E_total
p80 ≈ E_total + 0.84 · σ_total
p95 ≈ E_total + 1.64 · σ_total
```

The z-values 0.84 and 1.64 are the standard-normal quantiles for 80% and 95%.

### The caveats you must state

1. **Normality is an approximation.** It relies on the central limit theorem, which needs a
   reasonable number of comparably sized, weakly dependent leaves. Below roughly 10 leaves, or
   when one leaf dominates the total variance, describe the interval as *indicative* and say
   why. Check for domination: if `max(Varᵢ) / Var_total > 0.4`, one leaf is driving the tail —
   name it, and consider whether it should be split or turned into a spike.
2. **`p50 ≈ E_total` only holds when the leaf distributions are near-symmetric.** Sum enough
   right-skewed leaves and the total's median falls below its mean. If most leaves are strongly
   skewed, say the p50 is slightly optimistic.
3. **The tail is one-sided in practice.** Work rarely finishes far below the optimistic case,
   but routinely exceeds the pessimistic one. Treat p95 as a soft ceiling, not a guarantee.

### What percentile to commit to

| Percentile | Meaning | Appropriate for |
|---|---|---|
| p50 / E | Coin flip | Internal planning; portfolio-level aggregation |
| p80 | Comfortable | Team commitment, budget line |
| p95 | Conservative | Fixed-price contract, regulatory deadline |

The gap between p50 and the committed percentile **is the risk premium**. It is not padding
and it is not fat. State its size and state who carries it. A sponsor who removes it has
chosen to accept the risk personally; make sure that is on the record.

## 4. Effort to money

Convert only at the end, and only per role:

```
cost = Σ ( effortᵢ × rate(roleᵢ) )
```

If you convert to money before aggregating, you lose the ability to re-run the estimate when
rates change — and rates always change. Keep the worksheet in effort units, with rates in a
separate lookup block.

A single blended rate is acceptable only when you say so explicitly. It hides **mix risk**: if
the work turns out to need more senior time than assumed, the blended rate is wrong in the
same direction as the overrun.

## 5. Worked example — illustrative only

> The numbers below are invented for the purpose of demonstrating the arithmetic.
> **They are not benchmarks and must never be copied into an estimate.**

Three leaves, unit = days:

| Leaf | o | m | p | E = (o+4m+p)/6 | σ = (p−o)/6 | Var |
|---|---|---|---|---|---|---|
| A | 3 | 5 | 12 | (3+20+12)/6 = 5.83 | 1.50 | 2.25 |
| B | 2 | 4 | 9 | (2+16+9)/6 = 4.50 | 1.17 | 1.36 |
| C | 8 | 12 | 25 | (8+48+25)/6 = 13.50 | 2.83 | 8.03 |

```
E_total   = 5.83 + 4.50 + 13.50 = 23.83 days
Var_indep = 2.25 + 1.36 + 8.03  = 11.64
σ_indep   = √11.64              = 3.41 days
```

Domination check: `8.03 / 11.64 = 0.69 > 0.4` → leaf C drives the tail. With three leaves and
one dominating, the normal approximation is weak: report the interval as indicative and
consider splitting C.

With ρ = 0.3 and n = 3:

```
σ_total ≈ 3.41 · √(1 + 0.3·2) = 3.41 · 1.265 = 4.31 days

p50 ≈ 23.83
p80 ≈ 23.83 + 0.84·4.31 = 27.45
p95 ≈ 23.83 + 1.64·4.31 = 30.90
```

Read the result properly: the honest statement is *"expected 24 days; commit to 27–28 if you
want an 80% chance; the 4-day gap is the risk premium; leaf C carries most of the uncertainty
and is the first thing to de-risk."* Not *"about 24 days"*.

## 6. Spreadsheet formulas

Assuming `o` in `C2`, `m` in `D2`, `p` in `E2`:

| Cell | Formula |
|---|---|
| E (expected) | `=(C2+4*D2+E2)/6` |
| σ | `=(E2-C2)/6` |
| Var | `=((E2-C2)/6)^2` |
| Ratio gate | `=IF(C2=0,"o is zero",E2/C2)` |
| `E_total` | `=SUM(F2:F41)` |
| `σ_indep` | `=SQRT(SUM(H2:H41))` |
| `σ_total` | `=SQRT(SUM(H2:H41))*SQRT(1+rho*(COUNT(F2:F41)-1))` |
| p80 | `=E_total+0.84*sigma_total` |
| p95 | `=E_total+1.64*sigma_total` |
| Variance share | `=H2/SUM($H$2:$H$41)` — flag any row above 0.4 |

Keep `rho` in a single named cell so a reviewer can move it and watch the interval breathe.
That demonstration is often more persuasive than the estimate itself.
