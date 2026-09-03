# Sprint Goal — the two tests, worked

A Sprint Goal is the commitment of the Sprint Backlog. It is one sentence describing an outcome,
and it is what makes scope negotiable during the Sprint: items can be dropped as long as the Goal
still holds.

## Test 1 — Droppability

Name at least one selected item that could be cut with the Goal still met.

If nothing can be cut, there is no Goal — there is a scope with a sentence attached. This is the
most common failure, and it costs exactly when the Sprint gets tight: with no Goal, every item is
equally mandatory, so nothing gives, so the Sprint overruns or the Definition of Done bends.

## Test 2 — Falsifiability

State, at Planning, how the Review will decide met or not met. If two reasonable people could
disagree afterwards, the Goal is not falsifiable.

## Worked examples

| Candidate | Verdict |
|---|---|
| "Make progress on checkout" | Fails both. No outcome, unfalsifiable. |
| "Finish tickets 412, 415, 418 and 421" | Fails droppability. It is the scope restated. |
| "Improve performance" | Fails falsifiability. No threshold, no subject. |
| "A returning customer can complete checkout with a saved card" | Passes. Items enabling saved-card retrieval can be cut if the flow works another way. |
| "The nightly reconciliation job finishes inside its 2-hour window" | Passes. A number decides it. |
| "Reduce checkout p95 latency below 1.2s in production" | Passes. Measurable, and several implementation routes exist. |

## Shape that tends to work

> *`<who>` can `<do what>`, evidenced by `<observable>`.*

or, for work with no user-visible surface:

> *`<system>` `<does what>` within `<threshold>`.*

## When a Sprint genuinely has no single Goal

Sometimes the Sprint is maintenance, or three unrelated obligations landed together. Two honest
responses:

1. **Say the Sprint has no Goal**, and record that the framework's scope-flexing mechanism is
   unavailable this cycle. Do not invent a Goal to satisfy a template — a decorative Goal is
   worse than a stated absence, because it looks like the mechanism is working.
2. **Ask whether the cadence still earns its cost.** Repeated goal-less Sprints are the clearest
   signal that the work is flow-shaped, and that Kanban with WIP limits fits better than Scrum.
   Route that comparison to `foundry-pmo:flow-analyst`.

## Cancelling a Sprint

Only the Product Owner may cancel a Sprint, and the trigger is the Goal becoming obsolete — not
the team being behind. Being behind is a scope conversation. Obsolescence is when delivering the
Goal would no longer be worth anything, at which point continuing is pure waste.
