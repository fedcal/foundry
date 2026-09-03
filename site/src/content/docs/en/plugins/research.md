---
title: foundry-research
description: Domain research, technology evaluation, claim verification and documentation engineering.
sidebar:
  order: 2
---

`foundry-research` covers the work that happens before and around the code: understanding a
business domain nobody on the team speaks, choosing a technology you will have to live with,
verifying a claim before it becomes load-bearing, and turning documentation from a folder of
markdown into a system with owners and a build.

## Install

```bash
/plugin install foundry-research@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- The team cannot yet name the users, the workflow being replaced, or the domain vocabulary.
- A framework, database, queue, auth provider or observability vendor has to be chosen and the
  wrong choice would be expensive to reverse.
- A number, a regulatory obligation or a compatibility guarantee is about to be written into an
  ADR and nobody has chased it to its source.
- The project has a README nobody can follow, or a docs site with no information architecture.

## When not to use it

- Not for writing code — that is `foundry-dev`.
- `technical-writer` works on a page whose Diátaxis quadrant and audience are already assigned. It
  does not decide site structure; `docs-architect` does, and `docs-architect` does not write prose.
- `evidence-verifier` verifies **one claim at a time**. It is not a document reviewer, a code
  auditor or a style checker.
- Reference documentation that can be generated from OpenAPI, protobuf, Javadoc or TypeDoc should
  be generated, not hand-written. `api-reference` enforces that.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `domain-researcher` | Establishes who the users actually are, the manual or incumbent workflow being replaced, and the domain vocabulary, before any code, schema or UI exists. | `opus` | `high` |
| `tech-scout` | Evaluates candidate technologies when living with the wrong choice would be expensive, and produces a recommendation with the losing options recorded. | `opus` | `high` |
| `evidence-verifier` | Attempts to **refute** a single load-bearing claim rather than confirm it, chases every citation to its origin, and returns `refuted` when the claim cannot be established. | `opus` | `xhigh` |
| `docs-architect` | Designs the information architecture, maps audiences to Diátaxis quadrants, wires the docs-as-code toolchain, and assigns an owner and review cadence to every page. Also audits an existing site. | `opus` | `high` |
| `technical-writer` | Writes or revises one documentation page to a stated house style: task-oriented titles, one idea per paragraph, examples that run. Runs with `isolation: worktree`. | `sonnet` | `medium` |

`domain-researcher`, `tech-scout`, `evidence-verifier` and `docs-architect` all declare
`disallowedTools: Write, Edit, NotebookEdit` — they are read-only by construction and write their
output through the blackboard.

## Skills

| Skill | When it fires |
|---|---|
| `research-domain` | An unfamiliar business domain must be swept from multiple sources before design starts. |
| `evaluate-technology` | A framework, database, queue, auth provider or observability vendor is being chosen. |
| `docs-site` | Bootstrapping or auditing a documentation site — structure, navigation, search, versioning, translation, ownership and the CI that fails when docs rot. |
| `write-readme` | A project has no README, or one that does not get a reader to first success. |
| `api-reference` | Reference documentation must be generated from the source of truth and kept verified against the code in CI. |

`research-domain` and `evaluate-technology` accept a `--budget-searches N` argument, so a research
sweep has a cost ceiling you set rather than one the agent discovers.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `domain-researcher` | `requirement.v1` | `fact.v1` entries plus a `handoff.v1` |
| `tech-scout` | `requirement.v1` | `adr.v1` |
| `evidence-verifier` | `finding.v1` — one claim | `finding.v1` with `verdict` set to `confirmed`, `plausible` or `refuted` |
| `docs-architect` | `requirement.v1` | `plan.v1` |
| `technical-writer` | `plan.v1` | `review.v1` |

## Limits

- Web research depends on tools the session actually has. Without web access these agents degrade
  to what is in the repository and say so rather than inventing sources.
- `evidence-verifier` returns `refuted` when a claim cannot be established. That is deliberate: an
  unverifiable claim and a false claim get the same treatment, which will occasionally reject
  something that happens to be true.
