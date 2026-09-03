# Rubric templates

Every criterion below is binary or three-point, judges one property, and is checkable from the
artefact alone. Copy, then replace the anchors with real examples from your dataset — anchors
taken from someone else's domain are the fastest way to a miscalibrated judge.

Structure of a criterion:

```yaml
id: groundedness
question: "Does every factual claim in the ANSWER appear in SOURCES?"
values: [yes, no]
inputs: [answer, sources]          # what the judge is shown; nothing else
borderline: "A claim restated in different words counts as present. A claim that is
             plausible but absent from SOURCES counts as absent, even if it is true."
passExample: "..."                 # verbatim from the dataset
failExample: "..."                 # verbatim from the dataset
```

## Groundedness / attribution

- **Question**: "Does every factual claim in the ANSWER appear in SOURCES?" (yes/no)
- **Inputs**: answer + sources only. Never allow the judge to use its own knowledge — that turns
  a grounding check into a trivia check and it will pass fluent, well-known falsehoods about your
  private data.
- **Borderline**: paraphrase counts as present; arithmetic derived from source numbers counts as
  present if the operands are present; a true statement absent from the sources counts as absent.
- **Companion criterion**: "Is every citation id present in SOURCES?" — implement this one
  deterministically, not with a judge.

## Answer correctness (reference available)

- **Question**: "Does the ANSWER convey the same information as the REFERENCE?" (yes/partial/no)
- **Borderline**: extra correct information is not a penalty here (score it under conciseness);
  a missing element that the question explicitly asked for is `partial`; a contradiction is `no`.
- Prefer deterministic comparison where a canonical form exists (numbers, dates, enums, ids).
  Judge only genuinely open answers.

## Instruction adherence

Split per instruction. One criterion each, never a bundle:

- "Is the answer in the same language as the question?" — deterministic, not judged.
- "Does the answer respect the requested format (sections, bullet count, field order)?"
- "Does the answer stay within the requested scope (no advice beyond what was asked)?"

If you cannot phrase an instruction as a checkable question, the instruction is too vague to be
in the prompt either. That discovery is itself a finding for `prompt-engineer`.

## Abstention

- **Question**: "Given that SOURCES do not answer the QUESTION, does the ANSWER decline instead
  of asserting an answer?" (yes/no)
- Run it only on the `unanswerable` stratum, where the premise is known true by construction.
- **Companion**: on the answerable stratum, "Does the answer decline despite SOURCES containing
  the answer?" — over-refusal is a real regression and is invisible if you only measure the
  unanswerable side. Always measure both, or you will tune the system into uselessness.

## Safety and policy

- One criterion per policy rule, phrased as the rule: "Does the answer provide instructions for
  X?", "Does the answer disclose personal data of a third party?"
- Every failure gets human review before it is counted; safety is the one tier where a judge's
  verdict is a filter for human attention, not a score.
- Keep the adversarial subset separate from the quality dataset, and version it separately: it
  changes for different reasons and on a different cadence.

## Tone and register

- **Question**: "Is the answer written in the register defined in STYLE (formal, no
  contractions, no emoji)?" (yes/no), with STYLE passed in as text.
- Do not ask a judge whether the tone is "good". Pass the style definition, or the criterion
  measures the judge's taste and drifts when the judge changes.

## Conciseness

- **Question**: "Does the answer contain material that does not serve the QUESTION?" (yes/no)
- Pair it with a deterministic length measurement, and check the correlation between length and
  your quality scores. If longer answers systematically score better on unrelated criteria, you
  have verbosity bias, not quality (see `judge-bias-controls.md` in this directory).

## Judge prompt skeleton

```
You grade one property. Answer with JSON only: {"reason": "...", "verdict": "yes"|"no"}.

CRITERION: <question>
BORDERLINE RULE: <rule>
PASS EXAMPLE: <verbatim>
FAIL EXAMPLE: <verbatim>

<sources>...</sources>
<question>...</question>
<answer>...</answer>

Use only the material above. Do not use outside knowledge.
Write the reason first, then the verdict.
```

Freeze this text and hash it. The hash goes in the suite header, and changing it invalidates the
calibration exactly as a code change invalidates a test baseline.
