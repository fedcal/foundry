# Severity rubric, frequency, and what counts as evidence

A usability review is dismissed when its severities look arbitrary. This file exists to make
them reproducible: two evaluators applying it to the same problem should land on the same
severity, and be able to argue about it in terms of user impact rather than taste.

---

## The rubric

| `severity` | Definition | Settling question |
|---|---|---|
| `critical` | The user **cannot complete** the task, **loses data**, or is led into an **irreversible wrong outcome** | Would a competent, motivated user fail, lose work, or be harmed? |
| `high` | The task completes, but with a high failure rate, repeated recovery, or real abandonment risk on a primary flow | Does this cause repeated errors, or a support ticket? |
| `medium` | Costs time or attention on every use; users recover unaided | Does it slow down or annoy every user, every time? |
| `low` | Inconsistency or unclear wording noticed only on close reading | Would a user even notice unaided? |
| `info` | Observation or hypothesis needing research | Is there actually a claim here, or a question? |

### Worked examples

**`critical`**
- A filled 12-field form is cleared when the server rejects the submission. Data loss.
- Double-clicking "Pay now" creates two orders and charges twice. Irreversible wrong outcome.
- "Delete" on a project has no confirmation and no undo, and is adjacent to "Duplicate".
- The session expires mid-checkout and returns the user to an empty cart.
- The primary action cannot be reached with a keyboard. (Also WCAG 2.2 SC 2.1.1 — file the
  usability finding here and the conformance finding in `audit-accessibility`.)

**`high`**
- Card expiry is free text; a large share of users enter a format that is rejected after
  submit, on a screen 100% of purchasing users reach.
- "Continue" is below nine fields with no sticky footer at common mobile viewport heights.
- A declined payment shows "Transaction failed (code 51)" with no explanation and no next step.
- Back from step 3 returns to step 1, discarding steps 1 and 2.
- Errors appear in a banner at the top of a long form, with no indication of which field failed.

**`medium`**
- The postcode is typed manually although the address lookup already holds it: one avoidable
  field on every use.
- The date format is `DD/MM` on one screen and `MM/DD` on the next: re-reading required each
  time, and a real error risk for ambiguous dates.
- Search requires an exact match, so a near-miss returns nothing rather than a suggestion.
- The success message disappears after two seconds, before it can be read.

**`low`**
- One screen says "Remove", another says "Delete", for the same action.
- The help link opens in the same tab, losing the flow's place — but the flow's state survives.
- A tooltip states a rule that is already stated in the field's helper text.

**`info`**
- "Users may not understand what 'reference' means here — worth testing." No data, so no claim.
- "Competitors default this to the last-used value; may be worth trying."

---

## The frequency multiplier

Severity alone under-ranks small problems on high-traffic screens and over-ranks large
problems on screens nobody visits.

```
priority = severity × reach
reach    = share of users who hit this state × how often they hit it
```

Applied concretely:

| Situation | Adjustment |
|---|---|
| On a screen 100% of users pass through | Raise one level (`medium` → `high`) |
| On a path fewer than ~5% take | Lower one level, unless the severity is `critical` |
| Encountered once per user, ever (onboarding) | Keep as assessed; first impressions carry weight |
| Encountered many times per day (an operator's daily tool) | Raise one level — small frictions compound |
| `critical` | **Never lowered by low frequency.** Data loss for 2% of users is still data loss |

State the frequency assumption in every finding's `summary`. Where it is a guess rather than
a measurement, set `confidence: low` and put the number that would settle it in the handoff's
`openQuestions`. An honest "I assume most users reach this; analytics would confirm" is
credible. A confident percentage invented on the spot destroys the whole report.

---

## Evidence hierarchy

Rank your basis for each finding and let it set `confidence`.

| Rank | Evidence | `confidence` |
|---|---|---|
| 1 | Observed user behaviour (session recordings, moderated test, support tickets clustering on this screen) | `high` |
| 2 | Quantitative product data (funnel drop-off, error-event counts, retry rates) | `high` |
| 3 | Your own walkthrough of the running application, with the specific state reproduced | `medium`–`high` |
| 4 | Static analysis of the code: a missing state, an unguarded form, an unconstrained input | `medium` |
| 5 | An established principle applied to an observed design (Fitts, Hick, response-time thresholds) | `medium` |
| 6 | Analogy to another product | `low` |
| 7 | Personal preference | Not a finding |

Ranks 1–2 support a claim about *impact*. Ranks 3–5 support a claim about *risk*. Say which
you are making. "This will reduce abandonment by 12%" needs rank 1 or 2; "this creates a
foreseeable failure at step 3" is fully supportable at rank 3 or 4 and is what most reviews
should be claiming.

---

## The rejection test

Before a finding is written, complete this sentence:

> "A **&lt;persona&gt;** doing **&lt;task&gt;** encounters **&lt;specific state&gt;**, and as a result
> **&lt;specific wrong outcome&gt;**."

If any slot cannot be filled concretely, it is not a finding. Examples:

- Passes: "A first-time mobile buyer entering card details types the expiry as `3/26`; the
  field rejects it after submit with 'Invalid expiry date' and does not say what format it
  wants, so they guess."
- Fails: "The payment form feels cluttered." — no persona, no state, no outcome.
- Fails: "This should use a stepper component." — a solution with no problem attached.

This test is enforced mechanically in the SKILL's validation step (`failureScenario` must be
present and substantive), so a finding that fails it will not ship.

---

## Banned findings

These may not be filed as findings unless a user impact is demonstrated and stated:

- Inconsistent spacing, alignment or padding, with no described cost to the user.
- Colour, typeface or illustration preferences.
- "Looks dated", "not modern", "doesn't feel premium".
- "Competitor X does it differently" with no reasoning about the user's task.
- "Should use component Y" — a solution masquerading as a problem.
- Implementation critiques (state management, component structure). Those belong to
  `angular-engineer` and are a different review.
- Anything phrased as "users might be confused" with no state named and no evidence rank.

If a visual inconsistency genuinely costs the user something — the primary action is not
recognisable as primary, two different-looking controls do the same thing — then file it, and
say what it costs. That is the difference between a usability finding and a style opinion.

---

## Writing the remediation

Every finding's `remediation` names which of the six options (SKILL.md step 6) it applies:

1. Remove the step or decision — 2. Default it — 3. Derive it — 4. Defer it —
5. Prevent the error — 6. Clarify it.

```
remediation: "Option 5 (prevent). Replace the free-text expiry with two selects (month, year),
              or accept any of MM/YY, M/YY, MM-YY, MMYY and normalise on blur. Removes the
              error class entirely rather than improving its message."
effortHours: 3
```

A review whose remediations are all option 6 has stopped at the symptom. At least one
`critical` or `high` finding must propose option 1, 2, 3 or 5 — that is an exit criterion,
and it is the criterion that distinguishes a review that changes the product from a review
that changes the copy.

---

## Calibrating against another evaluator

Two evaluators, same flow, independently, then compare. Where severities differ by more than
one level, the disagreement is almost always about **frequency**, not about severity — one of
you assumed a state is common and the other assumed it is rare. Resolve it by naming the
assumption and, if possible, checking the data. Record both verdicts and the resolution; a
review that shows its disagreements is more trustworthy than one that shows none.
