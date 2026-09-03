# Variance analysis — finding the cause, not just the number

A variance report that lists numbers is a spreadsheet. A variance analysis names the **cause**,
says whether it **reverses**, and attaches an **owned action with a date**. Everything below
exists to get from the first to the third.

## 1. Decompose before diagnosing

Most cost variance is one of four things. Separating them is the whole job, because each has a
different fix and a different owner.

```
price variance    = (actual rate     − planned rate)     × actual quantity
quantity variance = (actual quantity − planned quantity) × planned rate
mix variance      = effect of using a different blend of roles/resources than planned
timing variance   = cost landed in a different period than planned; reverses later
```

Check: `total variance = price + quantity + mix + timing`. If it does not reconcile, something
is unexplained — say so rather than rounding it into the largest bucket.

| Type | Typical cause | Owner | Fix |
|---|---|---|---|
| Price | rate rise, currency, vendor increase, senior staff on junior work | commercial / resourcing | renegotiate, re-staff, hedge |
| Quantity | more effort than estimated, rework, scope creep | delivery | de-scope, improve, accept |
| Mix | different role blend than planned | resourcing | re-staff |
| Timing | invoice or booking landed in another period | finance | none — do not "fix" a timing variance |

## 2. The diagnostic tree

Work down it. Stop at the first honest answer; do not continue until you find a comfortable one.

```
Variance detected
├── Is it timing? (cost booked in a different period)
│   └── YES → report as timing, state the period it reverses, take NO recovery action
├── Is it price? (rate × quantity decomposition)
│   ├── Rate rose → why? contract, currency, seniority mix?
│   └── Quantity rose → continue
├── Is it scope? (work not in the baseline)
│   ├── Approved change → re-baseline properly (see §5)
│   └── UNAPPROVED → this is scope creep. Name it. It is the most common cause and the
│       least often named, because naming it implies somebody let it in.
├── Is it productivity? (same scope, more effort)
│   ├── Rework → what caused the defect? unclear requirement, missing test, wrong assumption?
│   ├── Blocked/waiting → on whom? that dependency is the real problem
│   ├── Learning curve → was ramp modelled? if not, the estimate was wrong, not the team
│   └── Estimate was optimistic → say so; feed it to the reference class (§6)
└── Is it a materialised risk?
    └── YES → draw contingency, close the risk, report the drawdown
```

## 3. Permanent or timing — get this right

The single most consequential judgement in a variance review.

- A **timing** variance reverses. Reporting it as an overrun triggers unnecessary action and
  burns credibility when it reverses next period.
- A **permanent** variance does not. Reporting it as timing because you hope it will reverse is
  how a project arrives at 90% spend and 50% complete.

Test: *"What specific, dated event causes this to reverse?"* If you cannot name the event and
the period, it is permanent. Hope is not an event.

## 4. Trend, not snapshot

One period is noise. Track `CPI` and `SPI` over time and report the trend line, not the point.

| Pattern | Reading |
|---|---|
| One bad period, then recovery | Noise or a genuine one-off. Note it, no action. |
| Three periods in the same direction | A trend. Requires a decision, not an explanation. |
| Steadily declining CPI | Structural: the estimate basis was wrong, or the work is harder than believed. Re-estimate bottom-up. |
| CPI stable, SPI falling | Working efficiently on the wrong things, or blocked. Look at dependencies. |
| Both improving after an action | The action worked — record what it was, in memory, as a `metric` fact. |
| Suspiciously perfect CPI ≈ 1.00 every period | EV is being derived from AC. The measurement is circular and worthless. Check the earning rule. |

That last row is worth checking every time. It is a common and entirely silent failure: if
someone computes "percent complete" from spend, `EV = AC` by construction and `CPI = 1.00`
forever.

## 5. Writing the narrative

Four sentences. No more. Anything longer is being used to obscure.

```
WHAT:   <package> is <amount> over/under budget (<n>% of its baseline), <permanent|timing>.
WHY:    <one cause from the tree, with the decomposition that proves it>.
SO:     <effect on EAC and on the critical path / on the trough>.
ACTION: <specific action> owned by <name>, by <date>. Success measured by <metric>.
```

Rules that keep it honest:

- **No passive voice about causes.** "Estimates were exceeded" hides who and what. "The
  integration needed three iterations because the vendor's sandbox behaved differently from
  production" is a cause somebody can act on.
- **No aggregation to hide detail.** If one package is 40% over and nine are on plan, do not
  report "portfolio 4% over".
- **Report good news with the same rigour.** An underspend is a variance too: it may mean work
  has not started, or that the estimate was padded. Both matter. A review that only interrogates
  bad news teaches people to produce good news.

## 6. Feed the reference class

Every closed variance is data for the next estimate. Record with `memory_write`:

```
type:  metric
title: "<package>: estimated <X>, actual <Y> (uplift <Z>), cause: <category>"
body:  which category of work was missing or underestimated; what to add to the WBS next time
tags:  [estimate-actual, variance, <category>]
```

The **category** matters more than the number. "We underestimated by 60%" teaches nothing.
"We omitted the second data migration and the compliance evidence" changes the next WBS —
and that is the only way an organisation's estimating actually improves.

## 7. Anti-patterns

| Anti-pattern | Why it is corrosive |
|---|---|
| Re-baselining to clear a red status | Erases the record of how the overrun happened |
| Reporting only at the portfolio level | Hides the one package that is failing |
| "We'll catch up next sprint" with no mechanism | The TCPI test exists precisely to falsify this |
| Explaining variance by "unforeseen complexity" | Not a cause; it is a category of causes. Which one? |
| Blaming the estimate without saying what was missing | No learning, and the same omission recurs |
| Per-person variance | EVM measures work packages. Producing per-person numbers guarantees the data becomes unreliable, because people will manage the number. |
| Reviewing only when someone is worried | Guarantees the early signal is missed |
| Contingency drawn without recording which risk it paid for | Contingency becomes a slush fund and its remaining balance means nothing |
