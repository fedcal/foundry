# Task-based walkthrough and stress-case matrix

The heuristic pass finds violations of principles. This pass finds where a specific person
pursuing a specific goal actually gets stuck. Run both; they overlap less than you expect.

---

## Part 1 — Cognitive walkthrough

Fix the persona and the goal first (SKILL.md step 1). Then, for **every** screen and every
action the user must take on it, answer four questions in order:

| Q | Question | A "no" means | The fix lives in |
|---|---|---|---|
| Q1 | Will the user try to achieve the right effect here? | They do not know this step is what they need | Orientation: IA, step labelling, expectation set on the previous screen |
| Q2 | Will they notice that the correct action is available? | The control is invisible, below the fold, or does not look like a control | Discoverability: prominence, position, affordance (Gulf of execution) |
| Q3 | Will they connect that control with the effect they want? | The label does not describe the outcome | Labelling: verb naming the outcome, not `Submit`/`OK`/`Next` |
| Q4 | After acting, will they see that progress was made? | Nothing visibly changed, or the change is ambiguous | Feedback: status, confirmation, position in flow (Gulf of evaluation) |

Record the classification, not just the failure. "Users get confused here" produces
"make it clearer"; "Q2 fails — the primary action is below the fold at 1366×768" produces a
specific, testable fix.

### Writing it down

```
Screen 2: /checkout/details — action: proceed to payment
Q1 yes  — the step indicator says "2 of 4: Your details".
Q2 NO   — "Continue to payment" sits below 9 form fields; at 360x640 it is ~1.5 screens
          down and there is no sticky footer. First-time users scroll back up looking for it.
Q3 yes  — the label names the outcome.
Q4 yes  — navigation is immediate and the step indicator advances.
=> Finding: discoverability (Q2), high — every purchasing user reaches this screen.
   Fix (option 6 after 1-5 rejected): sticky action bar on viewports under 700px tall.
```

### Two personas, opposite conclusions

Run the walkthrough for the primary persona, then spot-check the secondary one. Where a fix
for the first-timer would slow the expert (an added confirmation, a wizard split), say so in
the finding rather than discovering it after the change ships.

---

## Part 2 — Stress cases

The happy path is designed. These are not, which is why they hold the findings. Run every
row; list the ones you ran in `metrics.stressCasesRun`.

| # | Case | How to run it | Expected behaviour | Severity if it fails |
|---|---|---|---|---|
| 1 | Back button, every step | Browser Back from each screen | Returns to the previous step with data intact; no duplicate submission | `high`–`critical` if state corrupts or an order duplicates |
| 2 | Refresh, every step | F5 mid-flow | Same state, or an explicit, honest "you'll need to start this step again" | `high` if silent data loss |
| 3 | Deep link | Paste a mid-flow URL into a new tab | Redirects sensibly with an explanation, or resumes | `medium`–`high` |
| 4 | Double submit | Double-click the submit button; press Enter twice | Exactly one action occurs; the control disables or the request is idempotent | `critical` if it charges or creates twice |
| 5 | Interruption | Leave for an hour, return | Work preserved, or an explicit warning before it is lost | `high` |
| 6 | Session expiry | Let the session lapse mid-form, then submit | Re-authenticate and return to the same place with the data intact | `critical` if the form is lost |
| 7 | Network drop mid-submit | Throttle to offline just after submitting | Clear state: it either happened or it did not; a retry that cannot duplicate | `critical` if ambiguous |
| 8 | Slow network | Throttle to a slow profile | Something meaningful on screen within 1 s; skeletons that match the final layout | `medium`–`high` |
| 9 | Server error | Force a 500 on the main request | Human-readable message, a retry, and a way to reach help | `high` |
| 10 | Validation storm | Submit an empty form | Errors grouped and summarised, focus or announcement directed to the first, data preserved | `high` |
| 11 | Boundary data | Longest realistic name, 0 results, 500 results, an emoji, a right-to-left string, a foreign address format | No truncation that loses meaning, no layout collapse, no crash | `medium`–`high` |
| 12 | Small viewport | 360×640 | Primary action reachable; no horizontal scroll; nothing important below two folds | `high` |
| 13 | Large viewport | 2560 px wide | Content does not stretch to unreadable line lengths (aim ~45–75 characters) | `low`–`medium` |
| 14 | Keyboard only | Complete the whole flow without a mouse | Completable | `critical` (also WCAG 2.2 SC 2.1.1 — hand the conformance side to `audit-accessibility`) |
| 15 | Zoom / large text | Browser text size at 200% | Nothing clipped, primary action still reachable | `medium`–`high` |
| 16 | Permission denied | Attempt the flow without the required role | Explains what is missing and how to get it — not a raw 403 | `medium` |
| 17 | Concurrent edit | Change the same object in two tabs | Conflict detected and explained; no silent last-write-wins on data the user cares about | `high` |
| 18 | Currency / locale | Switch locale | Dates, numbers, currency and address forms all follow | `medium` |

Cases 4, 6, 7 and 17 are the ones that produce `critical` findings most often, and the ones
teams test least. Start there when time is short.

---

## Part 3 — Reconstructing a flow from code alone

When there is no running application, build the flow from the source. Label the review
`static-only` and downgrade confidence on anything timing- or feedback-related.

```bash
FLOW=src/app/checkout

# 1. The route graph and its guards
grep -rn "path:\|canActivate\|canDeactivate\|resolve:\|loadComponent\|loadChildren" \
  src/app --include=*routes*.ts --include=*-routing*.ts

# 2. Navigation edges — where does each screen send the user?
grep -rn "router.navigate\|navigateByUrl\|routerLink" "$FLOW" --include=*.ts --include=*.html

# 3. What is asked of the user, per screen
grep -rn "formControlName\|<input\|<select\|<textarea\|matInput" "$FLOW" --include=*.html \
  | awk -F: '{print $1}' | sort | uniq -c | sort -rn

# 4. Validation rules — every one of these is a potential error message
grep -rn "Validators\.\|setValidators\|asyncValidator" "$FLOW" --include=*.ts

# 5. Error messages the user can actually see
grep -rniE "error|failed|invalid|required|sorry|oops" "$FLOW" --include=*.html | head -60

# 6. Are the non-happy states even implemented?
grep -rcE "@if|@else|\*ngIf" "$FLOW"/**/*.html
grep -rn "loading\|isLoading\|pending\|skeleton\|@placeholder" "$FLOW" --include=*.html | head -30
grep -rn "empty\|no-results\|nothing here" "$FLOW" --include=*.html | head -20

# 7. Unsaved-work protection
grep -rn "CanDeactivate\|canDeactivate\|beforeunload" src/app | head

# 8. Double-submit protection
grep -rn "exhaustMap\|\[disabled\]=\"submitting\|disabled=\"submitting" "$FLOW" | head
```

Interpretation:

- Command 3's counts are the required-input tally for the step table. A screen with 9 inputs
  in one form is a candidate for splitting or deriving.
- Command 4 lists every validation rule; each is a message the user will meet, and each is a
  candidate for error *prevention* instead (heuristic 5).
- Command 6 returning few hits means the non-happy states are not implemented at all — that
  is a finding in itself, not merely a gap in your evidence.
- Command 7 returning nothing means unsaved work is lost on navigation. Confirm and file it.
- Command 8 returning nothing means double-submit is likely possible. Stress case 4 becomes
  the first thing to verify the moment a running app is available.

Findings derived this way are **structural** — a missing state, an unprotected submit, a
9-field screen. They are legitimate and defensible. Findings about *perception* — whether the
label is understood, whether the feedback is noticed — cannot be established statically. Mark
those as hypotheses with `confidence: low` and name the study that would settle them.

---

## Part 4 — Turning findings into measurable targets

Every reviewed flow leaves behind numbers, so the next review is a comparison rather than a
fresh set of opinions.

| Metric | How to obtain it | Reasonable target |
|---|---|---|
| Task success rate | Moderated test, ≥ 5 participants, or funnel completion | ≥ 90% for a primary flow |
| Time on task | Timed walkthrough, first-timer and expert separately | Baseline first; then a stated reduction |
| Error rate per task | Count of validation failures and wrong turns per attempt | Trend down; set the ceiling from the baseline |
| Unaided recovery rate | Of users who erred, the share who recovered without help | ≥ 80% |
| Steps / decisions / required inputs | The step table in SKILL.md step 2 | Lower than the baseline, or a written reason |
| SEQ (Single Ease Question, 7-point) | One question after the task | ≥ 5.5 |
| SUS | 10-item questionnaire after the session | ≥ 68, the commonly cited average benchmark |
| Abandonment rate | Analytics funnel | Set from the baseline; name the target |

Five participants is enough to find most of the problems a moderated task test will find, and
is nowhere near enough to make a claim about conversion. Say which you are doing. Presenting a
5-participant result as a percentage improvement is the fastest way to lose the room's trust
in every finding you file afterwards.
