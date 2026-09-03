---
name: ux-review
description: Run a heuristic plus task-based usability review of a flow and emit a review.v1 artifact whose finding severities are tied to user impact — task failure, data loss, error rate, abandonment — never to aesthetics. Use before building a flow, when a funnel leaks, when support tickets cluster on one screen, or when a redesign needs a defensible baseline. Not a visual critique and not an accessibility audit.
allowed-tools: Read Grep Glob Bash Write Edit
user-invocable: true
argument-hint: "<flow-name> [--routes /checkout,/checkout/payment] [--persona first-time|expert] [--out .foundry/blackboard/<wave>]"
model: opus
effort: high
metadata:
  foundry.vertical: dev
  foundry.io: "flow + routes -> review.v1 with impact-ranked usability findings"
license: Apache-2.0
---

# Usability review: heuristic evaluation + task walkthrough

Two passes, deliberately different in kind. The heuristic pass finds violations of known
principles. The task pass finds the places where a real person, pursuing a real goal, gets
stuck — which is frequently somewhere no heuristic points at.

**One rule governs the output: severity is a function of user impact, never of taste.**
"The spacing is inconsistent" is not a finding. "The primary action is below the fold on a
1366×768 laptop, so 30% of users never see it" is.

## When NOT to use this

- You need to test a specific hypothesis with statistical confidence. That is an experiment,
  not a review — hand it to the analytics owner.
- The question is whether the interface conforms to WCAG. Use `audit-accessibility`; it is a
  different standard with a different method and a different output.
- The question is "which of these two designs is nicer". Not answerable by this method and
  probably not worth answering.
- You are designing a flow that does not exist yet. Use `ux-architect` in design mode; come
  back here once there is something to walk through.

## Deliberately not covered

Visual design and brand critique, WCAG conformance (`audit-accessibility`), performance
(`frontend-performance-engineer`), implementation quality (`angular-engineer`), copy that is
legally mandated (legal vertical), and any claim about statistical significance. This review
produces prioritised, evidence-backed findings — not proof.

---

## Step 1 — Define the flow and the user, in writing, before looking at anything

Skip this and every later judgement becomes untethered opinion.

Record, in the artifact's `metrics`:

```
Flow:        Complete a first purchase as a guest
Persona:     First-time visitor, mobile, arriving from a search result
Entry point: /product/:id from an external referrer
Success:     Order confirmation visible, confirmation email queued
Frequency:   Once per user; ~40% of all sessions reach step 1
Cost of failure: Abandoned cart — direct revenue loss; ~£X per session at current conversion
Device/context: Phone, one hand, possibly poor network, possibly interrupted
Constraints: Payment provider redirect at step 4 cannot be modified
```

Two personas change every conclusion: a **first-time** user needs orientation and reassurance;
an **expert** repeating the task daily needs speed, defaults and keyboard access. A design
optimised for one usually penalises the other. Review for the persona that matters, name it,
and note where the other persona is harmed.

If you cannot name the user, the frequency and the cost of failure, say so explicitly and
mark every impact judgement `confidence: low`. Do not quietly proceed as if you knew.

## Step 2 — Map the flow as it actually is

Walk it end to end and record every screen, every decision and every input.

```bash
# Reconstruct the route graph from the code when you cannot click through the running app
grep -rn "path:" src/app --include=*routes*.ts --include=*-routing*.ts | head -60
grep -rn "router.navigate\|routerLink" src/app --include=*.ts --include=*.html | head -60

# Count what the flow asks of the user
grep -rn "formControlName\|<input\|<select\|<textarea\|matInput" src/app/<flow-dir> --include=*.html | wc -l
grep -rn "confirm(\|MatDialog\|openDialog" src/app/<flow-dir> --include=*.ts | wc -l
```

Produce a step table. This is the review's spine:

| # | Screen | What the user must decide | Inputs required | Can it be removed / deferred / defaulted / pre-filled? |
|---|---|---|---|---|
| 1 | /cart | Proceed or keep shopping | 0 | — |
| 2 | /checkout/details | 9 fields | 9 | 4 derivable from postcode lookup |
| 3 | … | | | |

**Totals are the headline metric**: number of screens, number of decisions, number of
required inputs. Record them. The single most valuable finding this method produces is
usually "step 3 is unnecessary", and you cannot see that without the count.

## Step 3 — Heuristic pass

Walk all ten heuristics against every screen. Record a verdict for each — including
"checked, no finding", so the review is falsifiable. The concrete question for each heuristic,
the evidence that settles it, and the per-heuristic checklist are in
`references/heuristic-protocol.md`.

| # | Heuristic | The question that matters here |
|---|---|---|
| 1 | Visibility of system status | Feedback within 100 ms of every action; anything over 1 s explained |
| 2 | Match with the real world | The user's words, not the database's |
| 3 | User control and freedom | Undo, back, cancel, escape — and does Back actually work? |
| 4 | Consistency and standards | Same concept, same word, same control, same place |
| 5 | Error prevention | Are invalid states unreachable, rather than merely rejected? |
| 6 | Recognition over recall | Nothing must be remembered between screens |
| 7 | Flexibility and efficiency | A fast path exists for the repeat user |
| 8 | Aesthetic and minimalist design | Every element serves the current task |
| 9 | Recognise, diagnose, recover | What happened, why, what to do next — and data preserved |
| 10 | Help and documentation | Help is in context at the moment of doubt |

Heuristics **5** and **9** account for most real damage. Budget your time accordingly:
half the heuristic pass on error prevention and recovery is a reasonable default.

Two independent evaluators find substantially more than one, and disagree usefully. If you
can run the pass twice (a second agent, a second person), do — and record both verdicts,
including where they diverge.

## Step 4 — Task-based walkthrough (the pass that finds what heuristics miss)

For each screen, in the persona's shoes, answer the four cognitive walkthrough questions:

1. **Will the user try to achieve the right effect?** Do they know this step is what they
   need? (If not: an *orientation* problem — labelling, IA, expectation setting.)
2. **Will they notice the correct action is available?** Is the control visible, above the
   fold, and recognisable as a control? (If not: a *discoverability* problem — Gulf of
   execution.)
3. **Will they connect that control with the effect they want?** Does the label describe the
   outcome? (If not: a *labelling* problem.)
4. **After acting, will they see that progress was made?** (If not: a *feedback* problem —
   Gulf of evaluation.)

A "no" at any question is a finding, classified by which question failed. That classification
determines the fix, and stops "make it clearer" from being the recommendation for everything.

Then run the stress cases, which is where the real findings live — full protocol in
`references/task-based-protocol.md`:

- The unhappy path: wrong password, declined card, expired session, network drop mid-submit.
- The interrupted path: leave halfway, come back an hour later. Is the work preserved?
- The back button, at every step. Does it corrupt state or duplicate a submission?
- Refresh, at every step. Same question.
- The impatient path: double-click submit. Does it charge twice?
- The boundary data: longest name, zero results, 500 results, a value from another locale.
- The slow path: throttle to a slow connection. What does the user see for four seconds?
- The small path: 360 px viewport. Is the primary action still visible without scrolling?

## Step 5 — Assign severity by impact, and defend it

The severity rubric, with worked examples and the calibration test, is in
`references/severity-and-evidence.md`. In brief:

| `severity` | Test |
|---|---|
| `critical` | The user cannot complete the task, loses data, or is led into an irreversible wrong outcome |
| `high` | Completes, but with frequent failure, repeated recovery, or real abandonment risk on a primary flow |
| `medium` | Costs time or attention on every use; users recover unaided |
| `low` | Inconsistency or unclear wording noticed only on close reading |
| `info` | Observation or hypothesis needing research; no action implied |

Then apply **frequency**: a `medium` problem on a screen 100% of users touch outranks a
`high` problem on one that 2% touch. State the frequency assumption per finding — and where
it is a guess, say `confidence: low` rather than dressing the guess as a measurement.

**The rejection test.** Before writing a finding, complete this sentence:

> "A <persona> doing <task> encounters <specific state>, and as a result <specific wrong
> outcome>."

If you cannot, it is not a finding. Delete it. This single test removes most of what makes
usability reviews easy to dismiss.

Banned as findings unless a user impact is demonstrated: inconsistent spacing, a colour you
would not have chosen, a component you would have built differently, "looks dated",
"not modern", or any comparison to a competitor with no reasoning about the user's task.

## Step 6 — Recommend the removal before the improvement

For every finding, generate remediation in this order and take the first that works:

1. **Remove the step or the decision.** Does the user need to make it at all?
2. **Default it.** Can we choose correctly for 90% of users and let the rest change it?
3. **Derive it.** Do we already hold this information, or can we infer it?
4. **Defer it.** Can it be asked after the commitment, when the user is more invested?
5. **Prevent the error.** A constrained input beats a validation message.
6. **Clarify it.** Better label, better copy, better affordance — the last resort, not the first.

A review whose recommendations are all "improve the copy" has not looked hard enough.

## Step 7 — Write the `review.v1` artifact

```json
{
  "schema": "review.v1",
  "producedBy": "ux-architect",
  "target": "Guest checkout flow: /cart -> /checkout/details -> /checkout/payment -> /checkout/confirm",
  "dimension": "usability",
  "verdict": "block",
  "metrics": {
    "persona": "First-time visitor, mobile, from search",
    "screens": 4,
    "decisions": 7,
    "requiredInputs": 14,
    "requiredInputsAfterRecommendations": 6,
    "heuristicsChecked": [1,2,3,4,5,6,7,8,9,10],
    "heuristicsWithFindings": [1,5,9],
    "stressCasesRun": ["back-button","refresh","double-submit","slow-network","360px","interrupted","declined-card"],
    "evidenceBase": "static walkthrough + analytics funnel (Apr-Jun)",
    "successMetrics": { "taskSuccessTarget": 0.90, "seqTarget": 5.5, "currentAbandonment": 0.41 }
  },
  "findings": [ /* finding.v1 objects */ ],
  "summary": "..."
}
```

Verdict rule, applied mechanically — no discretion:

| Condition | `verdict` |
|---|---|
| Any `critical` finding | `block` |
| Any `high` finding on the primary flow | `block` |
| `high` findings only on secondary paths, or `medium` findings | `pass-with-comments` |
| `low` / `info` only | `pass` |

Validate before finishing:

```bash
node -e '
const r=require("./<out>/ux-review.json");
if (r.schema!=="review.v1") throw new Error("wrong schema");
const bad=r.findings.filter(f=>!f.failureScenario || f.failureScenario.length<40);
if (bad.length){console.error("findings without a concrete failure scenario:",bad.map(f=>f.id).join(", "));process.exit(1);}
console.log("ok",r.findings.length,"findings");'
```

---

## Exit criteria

1. Flow, persona, success condition, frequency and cost of failure are all recorded — or
   explicitly marked unknown, with every impact judgement downgraded to `confidence: low`.
2. The step table is complete, with before/after counts for screens, decisions and required
   inputs.
3. All ten heuristics have a recorded verdict; `metrics.heuristicsChecked` lists all ten.
4. All four cognitive walkthrough questions answered for every screen.
5. Every stress case in step 4 executed and listed in `metrics.stressCasesRun`.
6. 100% of findings pass the rejection test in step 5 (verified by the script above).
7. Every finding's `remediation` names which of the six options in step 6 it applies, and at
   least one `critical` or `high` finding proposes removal or defaulting rather than copy.
8. Success metrics with numeric targets are defined for the flow.
9. Zero findings whose sole justification is appearance.
10. The artifact validates against `review.v1`; the returned summary is ≤ 300 tokens and does
    not paste the findings array.

## Degradation

- **No running application.** Reconstruct the flow from routes, templates and forms as in
  step 2. Say `metrics.evidenceBase = "static-only"`. Timing, feedback and stress-case
  findings cannot be confirmed — mark them `confidence: low` and phrase them as risks.
  A static-only review may not return `pass`; the best available verdict is
  `pass-with-comments`.
- **No analytics.** Every frequency claim is an assumption. State each one as an assumption
  in the finding's `summary` and list, in `openQuestions` on the handoff, the one number that
  would settle it.
- **No users available.** This method is expert review; it is a substitute for user testing
  only in the sense that it is cheaper. State plainly that findings are predictions. Recommend
  the cheapest study that would confirm the top three — usually a 5-participant moderated
  task test, which is enough for discovery and is not enough for a conversion claim.
- **`superpowers` installed.** Use `superpowers:brainstorming` when the flow's goal is
  genuinely unclear, and `superpowers:verification-before-completion` before emitting the
  verdict.

## References

- `references/heuristic-protocol.md` — the per-heuristic checklist, the question to ask, the evidence that settles it, and the failure modes seen most often in Angular applications.
- `references/task-based-protocol.md` — cognitive walkthrough script, the full stress-case matrix with expected behaviour, and how to reconstruct a flow from code alone.
- `references/severity-and-evidence.md` — severity rubric with worked examples, the frequency multiplier, the evidence hierarchy, and the list of banned findings.
