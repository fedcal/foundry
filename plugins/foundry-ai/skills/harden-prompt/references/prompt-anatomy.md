# Prompt anatomy, section by section

The ordering below is the default. Deviate with a reason, written down.

## 1. Role and objective

One or two sentences, concrete and behavioural.

**Before.** "You are a world-class, highly intelligent AI assistant with deep expertise across
many domains. You always give the best possible answer."

**After.** "You classify inbound support tickets into exactly one category from the CATEGORIES
enum, using only the ticket text."

The first version costs tokens in every request and constrains nothing. The second tells the model
what the output space is, which is the only thing a role line can usefully do.

## 2. Hard constraints

The rules that hold regardless of input. Phrase positively — "answer only from `<sources>`" — and
add the negative form only where ambiguity remains. Keep this block short: a list of twenty
constraints is not followed as reliably as a list of five, and it usually contains contradictions.

Constraints belong here and nowhere else. Duplicating a rule in three places with three slightly
different wordings is how contradictions enter a prompt.

## 3. Procedure

When the task has an order, number the steps. Enumerated procedures are followed more reliably
than prose describing the same sequence.

```
1. Read <ticket>.
2. If the ticket names a product not in <products>, output category "other".
3. Otherwise choose the single closest category from CATEGORIES.
4. Output the JSON object described in OUTPUT.
```

Note step 2: the edge case is placed *before* the general rule, because a general rule stated
first tends to absorb the exception.

## 4. Output contract

State the schema exactly, and state what to emit when the model cannot comply. If the runtime
supports constrained decoding or a typed tool call, this section shrinks to a summary and the
schema does the work.

Always include the escape hatch. A prompt with no legal way to say "I cannot" forces a
fabrication.

## 5. Examples

Only if they earn their cost. Three diverse, hard examples beat ten easy near-duplicates. Keep the
format byte-consistent: the model copies formatting, including a trailing comma that makes the
JSON invalid.

Include an abstention example whenever abstention is a required behaviour, and check the label
balance — skewed examples skew the output distribution.

## 6. Context

Delimited, labelled, with provenance per item:

```
<sources>
[doc-882 | Contract 2024/88 | Art. 7 | effective 2024-06-01]
...text...
</sources>
```

Provenance lets the model prefer authoritative or recent material and lets you validate citations
afterwards. Deduplicate before assembly; repeated near-identical chunks bias the answer by
repetition alone.

## 7. The request, then the restated instruction

Put the user's actual request last. When the context is long, restate the task after it: material
in the middle of a long context receives the least attention, and a task statement buried above
forty pages is a coin flip.

## Ordering for cache friendliness

Stable content first (role, constraints, procedure, examples), volatile content last (context,
request). A single character changed early invalidates any prefix cache for everything after it.
Confirm the provider's caching semantics before contorting the layout — and if there is no
caching, do not keep an awkward ordering that buys nothing.

## What to delete on sight

- Filler authority and superlatives.
- Threats ("this is very important to my career"), bribes, and shouting used in place of a schema
  and a validator.
- Politeness padding repeated in every request.
- A rule restated in three sections with three wordings.
- A demand for step-by-step reasoning in a response whose consumer is a parser: give reasoning its
  own field, or drop it, and check whether the model tier already reasons before answering rather
  than pasting the instruction in by habit.
- Anything nobody can point at an eval item for. If no test would notice its removal, remove it
  and let the suite confirm.
