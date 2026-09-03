# Unit economics — CAC, LTV, payback, and how each is faked

Unit economics answer one question: **does one more customer make us better or worse off?**
If the answer is "worse", growth accelerates the loss. That is why these metrics matter more
than revenue growth, and why they are the ones most often massaged.

No project figures here. Illustrative arithmetic is labelled.

## 1. Contribution margin

```
CM  = price − variable cost per unit
CM% = CM / price
```

Variable cost means cost that genuinely varies with one more unit: hosting attributable to the
customer, third-party API calls, payment processing fees, AI/token spend, and the marginal
support cost. Not the office. Not the CTO.

The most common error is calling a cost fixed because it is currently paid monthly. Ask: if we
had one more customer tomorrow, would this cost rise? If yes, it is variable, whatever the
invoice looks like.

## 2. Customer acquisition cost

```
CAC = fully loaded sales & marketing spend in period / new customers acquired in period
```

### Fully loaded means

- Paid media, agency fees, tooling, events, content production
- Sales salaries, employer contributions, **commission**, and sales-engineering time
- Marketing salaries and employer contributions
- The share of product/engineering time spent on growth work
- Free-trial infrastructure cost, if trials are a channel

A CAC containing only ad spend understates by a large and unknowable factor. **Write out
exactly what is included**, because two people quoting "our CAC" are usually computing
different things — and the disagreement is invisible until money has been committed.

### Segment by channel, always

A blended CAC hides that one channel is unprofitable and another is capacity-constrained.
Scaling on the blended number scales the bad channel, because the bad channel is usually the
one with headroom.

```
CAC_channel = fully loaded spend on that channel / new customers from that channel
```

### The lag problem

Spend in month `t` produces customers in months `t+1..t+n`. Dividing this month's spend by this
month's customers is wrong whenever spend is changing — and it is wrong in the flattering
direction when spend is falling. Either lag the numerator by the sales cycle, or compute CAC
over a window long enough for the lag to wash out, and state which you did.

### Attribution

Multi-touch attribution is a modelling choice, not a measurement. State the model used
(first-touch, last-touch, linear, or none) and note that channel CACs shift materially with it.

## 3. Lifetime value

```
LTV undiscounted = ARPA × GM% / monthly_churn_rate
LTV discounted   = ARPA × GM% / (monthly_churn_rate + monthly_discount_rate)
```

Both use **gross profit**, not revenue. An LTV computed on revenue is a vanity number: it
values a customer at money you never keep.

### Use the discounted form

The undiscounted formula implicitly values cash flows arbitrarily far in the future at face
value. At 1% monthly churn, the implied average customer life is 100 months; valuing month-100
cash at par is indefensible. Discounting bounds it:

*Illustrative only:* with monthly churn `c = 0.01` and monthly discount rate `d = 0.01`, the
discounted LTV is exactly **half** the undiscounted one, because the denominator doubles. The
gap grows as churn falls, which is why low-churn businesses produce the most inflated LTV
claims.

### The churn assumption is doing all the work

`LTV` is inversely proportional to churn, so a small error in churn is a large error in LTV.

- With under roughly a year of cohort data, churn is an **assumption**, so LTV is an assumption
  raised to a power. Present retention curves by cohort instead of a single LTV number.
- Early cohorts churn differently from later ones (early adopters, then a broader market).
  Extrapolating from the first cohort is optimistic almost by construction.
- Churn is rarely constant. Real curves are steep early and flatten. A constant-hazard model
  understates early loss and overstates the tail. If your cohort data shows a flattening curve,
  say the constant-churn LTV is a simplification and bound it.
- **Logo churn and revenue churn are different.** With expansion revenue, net revenue retention
  can exceed 100% while customers leave. Report both and label which the LTV uses.

## 4. Payback

```
CAC payback (months) = CAC / (ARPA × GM%)
```

The most robust of these metrics, because it depends on the **near** future rather than a
projected customer lifetime. Prefer it when cohort data is thin.

Two refinements worth making explicit:

- Use gross-profit payback, not revenue payback. Revenue payback is systematically shorter and
  systematically wrong.
- Payback measured on **cash** matters more than on accrued margin when the business is
  cash-constrained. Annual-upfront billing shortens cash payback dramatically; monthly billing
  lengthens it. State the billing assumption.

## 5. Ratios — heuristics, not laws

```
LTV / CAC
```

`LTV/CAC ≥ 3` and `CAC payback ≤ 12 months` are **widely used rules of thumb**. Cite them as
heuristics and state the caveats:

- The appropriate level depends on gross margin, churn shape, cost of capital and how much
  growth is being funded from cash rather than from the balance sheet.
- The ratio is only as good as the LTV, and the LTV is only as good as the churn assumption.
- A ratio can never replace the cash-flow analysis. A business with excellent unit economics
  and no cash still fails, and it fails first.
- Optimising the ratio directly is easy and harmful: stop spending on acquisition and the
  ratio improves while the business shrinks.

## 6. How these numbers get faked — a checklist for reading someone else's

| Trick | How to spot it | Correction |
|---|---|---|
| CAC excludes salaries | CAC looks low relative to sales headcount | Rebuild fully loaded |
| CAC uses blended channels | No channel breakdown offered | Ask per channel |
| CAC divided by *all* customers, not new | Denominator suspiciously large | Use new customers only |
| LTV on revenue not gross profit | No GM% anywhere near the LTV calculation | Multiply by GM% |
| LTV undiscounted with low churn | Implied customer life over ~5 years | Use the discounted form |
| Churn from the best cohort only | One cohort shown, the earliest | Show all cohorts |
| Logo churn quoted, revenue churn hidden | NRR mentioned but churn not, or vice versa | Report both |
| Payback on revenue | Payback under a few months in a low-margin business | Recompute on gross profit |
| Expansion revenue counted as new | New-customer count does not reconcile to the funnel | Separate new from expansion |
| Free users in the denominator | ARPA implausibly low, customer count implausibly high | Define "customer" once, in writing |

## 7. What to report

For each segment or channel:

| Field | Requirement |
|---|---|
| CAC | with its scope written out in full |
| CAC by channel | with the capacity limit of each channel |
| ARPA | and the definition of "account" |
| GM% | attributable, not company-wide, where they differ |
| Payback (months) | on gross profit; state the billing assumption |
| Retention curve | by cohort, with the number of cohorts and their age |
| LTV | discounted **and** undiscounted, with the churn assumption visible |
| LTV/CAC | flagged as a heuristic |
| Sample size | how many customers each figure rests on |

Then state, in one sentence, the honest confidence: *"These figures rest on N customers over M
months; the churn assumption is <[measured]/[ASSUMPTION]> and moving it by X percentage points
changes LTV by Y%."* That sentence is worth more than any of the individual metrics.
