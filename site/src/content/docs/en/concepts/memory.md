---
title: Memory
description: Four tiers, the fact schema, deduplication and supersedes chains, expiry instead of deletion, and what happens when the index exceeds its token budget.
sidebar:
  order: 2
---

A capable agent that forgets last week's decision is not a colleague. Foundry's memory exists to
make the next session cheaper and better informed than this one — and its central constraint is
that remembering more must not cost more per session.

## Four tiers

Never invent a fifth. Each tier is defined by how long its contents live and whether they belong
in git.

| Tier | Path | Lifetime | In git | What belongs there |
|---|---|---|---|---|
| T0 scratch | `.foundry/scratch/<session>/` | one session | no | Working files, intermediate output, anything you would delete without asking |
| T1 facts | `.foundry/memory/facts/<id>.md` | the project | yes | Atomic durable facts, one per file |
| T2 runbooks | `.foundry/runbooks/<slug>.md` | the project | yes | Procedures someone will repeat |
| T3 decisions | `docs/adr/NNNN-<slug>.md` | forever | yes | Architecture decisions, permanent and public |

T3 lives outside `.foundry/` on purpose. An ADR is a document for humans, reviewed in pull requests
and read by people who have never heard of Foundry.

Alongside the tiers sits `.foundry/blackboard/`, which is not memory: it holds validated artifacts
that agents hand each other within a run. See [Contracts](/foundry/en/concepts/contracts/).

## The fact schema

A fact is a markdown file whose frontmatter carries the metadata and whose body carries the claim.

```markdown
---
id: fact-0004
type: decision
scope: project
title: PostgreSQL 16 is the only supported database
tags: [database, postgres, migrations]
confidence: high
source: adr-0004
created: 2026-08-27
expires: null
supersedes: fact-0002
---

**Why:** we depend on MERGE and partition-wise joins; MySQL 8 has neither, and the
abstraction layer that would hide the difference costs more than supporting one engine.
**How to apply:** write migrations as plain SQL under `src/main/resources/db/migration`
and run integration tests against `postgres:16-alpine`.
```

| Field | Values | Notes |
|---|---|---|
| `id` | `fact-NNNN` | Assigned by `memory_write`, never chosen by you. Zero-padded to four digits, allocated as the highest existing number plus one |
| `type` | `decision`, `constraint`, `convention`, `domain`, `risk`, `metric`, `glossary` | Also controls index ordering and retrieval scoring |
| `scope` | `project`, `module:<name>`, `vertical:<name>` | Free text; defaults to `project` |
| `title` | ≤ 80 characters | States the fact itself, not the topic. "PostgreSQL 16 is the only supported database" is a title; "Database choice" is not |
| `tags` | list of strings | Scored at weight 2 in retrieval, so tags are a retrieval tool, not decoration |
| `confidence` | `high`, `medium`, `low` | Multiplies the retrieval score by 1.15, 1.0 and 0.8 |
| `source` | `adr-0007`, `conversation`, `code`, `external:<url>` | Where the claim came from |
| `created` | `YYYY-MM-DD` | Set when the fact is written |
| `expires` | `YYYY-MM-DD` or `null` | The date the fact stops being active |
| `supersedes` | a fact id or `null` | Maintained automatically when a fact replaces one with the same title |

Bodies should stay around 120 words. Facts of type `decision` and `risk` must contain a literal
`**Why:**` line — `foundry doctor` searches for exactly that string and fails without it — and by
convention a `**How to apply:**` line, so that a recorded decision changes behaviour rather than
just existing.

:::note[The fact.v1 schema is not the file format]
The schema `fact.v1` requires `schema` and `producedBy`, which `memory_write` does not put in
frontmatter. It describes a fact as a **blackboard artifact**, not the file under
`.foundry/memory/facts/`. Validating a fact file against `fact.v1` reports two missing required
properties, and that is expected.
:::

## Why only the index is loaded

`.foundry/memory/INDEX.md` is generated, never hand-edited, and is the only memory file that enters
context by default. The `SessionStart` hook injects it along with the runbook list and a one-line
git summary. Everything else is fetched on demand.

An index entry is one line:

```
- **fact-0004** · decision · PostgreSQL 16 is the only supported database `database` `postgres` `migrations`
```

That line is enough for the model to know the fact exists and to decide whether to spend tokens
retrieving it, through the `memory_search` tool of the `foundry` MCP server. A hundred facts might
be tens of thousands of tokens on disk and a couple of thousand in the index; the difference is paid
on every session, every day, for as long as the project lives.

This only works if nobody bypasses it. An agent that reads `.foundry/memory/facts/` with the Read
tool loads everything and undoes the design — which is why every kernel asset says so explicitly and
the MCP tool description says it again.

### How retrieval scores

Keyword scoring, no embeddings. Deterministic, offline, and adequate below a couple of thousand
facts.

| Signal | Effect |
|---|---|
| Query term appears in the title | +3 |
| Query term appears in the tags | +2 |
| Query term appears in the body | +1 |
| Fact type is `decision` or `constraint` | × 1.2 |
| Confidence `high` / `medium` / `low` | × 1.15 / × 1.0 / × 0.8 |

Terms shorter than three characters are dropped. The default limit is 8 facts with a minimum score
of 1 (`memoryRetrieval` in `.foundry/config.json`); the `UserPromptSubmit` hook is stricter, taking
at most 5 facts scoring 3 or more, and only for prompts longer than 12 characters.

The consequence is worth stating plainly: **synonyms do not match**. A query about "our data store"
will not find a fact titled "PostgreSQL 16 …" unless one of those words is in the title, tags or
body. Write titles in the words people will search for, and use tags for the words they will not.

## Deduplication and supersedes chains

Facts are written only through `memory_write`, which decides between three outcomes.

| Situation | Action reported | What happens |
|---|---|---|
| An active fact has the same normalised title **and** the same normalised body | `unchanged` | Nothing is written; the existing id is returned |
| An active fact has the same normalised title but a different body | `updated` | A **new** fact is created with a new id and `supersedes: <old-id>` |
| No active fact has that title | `created` | A new fact is created |

Normalisation is lowercase with whitespace collapsed, and the identity check is a SHA-256
fingerprint of title and body together. So re-recording the same decision in a later session is
free and silent, while restating it differently produces a new fact that explicitly retires the old
one.

A fact is **superseded** when its id appears in another fact's `supersedes` field. Superseded facts
disappear from the index and from search results, but the file stays on disk and in git, so the
chain from the current decision back to the one it replaced is readable in the repository.

Two limits of this design, stated with it:

- The chain is resolved by presence, not by depth. If fact-0009 supersedes fact-0004, which
  superseded fact-0002, all three files remain and only fact-0009 is active.
- Matching is on the title. Two facts stating the same thing in different words are two active
  facts, and `foundry doctor`'s duplicate check will not catch them either, because it also
  compares titles. That is what the `memory-curator` agent is for.

## Expiry, not deletion

A fact whose `expires` date is earlier than today stops being active: it leaves the index, leaves
search results, and stops influencing anything. The file is untouched.

Nothing in Foundry deletes a fact. `foundry memory prune` only reports:

```bash
foundry memory prune
```

```
Prune candidates (nothing is deleted automatically):

  expired:
    - fact-0006 — expired 2026-06-30
  superseded:
    - fact-0002 — superseded by a newer fact
  missing reasoning:
    - fact-0011 — add a **Why:** line

Retire a fact by setting `expires`, not by deleting it: the history of a decision is part of its value.
```

Set `expires` when you record a fact that already has a horizon: a dependency pin awaiting an
upgrade, a workaround for a bug that will be fixed, a performance target for one quarter. A fact
that expires on its own never becomes the stale claim nobody dares delete.

## The index token budget

`indexTokenBudget` defaults to 4000 and is set per project in `.foundry/config.json`. The shipped
profiles range from 2500 (`startup-mvp`) to 6000 (`full`).

When the index is rebuilt, facts are sorted by type and then by id:

```
decision → constraint → convention → risk → domain → metric → glossary
```

Lines are added until the next one would exceed the budget. Everything after that is dropped, and
the index ends with a note naming the count:

```
> 14 entries omitted to stay inside the 4000-token index budget. Consolidate or expire facts: `foundry memory prune`.
```

So the entries lost first are `glossary`, `metric` and `domain` — the ones least likely to change a
decision. Decisions and constraints are never the ones dropped.

Three things to know about the cap:

- `foundry doctor` fails when anything was dropped, so an over-budget index is a visible error, not
  a silent truncation.
- The omission notice is appended after the budget check, so the finished file can exceed the
  budget by a few tokens. The cap controls growth; it is not a hard ceiling on the file.
- Raising the budget is almost always the wrong fix. Consolidating six narrow facts into one broad
  one costs an hour once; a larger index costs tokens on every session forever.

## Anti-patterns

| Do not | Because |
|---|---|
| Store what `git log`, `package.json` or the CI config already says | It is derivable, and the source is more accurate than a copy of it |
| Store session state — "currently refactoring the auth module" | It is stale within the hour and the index carries it forever |
| Write or edit fact files by hand | You bypass the fingerprint check, the id allocation and the supersedes chain |
| Read `.foundry/memory/facts/` with the Read tool | You load every fact into context, which is precisely the cost the index exists to avoid |
| Raise `indexTokenBudget` so more facts fit | The cost is paid on every future session; consolidate instead |
| Record a decision without its reasoning | It becomes cargo cult, and nobody dares revisit it because nobody knows what it was weighed against |
| Seed fifty facts on day one | Retrieval quality falls and the index fills with material nobody searches for. Five to fifteen is the working range |
| Give two facts the same claim in different words | Both stay active, both are retrieved, and they will eventually contradict each other |
