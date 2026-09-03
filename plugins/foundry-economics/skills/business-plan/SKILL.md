---
name: business-plan
description: Assemble a financial plan — P&L projection, cash flow, break-even, unit economics, NPV/IRR at a stated discount rate — with coherent scenarios and a sensitivity table, closing with the switching value of the assumption that decides the conclusion. Use for build-or-not decisions, board and funding papers, new product lines, and any argument that ends in "it will pay for itself".
user-invocable: true
argument-hint: "[venture or product name] [--horizon 5] [--rate 0.12]"
agent: foundry-economics:business-case-analyst
model: opus
effort: high
metadata:
  foundry.vertical: economics
  foundry.io: "estimate.v1 -> estimate.v1 + risk.v1"
license: Apache-2.0
---

# Business plan

A financial plan is an **argument with its weakest joint exposed**, not a spreadsheet that
concludes yes. If the output does not tell the reader which assumption to attack first, the
model has failed regardless of how many tabs it has.

**Not financial, tax or investment advice.** Analytical decision support. Investment
decisions, fundraising materials and statutory reporting require a qualified professional and
independent review.

## The rule that governs everything here

Every number is `[measured: <source>]`, `[given: <who/when>]` or `[ASSUMPTION — confirm]`, and
every calculated cell shows its formula.

**Never invent** market size, growth rates, conversion rates, willingness to pay, churn,
competitor pricing, a discount rate, a risk-free rate, a beta or an equity risk premium. These
are the inputs that decide the answer; inventing them is inventing the answer. Missing inputs
stay as visible placeholders — `<<TBC: monthly churn, %>>` — and the model runs symbolically,
reporting which value of each input flips the decision.

## Step 1 — Cost side first

Read the cost base with `blackboard_read`: `cost-engineer` for build, `finops-analyst` for
run, `ai-cost-controller` for AI. If no `estimate.v1` exists, **stop and get one**. A business
case on a made-up cost base is not a business case, and the cost side is the half you can
actually know.

## Step 2 — Frame

| Decision | Note |
|---|---|
| Horizon | Monthly for the first 12–24 months, then annual. Cash problems happen in months. |
| Currency | One. Mixed currencies need a stated FX rate and date. |
| Nominal or real | Pick one and apply it to every line. Mixing double-counts inflation. |
| Discount rate `r` | State it and its basis. `r = 0` is a claim; if you make it, say so. |
| Do-nothing baseline | Mandatory. Value is incremental. |

## Step 3 — Build the driver tree, then the P&L

**Bottom-up, never top-down.** "1% of a €4bn market" is a wish with a decimal point.

```
customers_t = customers_{t−1} × (1 − churn) + new_t
revenue_t   = customers_t × ARPA_t
new_t       = traceable to a channel WITH A CAPACITY LIMIT
```

Then:

```
Revenue − COGS = Gross profit          GM% = gross profit / revenue
− S&M − R&D − G&A = EBITDA
− D&A = EBIT
```

Every cost line names its driver: headcount, customers, requests, transactions, or genuinely
fixed. Headcount gets its own schedule with start months — it is usually the largest and least
reversible line. Structure and worked line definitions in `references/model-structure.md`.

## Step 4 — Cash flow, separately

Profit is an opinion; cash is a fact.

```
Operating CF = EBITDA − Δ working capital − tax paid
Free CF      = operating CF − capex
Closing cash_t = closing cash_{t−1} + FCF_t + financing_t
Runway       = closing cash / average monthly net burn
```

Model **payment timing**, not just amounts. Report `min(closing cash)` and the month it
occurs — that trough, not the end state, sets the funding requirement. State the cash buffer
policy and whether the plan respects it.

## Step 5 — Break-even, three ways

```
CM  = price − variable cost per unit        CM% = CM / price
Q*  = fixed costs / CM                      R*  = fixed costs / CM%
Operating leverage = contribution margin / EBIT
Margin of safety   = (revenue − R*) / revenue
```

Report **volume** break-even (how many customers), **time** break-even (which month), and
**cash** break-even (the month cumulative FCF turns permanently positive — usually much later,
and the one that determines the funding need).

## Step 6 — Unit economics

```
CAC                 = fully loaded S&M in period / new customers in period
CAC payback months  = CAC / (ARPA × GM%)
LTV undiscounted    = ARPA × GM% / monthly_churn
LTV discounted      = ARPA × GM% / (monthly_churn + monthly_discount_rate)
LTV / CAC
```

Discipline that decides whether these mean anything: CAC must be **fully loaded** and its
scope written out; CAC must be **segmented by channel** (a blended CAC hides that one channel
is unprofitable); LTV needs cohort evidence, and with under a year of data you should present
retention curves instead of an LTV number. `LTV/CAC ≥ 3` and `payback ≤ 12 months` are
**heuristics, not laws**. Full treatment in `references/unit-economics.md`.

## Step 7 — NPV and IRR

```
NPV = Σ FCF_t / (1 + r)^t
IRR = r where NPV(r) = 0
Discounted payback = smallest T with Σ_{t≤T} FCF_t/(1+r)^t ≥ 0
```

On `r`: use the corporate hurdle rate if one exists `[given]`. If deriving,
`WACC = (E/V)·Re + (D/V)·Rd·(1 − Tc)`, `Re = Rf + β·ERP` — every input `[given]` or a
placeholder. **Never supply `Rf`, `β` or `ERP` from memory.**

On IRR, name its failure modes: multiple roots when the cash-flow sign changes more than once
(check the sign pattern); an implicit reinvestment-at-IRR assumption; scale blindness — a 200%
IRR on €10k loses to a 25% IRR on €10m. **NPV decides; IRR informs.**

## Step 8 — Scenarios, sensitivity, switching values

**Scenarios** are coherent bundles, not independent knobs: in a downside, slower sales *and*
longer cycles *and* higher churn *and* later delivery move together, because they share causes.
Three at most, each with a one-sentence narrative and a subjective probability.

**Tornado:** `swing(input) = NPV(input high) − NPV(input low)`, ranked. The top bar is where
the argument lives.

**Two-way table** over the top two drivers, with the sign change shaded. Usually the single
most decision-useful object in the pack.

**Switching value — mandatory:**

```
switching value of x = the x for which NPV(x) = 0
margin of error      = (base − switching value) / base
```

Then write the closing sentence the decision-maker actually needs:

> The conclusion depends most on **<input>**. It flips from go to no-go if **<input>** is
> worse than **<switching value>**, which is **<margin>%** from the base assumption of
> **<base>**. That assumption is currently **<[ASSUMPTION — confirm] / [given by X]>**, and
> the cheapest way to test it before committing is **<specific test>**.

If several inputs have margins of error below ~20%, say the case is fragile and recommend
**buying information** — a pilot, a pre-sale, a letter of intent, a landing-page test — before
committing capital. Method in `references/sensitivity.md`.

## Step 9 — Honesty checks

- Do-nothing baseline modelled; result presented as **incremental**.
- Sunk costs ignored. Flag it when someone argues from them.
- Opportunity cost of the team counted — the same people cannot build two things.
- No double counting between "cost savings" and "revenue uplift".
- Every benefit has a named owner who will be held to it.
- Count how many independent assumptions must **all** hold. A base case built from individually
  reasonable assumptions is the standard way business cases lie; if there are nine of them,
  say so.
- Option value of waiting noted qualitatively where the decision is deferrable.

## Step 10 — Emit

`estimate.v1` via `blackboard_write` (wave `business-case`, agent `business-case-analyst`):
items are P&L lines with three-point ranges, `unit: "eur"`; `scope` carries horizon, rate and
convention; `assumptions[0]` names the **switching assumption**. Material assumption risks go
out as `risk.v1` with `exposureEur = probability × impactEur` and an `owner`.

Model files to `.foundry/economics/model/` from the CSV templates; narrative from
`references/templates/business-plan-summary.md`. Return only paths plus ≤ 300 tokens.

## Exit criteria

- [ ] Cost base read from an existing `estimate.v1`, not invented
- [ ] Horizon, granularity, currency and nominal/real convention stated
- [ ] Discount rate stated with basis, or a placeholder with a named decision owner
- [ ] Revenue bottom-up from a driver tree with a channel capacity limit
- [ ] Cash flow separate from P&L; `min(closing cash)` and its month reported
- [ ] Break-even in volume, time and cash
- [ ] CAC scope written out; CAC segmented by channel; LTV discounted and undiscounted with
      cohort evidence
- [ ] NPV computed; IRR sign pattern checked or IRR omitted with a reason
- [ ] Do-nothing baseline modelled; result incremental
- [ ] Three coherent scenarios with narratives and probabilities
- [ ] Tornado ranking plus a two-way table on the top two drivers
- [ ] Switching value and margin of error for every material input
- [ ] Switching assumption in `assumptions[0]` and in the summary, with a cheap test
- [ ] Count of independent assumptions that must all hold, stated
- [ ] Zero unlabelled numbers; every calculated cell documents its formula
- [ ] `blackboard_write` returned VALID

## What this skill deliberately does not cover

- **Company valuation**, cap tables, dilution, term sheets, option accounting.
- **Statutory accounting**: revenue recognition, capitalisation policy, deferred tax,
  consolidation. Simplifications are flagged, not resolved.
- **Tax planning** of any kind.
- **Market sizing.** It will not produce a TAM/SAM/SOM it was not given.
- **Pricing strategy** and willingness-to-pay research. It models a price; it does not set one.
- **Investor-facing materials** without professional review.
- **Monte Carlo simulation.** Deterministic scenarios plus sensitivity; a simulation over
  invented distributions adds precision, not information.
- **Cost estimation** → `estimate-project`. **Lifecycle cost** → `tco-model`.
  **Grant mechanics** → `funding-analyst`. **Tracking against plan** → `budget-tracking`.

## References

- `references/model-structure.md` — P&L and cash-flow line definitions, driver tree, timing
- `references/unit-economics.md` — CAC, LTV, payback, cohorts, and how each is faked
- `references/sensitivity.md` — tornado, two-way tables, switching values, scenario coherence
- `references/templates/pl-monthly.csv` · `cashflow.csv` · `unit-economics.csv`
- `references/templates/sensitivity-table.md` · `business-plan-summary.md`

## Interop

If `superpowers` is installed, use `superpowers:brainstorming` to elicit the driver tree
before modelling and `superpowers:verification-before-completion` before presenting
conclusions; otherwise run the exit criteria manually and say that you did.

Record the agreed discount rate, the CAC definition and the switching assumption with
`memory_write` as facts of type `decision` or `constraint` — they are exactly what gets
silently redefined between board meetings. When a decision is taken on this basis, write an
ADR under `docs/adr/` capturing the decision, the assumption it rests on, and the condition
that would reverse it.
