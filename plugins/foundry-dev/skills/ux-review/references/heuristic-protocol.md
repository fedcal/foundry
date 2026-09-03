# Heuristic evaluation protocol

Ten heuristics, one screen at a time. For each pairing record `pass`, `finding` or `n/a` —
recording passes is what makes the review falsifiable and what stops it reading as a list of
complaints.

Work heuristic-by-heuristic across all screens rather than screen-by-screen across all
heuristics: consistency problems (heuristic 4) are invisible from inside a single screen.

---

## 1. Visibility of system status

**Ask:** after every action, does something change within 100 ms, and is any wait over 1 s
explained?

**Check**

- Click every control and observe the delay before *any* visual response.
- ≤ 100 ms: no indicator needed. 100 ms – 1 s: a subtle indicator. > 1 s: an explicit
  indicator with a determinate progress bar if the duration is knowable. > 10 s: the
  operation should be backgrounded with a notification on completion, not a spinner.
- Is the user's position in a multi-step flow visible? Step 3 of 5, or nothing?
- After a successful action, is success stated, or does the UI simply stop being busy?
- Are optimistic updates rolled back visibly when the server rejects them?

**Angular failure modes:** a `resource()`/HTTP call with no `loading` branch rendered; a
spinner that replaces the entire page instead of the affected region (destroying scroll
position and focus); optimistic UI that silently reverts; `@defer` with no `@placeholder`,
so nothing at all appears while the chunk loads.

**Evidence:** measured delay, and a description of what appears during it.

---

## 2. Match between the system and the real world

**Ask:** does every label use the user's word?

**Check**

- Grep the labels; list every noun. Which are internal terms leaking out?
  `grep -rhoE ">[A-Z][A-Za-z ]{2,30}<" src/app/<flow>/**/*.html | sort -u | head -50`
- Entity names from the database schema (`Entity`, `Record`, `Item`, `Resource`, `Config`).
- Status values shown raw (`PENDING_APPROVAL`, `TXN_FAILED_3DS`).
- Icons whose meaning is not conventional and carry no text label.
- Ordering that reflects the schema rather than the task (alphabetical when chronological is
  what the user thinks in).
- Compare with the words used in support tickets, search queries or sales calls if available.

**Evidence:** the raw string as displayed, and the word the user actually uses.

---

## 3. User control and freedom

**Ask:** can the user get out, go back and undo?

**Check**

- Every destructive action: is it undoable, or at minimum confirmed with a specific label
  naming the object and the consequence?
- Browser Back at every step: does it work, and does it corrupt state?
- Cancel on every dialog and every multi-step flow — and does cancel discard silently, or
  warn about unsaved work?
- `Escape` closes overlays.
- Can the user change an earlier answer without restarting the flow?
- Are auto-applied changes (auto-save, auto-format, auto-correct) reversible and visible?

**Angular failure modes:** state kept only in a component that a route change destroys;
`CanDeactivate` guard missing on a long form; a wizard implemented as sibling routes with no
shared state, so Back loses everything.

---

## 4. Consistency and standards

**Ask:** does the same concept look, read and behave the same everywhere?

**Check**

- Synonym hunt across the flow: `grep -rniE "delete|remove|discard|trash|clear" src/app/<flow> --include=*.html`
  Four words for one action is a finding.
- Is the primary action always in the same position relative to the secondary one?
- Are dates, currencies and numbers formatted identically everywhere?
- Do equivalent controls behave equivalently (does every "Save" save immediately, or does one
  of them queue)?
- **Jakob's law**: where the product deviates from a platform or web convention, what does the
  deviation buy? If nothing, it is a cost.

**Evidence:** the two or more places that disagree, with file paths.

---

## 5. Error prevention — half your time belongs here

**Ask:** is the invalid state *unreachable*, rather than merely rejected afterwards?

**Check**

- For every validation message the flow can produce, ask what input design would make it
  impossible. A date picker instead of a free-text date. A constrained select instead of a
  typed code. Disabled past dates instead of "date must be in the future".
- Are destructive and constructive actions adjacent? Distance, not just colour, prevents
  mis-clicks (Fitts's law).
- Does the form accept the value in any reasonable format and normalise it (spaces in a card
  number or IBAN, `+44` vs `0`, `1.000,50` vs `1,000.50`)? Rejecting a space is a
  self-inflicted error.
- Are limits stated **before** the user hits them (max file size, character count, item cap)?
- Is a double-submit possible? Is a duplicate order possible?
- Are defaults the safe choice, or the destructive one?

**Evidence:** the specific input that produces the error, and the input design that would
prevent it.

---

## 6. Recognition rather than recall

**Ask:** does the user ever have to remember something?

**Check**

- Walk the flow with nothing written down. Is any value shown on one screen and required on
  a later one (a reference code, a total, a chosen option)?
- Is previously entered information visible at the confirmation step, or must it be recalled?
- Are options visible, or hidden behind a menu the user must know exists?
- Does search require exact syntax, or does it forgive?
- After an interruption of ten minutes, is there enough on screen to resume?

Working memory holds roughly four chunks. Requiring more is a design defect, not user error.

---

## 7. Flexibility and efficiency of use

**Ask:** is there a fast path for the person doing this for the fiftieth time?

**Check**

- Time the flow as a first-timer, then as an expert who knows exactly what to do. If the two
  are the same, there is no fast path.
- Keyboard: `Enter` submits, `Tab` order is sensible, shortcuts exist for repeated actions.
- Are previous values remembered and offered (addresses, payment methods, filters)?
- Is bulk action possible where users act on many items?
- Can a power user skip confirmations they have seen a hundred times, safely?

Note explicitly where optimising for the expert would harm the first-timer, and which one
this flow is being optimised for.

---

## 8. Aesthetic and minimalist design

**Ask:** does every element serve the current task?

**Check**

- Count the elements on the screen. For each, ask what breaks if it is removed.
- Is the primary action visually dominant, or competing with three others of equal weight?
- Is there more than one primary action? (There should not be.)
- How much of the first viewport is task-relevant? Cookie banners, promo bars, chat widgets
  and newsletter prompts commonly consume more than half of a mobile viewport.
- Promotional content inside a transactional flow is a distraction with a measurable cost.

**This heuristic is the one most often abused** to smuggle in aesthetic preference. A finding
here must name what the extra element costs the user: a missed primary action, a longer
scan, a wrong choice.

---

## 9. Help users recognise, diagnose and recover from errors — the other half of your time

**Ask:** does each error say what happened, why, and the one next action?

**Check**

- Trigger every error path: validation, network failure, timeout, permission denied, conflict
  (someone else edited it), expired session, payment declined.
- For each message, read it aloud. Does it contain a technical term, an error code with no
  explanation, or blame?
- Is the message next to the thing that is wrong, or in a banner far from the field?
- Is the user's data preserved? Losing a filled form on submit failure is `critical`.
- Is there an actual next action, or only a statement of failure?
- For a declined payment or a rejected upload: does the user know what to change?
- Is there a way out that is not "start again"?

**Evidence:** the message verbatim, the state that produced it, and what the user is expected
to do next.

---

## 10. Help and documentation

**Ask:** is help available at the moment of doubt?

**Check**

- Identify the hardest field or decision in the flow. Is help within one interaction of it?
- Is help contextual (this field, this step) or generic (a link to a knowledge base)?
- Is help text readable without dismissing it to continue (tooltips that vanish on the way to
  the field fail this, and also WCAG 2.2 SC 1.4.13)?
- Is there a route to a human where the stakes justify it?
- Does help appear consistently in the same place on every screen?
  (Related: WCAG 2.2 SC 3.2.6 Consistent Help — but conformance is `audit-accessibility`'s call.)

---

## Recording format

```
Screen: /checkout/payment
H5 Error prevention — FINDING
  Card expiry is a free-text "MM/YY" field. Users type "3/26", "03-26", "March 2026".
  All are rejected after submit with "Invalid expiry date".
  Impact: high — occurs on the payment step, which 100% of purchasing users reach.
  Fix (option 5, prevent): two constrained selects, or accept-and-normalise any of the formats.
H6 Recognition over recall — PASS
  Order total and item list remain visible on the payment step.
H10 Help and documentation — N/A (no help affordance in scope for this screen)
```

Every screen produces one such block per heuristic. Ten blocks × N screens is the pass; the
`metrics.heuristicsChecked` array in the artifact is the proof that none was skipped.
