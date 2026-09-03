---
name: write-adr
description: Produce a validated adr.v1 artifact and render the matching docs/adr/NNNN-slug.md file from the Foundry MADR-derived template. Use when a decision is expensive to reverse, when superseding an earlier ADR, when a review finds an undocumented architectural choice, or when onboarding asks "why is it built this way". Handles number reservation, status lifecycle, the index and the memory fact.
user-invocable: true
argument-hint: "\"<decision title>\" [--supersedes NNNN] [--status proposed|accepted]"
metadata:
  foundry.vertical: dev
  foundry.io: "decision -> adr.v1 + docs/adr/NNNN-*.md + fact.v1"
license: Apache-2.0
---

# Write an ADR

An ADR is a receipt for a decision that will outlive the people who made it. It is written
**once, at the moment of the decision**, and never edited afterwards except to change its
`status` line. Changing your mind produces a *new* ADR that supersedes the old one.

If you are still deciding, you are not ready for this skill. Go back to `solution-architect`
(or `integration-architect`, or `domain-modeler`) and finish the option scoring first. This
skill records a decision; it does not make one.

## When to write one

Write an ADR when **any** of these is true:

- Reversal would cost more than rebuilding the affected component (one-way door).
- The choice constrains other teams, or a public contract.
- You rejected an option that a reasonable engineer would have picked.
- The decision trades one quality attribute away for another.
- Someone will ask "why not X?" within 12 months and there is no other written answer.

Do **not** write one for: naming conventions (that is a `fact.v1` type `convention`), library
patch upgrades, anything already fully implied by an accepted ADR, or a decision you can undo
in an afternoon.

## Procedure

### 1. Check whether the decision is already recorded

```bash
ls docs/adr/ 2>/dev/null | tail -20
grep -ril "<keyword>" docs/adr/ 2>/dev/null
```

Also search project memory: `mcp__plugin_foundry-core_foundry__memory_search` with `type: decision`. If a matching
ADR exists and is `accepted`, you are **superseding**, not creating — jump to §6.

### 2. Reserve the number atomically

Numbers are 4-digit, zero-padded, starting at `0001`, never reused, never renumbered. Two agents
writing in the same wave will otherwise collide, so create the file exclusively rather than
checking-then-writing:

```bash
mkdir -p docs/adr
node -e '
const fs=require("fs"),p="docs/adr";
const used=fs.readdirSync(p).filter(f=>/^\d{4}-.*\.md$/.test(f)).map(f=>+f.slice(0,4));
let n=(used.length?Math.max(...used):0)+1;
const slug=process.argv[1];
for(;;n++){const f=`${p}/${String(n).padStart(4,"0")}-${slug}.md`;
  try{fs.writeFileSync(f,"",{flag:"wx"});console.log(f);break}catch(e){if(e.code!=="EEXIST")throw e}}
' "<kebab-slug>"
```

`{flag:"wx"}` fails if the file exists, so the loop advances instead of overwriting somebody
else's ADR. The printed path is your file.

**Slug rules:** kebab-case, ASCII, ≤ 6 words, states the *decision* not the *topic*.
`use-postgres-for-the-event-store`, not `database-decision`. Never `adr`, `new`, `final`, `v2`.

### 3. Fill the template

Copy `${CLAUDE_PLUGIN_ROOT}/skills/write-adr/references/template.md` verbatim into the reserved
file and replace every `<…>` placeholder. A remaining `<` in a committed ADR is a defect —
grep for it before finishing.

Section rules that decide whether the ADR is worth anything:

| Section | Rule |
|---|---|
| Title | `NNNN. <verb> <object>` — an assertion, not a question. Max 120 chars (schema limit). |
| Status | one of `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`. Nothing else. |
| Context | what forced the decision *now*. Present tense, no solution words. If it does not explain the timing, it is background, not context. |
| Decision drivers | ≥ 3, each ending in a **number with a unit**. "Must be fast" is not a driver. |
| Considered options | ≥ 2 (the schema enforces `minItems: 2`), differing structurally. Always include "keep what we have". |
| Decision outcome | one sentence starting "We will …", then *because*, tied to the driver that dominated. |
| Consequences | positive, negative, risks. At least one negative must name the sacrificed quality attribute. |
| Fitness function | the exact command that fails when the decision is violated. |
| Compliance / review date | when this gets re-examined, or `n/a — permanent`. |

Options must be scored, not just listed. The template carries a table; fill every cell. A blank
cell means the option was not actually considered.

### 4. Emit the `adr.v1` artifact

The markdown file is for humans; the artifact is what other agents consume.

```
mcp__plugin_foundry-core_foundry__blackboard_write
  wave:   <current wave>
  agent:  <your agent name>
  schema: adr.v1
  data:   { schema, producedBy, number, title, status, date, deciders,
            context, drivers[], options[{name,pros[],cons[],cost}],
            decision, consequences{positive[],negative[],risks[]}, supersedes }
```

Field mapping that trips people up:
- `number` is an **integer** (`7`), while the filename is zero-padded (`0007-…`).
- `date` is `YYYY-MM-DD` — take it from the environment/prompt; never invent it and never call
  `Date.now()` inside a workflow (it throws).
- `supersedes` is an integer or `null`. Omitting it is legal; guessing it is not.
- `options[].cost` should carry three numbers: build effort, monthly run cost, **cost to reverse**.

Then validate explicitly — do not assume:

```
mcp__plugin_foundry-core_foundry__contract_validate  { schema: "adr.v1", path: ".foundry/blackboard/<wave>/<agent>.json" }
```

The `PostToolUse` hook `validate-contract.mjs` also checks it and will hand you the errors.

### 5. Record the fact and update the index

One `fact.v1` per **accepted** ADR, written through `mcp__plugin_foundry-core_foundry__memory_write` (never by
hand — it assigns ids and maintains `supersedes` chains):

```yaml
type: decision
scope: project              # or module:<name>
title: <the decision itself, <=80 chars, not the topic>
confidence: high
source: adr-0007
```

Body ≤ 120 words, and because the type is `decision` it **must** contain `**Why:**` and
`**How to apply:**` lines.

Then append a row to `docs/adr/README.md` (create it with the header if missing):

```markdown
| # | Title | Status | Date | Supersedes |
|---|-------|--------|------|------------|
| [0007](0007-use-outbox-for-order-events.md) | Use a transactional outbox for order events | accepted | 2026-08-27 | — |
```

### 6. Superseding an existing ADR

Never edit the old ADR's body. Exactly three operations:

1. Write the new ADR with `supersedes: <old number>` and a `Supersedes ADR-NNNN` line under the
   status.
2. In the old file, change **only** the status line to
   `Status: superseded by [ADR-0012](0012-<slug>.md)` and the `status` field to `superseded`.
   Leave every other character untouched — the historical reasoning is the point.
3. Write a new `fact.v1` whose `supersedes` names the old fact id.

If the old decision was simply wrong rather than outgrown, say so in the new ADR's context in
one plain sentence. Blame-free, but explicit: future readers need to know the old reasoning was
flawed, not merely dated.

### 7. Verify before claiming done

```bash
grep -n "<" docs/adr/NNNN-*.md            # no leftover placeholders
grep -c "^## " docs/adr/NNNN-*.md         # all template sections present
node -e 'JSON.parse(require("fs").readFileSync(".foundry/blackboard/<wave>/<agent>.json","utf8"))'
```

If `superpowers` is installed, run `superpowers:verification-before-completion`. If it is not,
run the checklist below manually and say in your reply that verification was unassisted.

## Quality gate

Refuse to report done unless all hold:

- [ ] File name matches `^docs/adr/\d{4}-[a-z0-9-]+\.md$` and the number is unique.
- [ ] `adr.v1` validates via `contract_validate` — confirmed, not assumed.
- [ ] ≥ 2 options, each with ≥ 2 pros and ≥ 2 cons and a filled `cost`.
- [ ] ≥ 3 drivers, each with a number and a unit.
- [ ] Decision outcome is one sentence beginning "We will".
- [ ] ≥ 1 negative consequence naming the sacrificed quality attribute.
- [ ] A fitness function with a runnable command.
- [ ] Zero `<placeholder>` markers remain.
- [ ] `docs/adr/README.md` row added; `fact.v1` written via `memory_write` if status is `accepted`.
- [ ] If superseding: old file's status line changed and nothing else.

## Progressive disclosure

| File | Load when |
|---|---|
| `references/template.md` | always — it is the artifact you fill in |
| `references/example.md` | you have not written an ADR in this repo before, or the reviewer disputed the quality of the options |
| `references/lifecycle.md` | changing a status, superseding, deprecating, or reviving a rejected option |

## What this skill deliberately does not cover

- **Making the decision.** No option generation, no scoring rubric — that is `solution-architect`
  step 3–5. This skill will happily record a bad decision beautifully.
- **RFC/design-doc writing.** An ADR is one decision on one page. Multi-decision design documents
  belong in `docs/design/` and are out of scope here.
- **Requirements.** Use `requirement.v1` and `domain-modeler`.
- **Plans and sequencing.** Use `superpowers:writing-plans` and `plan.v1`.
- **Retro-documenting an entire legacy system.** Batch archaeology needs a dedicated sweep with a
  context firewall; this skill writes one ADR at a time.
- **Approval workflow.** Foundry does not model sign-off; `status: proposed` + `deciders[]` is
  the whole mechanism.
