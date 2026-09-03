# Scoring sheet and the three attacks

## The weight sheet

Written and timestamped **before** candidates are named. Store at
`.foundry/scratch/<session>/weights.md`.

```
decision : <what is being chosen>
fixed at : YYYY-MM-DD HH:MM (from args; never Date.now() inside a workflow)
source   : requirement.v1 ids <...>

| Dimension            | Weight | Measure that decides the score                       |
|----------------------|--------|------------------------------------------------------|
| Fit to requirements  |     25 | count of acceptance criteria met with no new component |
| Maintenance health   |     20 | bus factor, cadence shape, triage median              |
| Licence compatibility|     15 | pass/fail against our licence and distribution model  |
| Operational burden   |     15 | components added, backup/restore, paging surface      |
| Exit cost            |     10 | engineer-days to remove after 12 months in production |
| Integration cost     |      8 | engineer-days to first production use here            |
| Security posture     |      7 | disclosure policy, backport policy, advisory latency  |
| Team capability      |      0 | named people who can debug it under pressure          |
|                      | **100**|                                                       |
```

Rules:
- Weights are integers summing to exactly 100.
- Dimensions at 0 stay in the table, so the reader sees they were considered and dropped.
- At most three dimensions above 15. Evaluation is triage; if everything matters, nothing does.
- Weights come from the requirements and the business. If nobody will own them, record
  `deciders: ["<unassigned>"]`, set the ADR `status: proposed`, and say the weights are your
  assumption.

## The score sheet

```
| Dimension            | W  | Candidate A | Candidate B | Do nothing |
|----------------------|----|-------------|-------------|------------|
| Fit to requirements  | 25 | 4 [e1]      | 5 [e2]      | 2 [e3]     |
| Maintenance health   | 20 | 5 [e4]      | 3           | 5 [e5]     |
| ...                  |    |             |             |            |
| **Weighted total**   |    | **371**     | **352**     | **288**    |
```

Scoring rubric:

| Score | Meaning |
|---|---|
| 5 | Meets the dimension's measure with headroom, evidenced |
| 4 | Meets it, evidenced |
| 3 | Plausibly meets it, **no evidence** — must generate a spike task |
| 2 | Meets it partially, with a named gap |
| 1 | Meets it only by adding components not in this option |
| 0 | Structurally cannot meet it |

**Evidence discipline.** Every 4 and 5 carries a bracketed pointer `[eN]` resolving to an entry
in the evidence register below. **A 5 with no pointer is automatically demoted to 3.** This one
rule removes most of the wishful thinking from technology comparisons.

```
[e1] https://…/docs/limits  (published 2026-03-11, retrieved YYYY-MM-DD) — states the ceiling
[e2] benchmark: `<exact command>` run on <hardware>, output at .foundry/scratch/<session>/b2.txt
[e4] git log measurement, see maintenance-signals record for candidate A, measured YYYY-MM-DD
```

## Attack 1 — Weight flip

Swap the top two weights and recompute.

- **Winner unchanged** → the decision is robust to reasonable disagreement about priorities.
  Record that.
- **Winner changes** → this is a *values* decision, not a technical one. Set ADR
  `status: proposed`, name the deciders, and present both winners with the weighting each
  requires. Do not pick one and hope.

## Attack 2 — Evidence haircut

Reduce every unevidenced 3 by one point and recompute.

- **Winner unchanged** → the recommendation stands on measured ground.
- **Winner changes** → the recommendation rests on assumptions. Do not emit a decision. Emit a
  time-boxed spike instead:

```
spike     : <the single question the spike answers>
timebox   : <hours>
success   : <the observation that settles it, stated in advance>
blocks    : ADR <slug>
```

## Attack 3 — Steel-man the runner-up

Write the strongest honest case for second place, as its advocate would. Then convert it into
the mandatory sentence in `decision`:

> **Strongest argument against:** Candidate B's file-per-tenant model would have made the
> multi-region requirement in REQ-014 a configuration change rather than a migration, and if
> that requirement arrives within a year our recommendation costs roughly <N> engineer-days
> more than choosing B today.

Quality bar for this paragraph:

- It names a **specific** future condition, not a vague risk.
- It quantifies the regret, in days or money.
- It would be recognised as fair by someone who prefers the runner-up.
- It is not immediately rebutted in the same paragraph. Rebutting your own counter-argument is
  how you hide it.

If the paragraph comes out weak, the alternatives were weak. Return to candidate sourcing; do
not ship the ADR.

## Tie-breaking

If the top two are within **10%** of each other on weighted total, declare a tie explicitly and
break it on **exit cost**: recommend the option that is cheaper to undo, and state that
reversibility — not superiority — was the deciding factor.

This is the honest outcome far more often than a decisive margin, and saying so protects the
next team from believing a coin flip was a conclusion.

## Decision class

State it in the ADR `context`:

- **One-way door** — reversal costs more than the original build (data model, public API shape,
  identity provider, storage engine, licence-bound platform). `status: proposed`, human decider
  required.
- **Two-way door** — reversible in under a sprint. Decide, record the exit path, move on.

Spending one-way-door process on a two-way-door decision is its own failure mode: it is slow,
and it trains people to route around the process next time.

## Common ways this sheet gets gamed

| Move | Tell | Countermeasure |
|---|---|---|
| Weight tuning after scoring | weights file timestamp is after the score sheet | timestamps are recorded; a change forces a full rescore and a note in `context` |
| Straw-man alternatives | the runner-up's steel-man is one weak sentence | attack 3 fails the gate |
| Dimension invention | a dimension appears that no requirement supports | every dimension cites a `requirement.v1` id |
| Evidence inflation | pointers resolve to marketing pages | open every pointer; a page that does not contain the claim is a phantom reference |
| Baseline omission | "do nothing" is missing | gate 2 blocks |
| Score compression | every candidate scores 3–4 everywhere | the measures are too vague; rewrite them as thresholds with units |
