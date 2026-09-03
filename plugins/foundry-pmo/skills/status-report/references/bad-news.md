# Reporting bad news

Bad news does not improve with age. A slip reported in week 2 has options: descope, resequence,
add capacity, move the date. The same slip reported in week 9 has one option, and it is the
expensive one.

## Four rules

### 1. Early beats complete

Report a probable slip the day the evidence exists, labelled as a signal with its confidence.

> "Signal, not yet confirmed: at the current rate M2 completes 2–5 weeks late. Two more weeks of
> data will narrow this. Flagging now because descoping is cheap this week and expensive in
> three."

Waiting for certainty means reporting when the decision window has closed. That is not caution;
it is deferring someone else's decision without telling them.

### 2. Plainly

| Instead of | Write |
|---|---|
| "experiencing challenges with timeline confidence" | "will miss 30 Nov; forecast p80 18 Dec" |
| "resource constraints have impacted velocity" | "one of three engineers has been on incident duty for 3 weeks" |
| "the integration is proving more complex than anticipated" | "the provider has no sandbox for step-up auth; we cannot test before production" |
| "we are working to mitigate" | "A. Rossi escalates to the vendor account manager by 29 Aug" |
| "some quality concerns remain" | "2 open sev:1 defects: #412, #418" |

Hedged language costs the reader time and costs you credibility, because everyone recognises it
and everyone translates it — usually to something worse than the truth.

### 3. Cause without blame

Name the mechanism, not the person who was slow.

> Good: "The sandbox request sat in the vendor's queue for 9 days. We had no escalation path
> agreed at contract time."
>
> Bad: "The vendor manager did not chase it."

Blame produces defensive reporting within one cycle, and defensive reporting is how projects
fail silently. The register and the report name owners of **actions**, never culprits.

### 4. Options, not just problems

Two or three options, each with its cost and what it gives up. Recommend one and say why. The
reader can overrule you, but they should not have to invent the options themselves.

```
Option A — Descope 3-D Secure step-up to M3
  Cost: none to M2. Merchants in markets requiring step-up cannot launch until M3.
  Date : M2 holds 30 Nov (p80).
  Gives up: 2 of 7 target markets at launch.

Option B — Accept the slip
  Cost: M3 shifts by ~3 weeks; the Jan marketing window is missed.
  Date : M2 p80 18 Dec.
  Gives up: the Q1 campaign dependency.

Option C — Build against the provider's published spec without a sandbox
  Cost: ~5 days of work; the first real test is in production with live traffic.
  Date : M2 p80 5 Dec, with a wide range (2–7 Dec).
  Gives up: confidence. Adds RISK-014 at exposure ~48 000 EUR.

Recommendation: A. It preserves the committed date and the descoped markets are 8% of forecast
volume. B is acceptable if the Jan campaign is not fixed. C trades a schedule risk for an
availability risk on the revenue path, which is a worse trade at this stage.
```

## What not to do

| Anti-pattern | Consequence |
|---|---|
| Green because a fix is planned | the colour stops meaning anything; the next real red is not believed |
| Burying the slip in paragraph four | the reader who stops after 30 seconds never learns the one thing they needed |
| Reporting only the aggregate | "the programme is amber" hides which of four milestones is on fire |
| Waiting for the next scheduled report | the decision window is set by reality, not by the meeting calendar |
| Presenting a slip as a surprise when the trend was visible for weeks | the credibility damage exceeds the schedule damage, and it is permanent |
| Reporting a recovery plan as though the recovery had happened | when the plan does not work, two pieces of bad news arrive at once |
| Softening the number | "slightly late" for a 3-week slip is a false statement, not tact |

## Escalation mechanics

Escalation means: a **named person** is told, **in writing**, with the **number**, the
**options**, and a **requested decision by a date**. "It was in the status report" is not
escalation, and neither is mentioning it in a meeting.

| Trigger | Escalate to | Within |
|---|---|---|
| Committed external date at risk (p80 exceeds it) | sponsor | 2 business days |
| Blocker older than 10 days | sponsor | immediately |
| Decision waiting more than 5 days | the decider's manager | at the next report |
| Any `sev:1` open more than 24 h | sponsor + engineering owner | immediately |
| A risk crossing its escalation threshold | per `risk-manager` thresholds | as defined there |

Escalating is not an accusation and it is not a failure of the team. It is the mechanism by which
someone with more options than you gets the chance to use them.

## Correcting the record

If a previous report was wrong, correct it explicitly in the changes section, with the corrected
number and one line on why it was wrong.

> "Correction: the 13 Aug report stated 28/44 criteria complete. Four of those had not met the
> DoD. Corrected figure for 13 Aug: 24/44. Cause: completion was read from board state rather
> than from the gate checks; the method is corrected from this report onward."

Silent revision is how reports stop being read. One visible correction costs less credibility
than one discovered inconsistency.

## When the news is good

The same rules apply in reverse. Report ahead-of-plan early, with the same rigour, and say what
you propose doing with the slack: pull work forward, reduce risk, reduce the forecast range, or
give the time back. Slack that is not consciously spent gets spent unconsciously, and the
resulting scope growth arrives as a surprise in a later report.
