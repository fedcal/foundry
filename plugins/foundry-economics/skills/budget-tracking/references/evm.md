# Earned value — formulas, forecast variants, and where EVM stops working

Concepts from earned value management as standardised in ANSI/EIA-748 and summarised in the
PMBOK Guide. No project figures here; illustrative arithmetic is labelled.

## 1. The three inputs

Everything else is derived from three numbers per work package per period.

| Symbol | Name | Source | Failure mode |
|---|---|---|---|
| `PV` | Planned value | time-phased baseline | straight-lined instead of phased to the plan |
| `EV` | Earned value | the earning rule agreed at setup | subjective percent-complete |
| `AC` | Actual cost | system of record | costs not yet booked; wrong cut-off date |

`EV` is the hard one. It answers "how much of the budget has the work **delivered** earned",
not "how much have we spent" and not "how far along does it feel".

### Earning rules

| Rule | Earn | Use for |
|---|---|---|
| 0/100 | nothing until complete, then everything | short packages; the most honest default |
| 50/50 | half at start, half at completion | medium packages |
| Milestone-weighted | fixed amounts at verifiable milestones | long packages with real checkpoints |
| Units complete | proportional to countable deliverables | repetitive work |
| Level of effort | earns with time by definition | support/management packages — **never generates a schedule variance**, so keep it to a small share of BAC |
| Subjective % complete | whatever someone says | avoid — it is how projects stay "90% done" for months |

Write the rule down per package **before** the first review. Choosing it afterwards means
choosing the answer.

## 2. Variance and index formulas

```
CV   = EV − AC                     cost variance       negative = over budget
SV   = EV − PV                     schedule variance   negative = behind plan
CV%  = CV / EV
SV%  = SV / PV
CPI  = EV / AC                     < 1 = spending more than the work earned
SPI  = EV / PV                     < 1 = delivered less than planned
```

`CPI` and `SPI` are ratios, so they aggregate and compare across packages of different sizes.
Use them for ranking; use `CV`/`SV` for size of the problem.

## 3. Forecast at completion — pick the variant deliberately

`EAC` is a family, not one formula. Which one you pick is a **judgement about the future**, so
state it and justify it. Quoting a single EAC as if it were arithmetic hides the judgement.

| Variant | Formula | Assumes |
|---|---|---|
| Efficiency persists | `EAC = BAC / CPI` | past performance predicts the rest. The **default**, and the one to justify departing from. |
| Variance is one-off | `EAC = AC + (BAC − EV)` | the cause has genuinely gone away. Requires naming the cause and the evidence it is gone. |
| Cost and schedule both persist | `EAC = AC + (BAC − EV) / (CPI × SPI)` | schedule pressure keeps costing money. Most pessimistic; appropriate when the team is being pushed. |
| Bottom-up re-estimate | `EAC = AC + new ETC` | the plan has changed enough that history is uninformative. Most work; most credible. |

Then:

```
ETC  = EAC − AC                    estimate to complete
VAC  = BAC − EAC                   variance at completion   negative = forecast overrun
TCPI = (BAC − EV) / (BAC − AC)     efficiency the remaining work must achieve to land on BAC
```

### The TCPI test

Compare `TCPI` to the `CPI` achieved so far.

| Condition | Meaning | What to write |
|---|---|---|
| `TCPI ≈ CPI` | The plan is consistent with performance | Report normally |
| `TCPI` modestly above `CPI` | Recovery required; possible with a named change | State the change, the owner and the date |
| **`TCPI > 1.1` while `CPI < 0.9`** | The plan requires efficiency never demonstrated | **Say the recovery is not credible.** Do not report a green EAC. |
| `BAC − AC ≤ 0` | TCPI is undefined or negative | The budget is already spent. Report against EAC, not BAC. |

This single comparison is the most useful thing EVM produces, because it converts optimism
into a falsifiable claim: *"to land on budget, the remaining work must run 18% more efficiently
than everything so far."* Somebody then has to explain how.

## 4. Worked example — illustrative only

> Invented numbers, for demonstrating the arithmetic. **Not a benchmark.**

`BAC = 400,000`. At the end of period 6: `PV = 200,000`, `EV = 160,000`, `AC = 200,000`.

```
CV   = 160,000 − 200,000 = −40,000        over budget
SV   = 160,000 − 200,000 = −40,000        behind schedule
CPI  = 160,000 / 200,000 = 0.80
SPI  = 160,000 / 200,000 = 0.80
EAC  = 400,000 / 0.80    = 500,000
ETC  = 500,000 − 200,000 = 300,000
VAC  = 400,000 − 500,000 = −100,000       forecast 25% overrun
TCPI = (400,000 − 160,000) / (400,000 − 200,000) = 240,000 / 200,000 = 1.20
```

Read it properly: *"We have earned 0.80 of a euro of work per euro spent. To finish on the
original budget the remaining work must run at 1.20 — a 50% improvement on everything achieved
so far. No such improvement has been demonstrated. The credible forecast is 500,000; the
decision is whether to fund 100,000, de-scope, or stop."*

Note the pessimistic variant here: `EAC = AC + (BAC − EV)/(CPI × SPI) = 200,000 + 240,000/0.64
= 575,000`. The gap between 500,000 and 575,000 **is** the judgement, and showing both is more
honest than picking one.

## 5. Where EVM stops working

State these limits when you report; a metric presented without its limits gets over-trusted
and then discarded when it fails.

- **SPI converges to 1.0 at the end.** As work completes, `EV → PV` regardless of how late the
  project is, because both approach BAC. Late in a project SPI is worthless as a schedule
  indicator — use the actual schedule and say so explicitly.
- **EVM measures cost efficiency, not value.** A project can be perfectly on budget and
  delivering something nobody wants. Value is `business-plan`'s question.
- **Garbage EV in, garbage everything out.** Subjective percent-complete makes every derived
  figure fiction, and a confident-looking fiction is worse than no measurement.
- **AC timing distorts short periods.** An invoice booked a week late flips a period from red
  to green and back. Use a consistent cut-off, and prefer accrued cost over cash paid.
- **Level-of-effort packages never show a schedule variance** by construction. Keep them a
  small share of BAC or SPI becomes meaningless.
- **Small samples are noise.** One period is not a trend. Three consecutive periods in the same
  direction is.
- **It says nothing about *why*.** EVM detects; `variance-analysis.md` diagnoses. Reporting
  indices with no cause is not analysis.

## 6. Spreadsheet formulas

With `PV` in `C`, `EV` in `D`, `AC` in `E`, and `BAC` in a named cell:

| Quantity | Formula |
|---|---|
| CV | `=D2-E2` |
| SV | `=D2-C2` |
| CPI | `=IF(E2=0,"",D2/E2)` |
| SPI | `=IF(C2=0,"",D2/C2)` |
| EAC (efficiency persists) | `=IF(CPI=0,"",BAC/CPI)` |
| EAC (one-off variance) | `=E2+(BAC-D2)` |
| EAC (cost + schedule) | `=E2+(BAC-D2)/(CPI*SPI)` |
| ETC | `=EAC-E2` |
| VAC | `=BAC-EAC` |
| TCPI | `=IF((BAC-E2)<=0,"budget spent",(BAC-D2)/(BAC-E2))` |
| RAG status | `=IF(CPI<red,"RED",IF(CPI<amber,"AMBER","GREEN"))` |

Keep `BAC`, `red` and `amber` as named cells sourced from
`.foundry/economics/budget.json` so nobody re-tunes a threshold mid-project by editing a
formula.
