# Facilitating an RFC window

The author writes the document. The facilitator keeps the discussion converging and makes sure
the record matches reality. On small projects they are the same person; say which hat you are
wearing when you switch.

## Cadence

| Day | Action |
|---|---|
| 0 | Announce in the canonical channel with the end date. Post the link, not a summary. |
| 3 | Nudge the specific people whose areas are touched (from `CODEOWNERS`). Silence from an owner is not consent. |
| 7 | Update the open-questions table. Post a status comment: settled / open / blocked. |
| 12 | Announce the intended disposition and open the final comment period. |
| 19 | Decide. |

## Handling objections

Classify every objection before answering it:

| Kind | Signal | Response |
|---|---|---|
| Factual | "this will break X" | Verify. If true, the RFC changes. If false, show the evidence once. |
| Design | "Y is a better mechanism" | Add it to *Alternatives* with a reason, whether or not you adopt it. |
| Scope | "this belongs elsewhere" | A governance question — the decision authority answers it, not the author. |
| Preference | "I would have done it differently" | Acknowledge, mark non-blocking, move on. |
| Process | "this went too fast" | Legitimate; extend once and say so. Repeated, it is a governance defect — hand to `governance-architect`. |

Write the resolution **into the document**. A thread reply is not a record.

## False consensus

Silence is only assent if people were told. Before invoking lazy consensus, verify: the
announcement was posted in the channel named in `GOVERNANCE.md`; every `CODEOWNERS` owner of a
touched path was mentioned; the window was ≥ the stated length; no objection is unresolved in
the table. If any of those fails, the window restarts — do not launder silence into approval.

## Deadlock

1. Separate the values question from the technical question and state each in one sentence.
   Most deadlocks are one of each, entangled.
2. Look for a decision that is cheaper to reverse and take it explicitly as a two-way door,
   with a review date.
3. Time-box a spike: implement the contested part behind a flag, measure, return with numbers.
4. If it is genuinely a values split, invoke the tie-break rule. Record that it was a values
   decision — that sentence prevents the same argument in six months.

## Scope creep during the window

New requirements arriving mid-discussion are the normal way an RFC dies. Rule: anything not in
*Goals* on day 0 either becomes a listed follow-up or restarts the window. Say which, out loud,
the first time it happens.

## Tone

- Thank objectors, especially the persistent ones. They are doing review work.
- Never resolve an objection by author authority alone: cite the evidence or the rule.
- Never settle it in a private call without posting the summary back within 24 hours; an
  unsummarised private decision is void under most `GOVERNANCE.md` texts, and should be.
- If the discussion becomes a conduct problem, stop facilitating and route to the Code of
  Conduct contacts. Those are different ladders and must not be mixed.
