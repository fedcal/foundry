# Model structure — P&L, cash flow, and the driver tree beneath them

No project figures appear here. Any illustrative arithmetic is labelled as such.

## 1. The driver tree comes first

A financial model is a driver tree with money attached. Build the tree before the P&L, because
the tree is what a reviewer can argue with — the P&L is just its consequence.

```
Revenue
├── Customers
│   ├── Opening customers
│   ├── New customers  ← per channel, each with a CAPACITY LIMIT
│   └── Churned customers  ← retention curve, ideally by cohort
└── ARPA (average revenue per account)
    ├── Price per plan
    ├── Plan mix
    └── Expansion / contraction within account
```

```
customers_t = customers_{t−1} × (1 − churn_t) + new_t
revenue_t   = customers_t × ARPA_t
```

### The capacity limit is the honesty test

Every acquisition channel has a ceiling: outbound is limited by reps × meetings per rep; paid
is limited by audience size before CPC rises; content is limited by publication rate and
indexation lag; partnerships are limited by partner count and their own capacity.

A model where `new_t` grows without a stated ceiling is asserting an infinite channel. Name
the ceiling for each channel and show the month the plan hits it. That month is usually the
real constraint on the whole plan, and finding it is often the most valuable output of the
entire exercise.

### Top-down is not a forecast

"1% of a €4bn market" is a wish with a decimal point. It contains no mechanism: no channel, no
salesperson, no campaign, no capacity. Use market size to sanity-check a bottom-up build from
above — never to generate the build.

## 2. P&L lines and their drivers

| Line | Typical driver | Traps |
|---|---|---|
| Revenue | customers × ARPA | recognise over the service period, not on invoice |
| COGS: hosting | requests / tenants — from `finops-analyst` | often omitted entirely from a "software has no COGS" model |
| COGS: third-party APIs | transactions | payment processing fees are COGS, not G&A |
| COGS: AI/token spend | sessions or features — from `ai-spend-report` | the newest and most volatile COGS line |
| COGS: support delivery | tickets, which scale with users **and** defect rate | the second driver is the one people forget |
| Gross profit | — | `GM% = gross profit / revenue`; state it, it drives LTV and payback |
| S&M | headcount + programme spend | must reconcile with the CAC used in unit economics |
| R&D | headcount | capitalised or expensed? state the policy or expense it and flag |
| G&A | headcount + fixed | grows in steps: office, audit, insurance, compliance |
| D&A | capex schedule | a modelling convention here, not an accounting policy |

### Headcount deserves its own schedule

Usually the largest and least reversible cost. Model per role: start month, loaded cost
(salary + employer contributions + benefits + equipment + software seats), and ramp to
productivity for revenue-generating roles.

Two things that reliably go wrong: hiring slips (model the plan and a slipped case), and
loaded cost is understated because only salary was counted.

## 3. Cash flow — the model that matters

```
Operating cash flow = EBITDA − Δ working capital − tax paid
Free cash flow      = operating cash flow − capex
Closing cash_t      = closing cash_{t−1} + FCF_t + financing_t
```

### Working capital is timing, and timing is cash

```
Δ working capital = Δ receivables + Δ inventory − Δ payables
```

- **Receivables.** A 60-day collection period on annual invoices is a financing decision
  disguised as a sales term. Model `days sales outstanding` explicitly.
- **Payables.** Paying suppliers later improves cash and worsens relationships. Model the
  actual terms, not the invoice date.
- **Prepayments.** Annual-upfront billing is a cash gift that flatters early months and creates
  a deferred revenue liability. Show both effects.

### Report the trough, not the end state

```
min(closing cash) over the horizon, and the month it occurs
runway = closing cash / average monthly net burn
```

The trough sets the funding requirement. A plan that ends with a healthy cash balance and dips
below zero in month 14 has failed in month 14. State the cash buffer policy — e.g. "never
below N months of opex" — and whether the plan respects it.

## 4. Break-even, three ways

```
CM  = price − variable cost per unit         CM% = CM / price
Q*  = fixed costs / CM                       R*  = fixed costs / CM%
Operating leverage = contribution margin / EBIT
Margin of safety   = (revenue − R*) / revenue
```

| Form | Question it answers | Note |
|---|---|---|
| Volume | How many customers? | The one operators can act on |
| Time | Which month? | Accounting break-even, on the P&L |
| **Cash** | When does cumulative FCF turn permanently positive? | Almost always later; sets the funding need |

High operating leverage means small revenue misses produce large profit misses. Quantify it
rather than calling the business "scalable" — the same property that magnifies upside
magnifies the downside, and saying so is the difference between analysis and advocacy.

## 5. Timing conventions to state explicitly

- Does a cost land at the start or the end of its period?
- Are annual costs spread monthly or lumped in their month? Lumping changes the cash trough.
- Does revenue start in the month of signature, of go-live, or of first invoice?
- Do salaries include the thirteenth/fourteenth month payments where the jurisdiction has them?
- When do tax payments actually leave the bank, as opposed to when the charge accrues?

Each of these changes the trough. State them; they are assumptions like any other.

## 6. Structural checks before anyone reads the model

- [ ] Balance identity holds where a balance sheet exists: `assets = liabilities + equity`
- [ ] Closing cash in the cash flow equals cash on the balance sheet, every period
- [ ] Revenue in the P&L reconciles to invoiced amounts plus deferred revenue movement
- [ ] No hardcoded number sits inside a formula — inputs live in a clearly marked input block
- [ ] Every calculated column has one formula copied across, no exceptions
- [ ] `NPV()` does not include the year-0 cash flow (it discounts its first argument by one
      period). This off-by-one is the most common spreadsheet defect in financial models.
- [ ] Sign conventions consistent: costs negative everywhere, or positive everywhere
- [ ] Every input cell is `[measured]`, `[given]` or `<<TBC: …>>` — no unlabelled constants
- [ ] Circular references off, or the iterative-calculation setting documented

## 7. What a model must never do

- Contain a number nobody can source.
- Change the horizon or the discount rate to reach a desired conclusion. If you re-ran it with
  different parameters, show both runs.
- Present a single scenario as the plan.
- Bury an assumption in a formula. Assumptions live in a labelled input block where a reviewer
  can find and change them in one place.
- Claim precision the inputs do not support. If churn is `<<TBC>>`, the NPV has no decimal
  places — it has a sign and a range.
