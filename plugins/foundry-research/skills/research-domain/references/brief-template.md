# Domain brief template

Nine sections, in this order, no additions, no reordering. The order is the argument: what we
asked, who does the work, how it is done, what the words mean, what binds it, what good means,
how it fails, what we do not know, and where every claim came from.

The brief is written to `.foundry/blackboard/<wave>/domain-researcher.json` as the artifact
referenced by a `handoff.v1`. It is never returned inline to a caller.

---

## 1. Question set

The verbatim caller question, then the 8–15 questions with their class, each marked
`answered` / `partially answered` / `dropped (<reason>)`.

Also state on the first line whether a practitioner was available. If not:
*"No practitioner access. Every workflow claim below is capped at confidence: medium."*

## 2. Actors

For each role: title as it appears in the field, where they sit organisationally, approximate
volume of work handled if a cited figure exists, the tools they use today, and — the part
teams skip — **what they are measured on**. A role's incentive predicts which features get used.

## 3. Current workflow

A numbered step list of the process **as it is done today**, including manual and off-system
steps.

| Step | Actor | Input | Output | Tool today | Duration | Rule-driven or habit-driven |
|---|---|---|---|---|---|---|

Rules:
- Minimum five steps. Fewer means the workflow was summarised, not observed.
- Every step is marked **rule-driven** (a named rule requires it — cite it) or **habit-driven**
  (it exists because it always has). This distinction is the brief's highest-value output:
  habit-driven steps are automation candidates, rule-driven steps are hard constraints.
- Mark any step reconstructed from documents rather than observation as `inferred`.

## 4. Glossary

| Term | Definition (sourced) | Authority | Counter-example | Collision |
|---|---|---|---|---|

- **Definition** in the practitioner's words, with a claim id.
- **Authority** — who decides the definition: a regulator, a standards body, the client.
- **Counter-example** — a thing that looks like the term but is not. This prevents a data model
  from quietly widening.
- **Collision** — where the word already means something else in the repository or an adjacent
  domain. Run `grep -riE "\b<term>\b" --include='*.{ts,tsx,java,py,go,rs,sql}' .` and record the
  result, including "no collision".

Target 10–30 terms. Three means insufficient reading; a hundred means a dictionary was
transcribed.

## 5. Regulatory frame

| Instrument | Jurisdiction | Article / section | Obligation (one sentence) | Who is liable | Consequence of breach | Consolidated text date |
|---|---|---|---|---|---|---|

Followed by two mandatory statements:

- **Jurisdictions examined:** …
- **Jurisdictions NOT examined:** …

Never paraphrase an obligation without its article number. Applicability to this product is a
legal judgement and is explicitly out of scope here — flag each row for legal review.

## 6. Quality bar

What an experienced practitioner considers excellent work, and what they consider sloppy.
Minimum three quality signals **that the current system cannot see**. These are the
requirements nobody writes down and the reason "we hit all our metrics and users hated it"
happens.

## 7. Known failure modes

How software in this domain has already failed, from post-incident reports, enforcement
notices, published audits, migration retrospectives and community threads about abandoned
rollouts.

Each entry has: the mechanism (not just the outcome), the source, and a restatement in the form:

> **This system will fail if** … *(condition)* … **because** … *(mechanism)*.

Minimum three. These become `fact.v1` entries of `type: domain`, tagged `failure-mode`, and
they are testable — a design review can check each one directly.

## 8. Contradictions and unknowns

- **Contradictions:** both statements, both tiers, both dates, the resolution rule applied.
- **Unknowns:** every `[UNVERIFIED]` claim, each with its verification route and why it is
  blocked.
- **Dropped questions** from §1 with their reasons.

## 9. Source register

Every claim record in full, in the format from `references/source-ladder.md`, plus the list of
search queries actually run per angle. A sweep nobody can re-run is not evidence.

---

## Fact emission mapping

After the brief is written, emit facts through `mcp__plugin_foundry-core_foundry__memory_write` only. Never write
memory files directly.

| Brief section | Fact type | Tags | Notes |
|---|---|---|---|
| §4 Glossary | `glossary` | `domain`, `<vertical>` | one per term; body carries definition + counter-example |
| §2 Actors, §3 Workflow | `domain` | `workflow`, `actor` | one per durable finding, not one per row |
| §5 Regulatory frame | `domain` | `regulatory`, `<ISO code>` | `source: external:<url>`, `expires` set if the text is over 24 months old |
| §6 Quality bar | `domain` | `quality-bar` | phrased as what a practitioner would criticise |
| §7 Failure modes | `domain` | `failure-mode` | body opens with "This system will fail if …" |

`confidence` on each fact is the ceiling from the source tier, never higher. `source` is the
claim id plus the external URL. `body` stays within 120 words.

## What must never appear in the brief

- Recommendations, feature ideas, architecture sketches, technology opinions.
- Any number, version, volume or percentage not read in an opened source.
- A paraphrased obligation without its article number.
- A workflow step presented as observed when it was inferred.
- A resolved contradiction without the rule that resolved it.
