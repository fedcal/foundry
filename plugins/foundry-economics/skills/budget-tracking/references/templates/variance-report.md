# Budget review — <<TBC: project>>, period <<TBC: YYYY-MM>>

> Analytical decision support, **not financial advice** and not statutory reporting. Every
> figure is `[measured: <source>]`, `[given: <who/when>]` or `[ASSUMPTION — confirm]`.

- **Baseline:** `<<TBC: artifact path>>`, approved <<TBC: date>> by <<TBC>>
- **BAC:** <<TBC>> (contingency <<TBC: inside | outside>> BAC, held by <<TBC>>)
- **Cut-off:** day <<TBC>> · **Cadence:** <<TBC>> · **Config:** `.foundry/economics/budget.json`
- **Worksheet:** `.foundry/economics/budget-vs-actual.csv`

## 1. Status

| Metric | Value | Threshold | Status |
|---|---|---|---|
| CPI | <<TBC>> | amber < <<TBC>>, red < <<TBC>> | <<TBC>> |
| SPI | <<TBC>> | — | <<TBC>> |
| CV | <<TBC>> | — | — |
| SV | <<TBC>> | — | — |
| EAC | <<TBC>> | — | variant: <<TBC>> |
| VAC | <<TBC>> | amber > <<TBC>>% of BAC | <<TBC>> |
| **TCPI to land on BAC** | **<<TBC>>** | vs CPI of <<TBC>> | <<TBC>> |

### The TCPI verdict

<<TBC: one of>>

- The plan is consistent with demonstrated performance.
- Recovery is required and credible: <<TBC: the named change, its owner, its date>>.
- **The plan requires an efficiency this team has not demonstrated.** To land on BAC the
  remaining work must run at <<TBC>> against <<TBC>> achieved so far. This forecast is not
  credible; the decision is to re-baseline, de-scope or fund.

## 2. Contingency and open exposure — read this before the green cells

| Item | Value |
|---|---|
| Contingency total | <<TBC>> |
| Drawn to date | <<TBC>> (for risks: <<TBC: ids>>) |
| **Remaining** | <<TBC>> |
| Σ exposure of open risks (P × impact) | <<TBC>> |
| **Verdict** | <<TBC: covered / DEFICIT IN EXPECTATION>> |

If open exposure exceeds remaining contingency, the budget is already in deficit in
expectation even while the actuals look green. This is the earliest available signal.

## 3. Work packages outside threshold

Four sentences each. No more.

### <<TBC: WP id — name>> — <<TBC: RED | AMBER>>

- **WHAT:** <<TBC>> over/under by <<TBC>> (<<TBC>>% of its baseline), **<<TBC: permanent | timing>>**.
- **WHY:** <<TBC: one cause, with the decomposition that proves it — price / quantity / mix / scope / productivity / materialised risk>>.
  ```
  price variance    = (actual rate − planned rate) × actual qty     = <<TBC>>
  quantity variance = (actual qty − planned qty) × planned rate     = <<TBC>>
  unexplained residual                                              = <<TBC>>
  ```
- **SO:** effect on EAC <<TBC>>; effect on the cash trough <<TBC>>.
- **ACTION:** <<TBC: specific action>>, owned by <<TBC: name>>, by <<TBC: date>>. Success
  measured by <<TBC: metric>>.

If **timing**: the reversal event is <<TBC: specific, dated>>. No recovery action is taken.
If no dated event can be named, it is permanent — reclassify it.

## 4. Underspends

<<TBC: an underspend is a variance too. Is the work not started, or was the estimate padded?
Both matter. A review that only interrogates bad news teaches people to produce good news.>>

## 5. Trend

| Period | CPI | SPI |
|---|---|---|
| <<TBC: P-2>> | <<TBC>> | <<TBC>> |
| <<TBC: P-1>> | <<TBC>> | <<TBC>> |
| <<TBC: this>> | <<TBC>> | <<TBC>> |

Reading: <<TBC: noise / trend / structural>>.

Circularity check: is CPI pinned near 1.00 every period? If so, EV is being derived from AC,
the measurement is circular, and every figure above is worthless. Check the earning rule.

Late-project caveat: SPI converges to 1.0 as work completes regardless of lateness. At
<<TBC>>% complete, <<TBC: state whether SPI is still informative>>.

## 6. Escalation

| Level | Triggered? | Escalated to | On | Response |
|---|---|---|---|---|
| Amber | <<TBC>> | <<TBC: role>> | <<TBC: date>> | <<TBC>> |
| Red | <<TBC>> | <<TBC: role>> | <<TBC: date>> | <<TBC>> |

Applied per the thresholds in `budget.json`, not per judgement. Thresholds exist so escalation
is not a decision made by the person with the most to lose from escalating.

## 7. Re-baseline

<<TBC: none this period>> — or:

| Field | Value |
|---|---|
| Old BAC | <<TBC>> |
| New BAC | <<TBC>> |
| Reason (approved scope change ref) | <<TBC>> |
| Approved by / on | <<TBC>> |
| Original baseline still tracked in parallel | **yes** |

Re-baselining resets variance to zero and erases the record of how the overrun happened. It is
legitimate only for an approved scope change, never as a way to make a red report green.

## 8. Artifacts emitted

- `estimate.v1` → `.foundry/blackboard/budget-review/cost-engineer.json`
- `risk.v1` for any forecast breach → owner <<TBC>>, `reviewBy` <<TBC>>
- Memory facts written (`memory_write`, type `metric`): <<TBC: ids>>

## 9. Next review

<<TBC: date>>, per the agreed cadence. Fixed cadence, not on demand — a review that only
happens when someone is worried systematically misses the early signal.
