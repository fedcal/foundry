# Judge bias controls

A judge model is an instrument with known, reproducible measurement errors. These are the
controls that make its output usable; each one is cheap, and skipping any of them has produced
published-then-retracted internal results.

## Position bias (pairwise comparison)

Judges favour one position — commonly the first — regardless of content.

**Control.** Run every pairwise comparison twice with the options swapped. Keep only the
comparisons where both orders agree; count the disagreements as ties. Report the disagreement
rate: above roughly one in five, the criterion is not discriminating and needs rewriting rather
than more runs.

Prefer single-item scoring against a rubric over pairwise ranking whenever a rubric is possible.
Pairwise is for preference questions with no rubric, and it costs twice as much for this reason.

## Verbosity / length bias

Longer answers score higher, independently of correctness.

**Control.** Record the length of every graded output and compute the correlation between length
and score. A strong positive correlation on a correctness criterion is evidence of bias, not of
long answers being better. Mitigations: state a length expectation in the rubric, score
conciseness as its own criterion, and compare candidates with similar length budgets.

## Self-preference

A judge prefers text produced by its own family or in its own style.

**Control.** Judge with a model family different from the generator wherever the budget allows.
When it is impossible, say so in the report — a same-family judge comparing that family against a
competitor is not a fair comparison and must never be published as one.

## Prompt sensitivity and drift

Rewording the rubric moves the scores; a provider-side model update moves them without any change
on your side.

**Control.** Freeze the judge prompt in a file, hash it, and record the hash with every run. Pin
the judge model id and version. Re-run the calibration set after any change to model, prompt or
rubric, and at least every 90 days. Plot scores over time: an unexplained step change is a judge
change until proven otherwise.

## Canaries

**Control.** Seed each judged run with a small set of items whose verdict is known and stable —
some obviously passing, some obviously failing, including one subtly-wrong item that the judge
was verified to catch during calibration. If a canary flips, the run is void and the results are
discarded, not interpreted. This is the only mechanism that catches silent judge degradation
between calibrations.

## Fluent falsehood

Judges are poorly calibrated on confident, well-written, wrong answers — the exact failure mode
that matters most in production.

**Control.** Never ask a judge to assess factual correctness from its own knowledge. Always pass
the reference or the sources and phrase the criterion as a containment question. If no reference
exists, the property is not judge-measurable: route it to human review and say so.

## Score compression

Almost everything scores "good" and the metric stops discriminating.

**Control.** Binary criteria with hard anchors. If the pass rate exceeds ~95% on a criterion, it
has stopped carrying information: either the system genuinely solved that property (retire the
criterion to a smoke check) or the criterion is too easy (tighten the anchors).

## Reasoning capture

**Control.** Always require the reason before the verdict, and store it. Reasons are how you find
a criterion that the judge is systematically misreading; a bare verdict is unauditable. Sample
20 reasons per run and read them — this five-minute habit catches more broken evals than any
statistic.

## What none of these fix

Judges cannot verify facts absent from the material you give them, cannot assess consequences in
the world, and cannot substitute for a domain expert on a specialist question. When the stakes
justify it, the answer is human review on a sample, budgeted and scheduled — not a better judge
prompt.
