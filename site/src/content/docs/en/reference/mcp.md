---
title: MCP tools
description: The nine tools and the resources exposed by the Foundry MCP server, with their real input schemas and when to call each.
sidebar:
  order: 2
---

`foundry-core` ships an MCP server at `plugins/foundry-core/mcp/server.mjs`, registered through
`.mcp.json` under the name `foundry`. It speaks JSON-RPC 2.0 over stdio, declares protocol version
`2025-06-18`, and has zero dependencies.

It exists for one reason: reading project memory through a tool costs a fraction of the tokens of
loading memory files into the context window. Every tool returns the smallest useful payload,
never a file dump.

Tools are addressed as `mcp__plugin_foundry-core_foundry__<name>` from inside agents and skills.

## Server instructions

On `initialize` the server returns these instructions, which is what shapes the model's default
behaviour:

> Foundry memory and contracts. Prefer `memory_search` over reading `.foundry` files. Consult
> `runbook_list` before recurring tasks. Hand work between agents with `blackboard_write`,
> returning only the artifact path and a short summary.

## Tools at a glance

| Tool | Required input | Call it when |
|---|---|---|
| `memory_search` | `query` | Before planning, before proposing an architecture, whenever the user refers to a past decision |
| `memory_write` | `title`, `body`, `type` | A decision, constraint, convention or risk has just been established |
| `memory_index` | — | After writing facts |
| `runbook_list` | — | Before any recurring or error-prone task |
| `runbook_get` | `slug` | A runbook applies and you need its full text |
| `contract_validate` | `schema` | Checking an artifact before or instead of writing it |
| `blackboard_write` | `wave`, `agent`, `schema`, `data` | Handing work to the next wave |
| `blackboard_read` | `wave` | Picking up what a previous wave produced |
| `token_report` | — | Answering "what is this costing" |

---

## `memory_search`

Searches project memory and returns only the matching facts. Use this instead of reading files
under `.foundry/memory/` — it is the token-cheap path.

| Field | Type | Required | Notes |
|---|---|---|---|
| `query` | string | yes | Keywords describing what you need to know |
| `type` | enum | no | `decision` \| `constraint` \| `convention` \| `domain` \| `risk` \| `metric` \| `glossary` |
| `limit` | integer 1–25 | no | Default comes from `memoryRetrieval.maxFacts`, which is `8` |

Returns one block per hit:

```
### fact-0004 · decision · confidence high
**Persistence layer uses Flyway, not Liquibase**
Chosen for the plain-SQL migration format the team already reads.
_source: adr-0007 · scope: project_
```

With no hits: `No stored fact matches "<query>". Memory holds N active facts.`

## `memory_write`

Stores one atomic durable fact. Deduplicates against existing facts, assigns the id and maintains
supersedes chains. **Never write memory files by hand.** Do not use it for transient session state.

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | States the fact itself, not the topic. Max 80 characters |
| `body` | string | yes | Max 120 words. For `decision` and `risk`, include `Why:` and `How to apply:` lines |
| `type` | enum | yes | `decision` \| `constraint` \| `convention` \| `domain` \| `risk` \| `metric` \| `glossary` |
| `scope` | string | no | `project` \| `module:<name>` \| `vertical:<name>`. Defaults to `project` |
| `tags` | string[] | no | Defaults to `[]` |
| `confidence` | enum | no | `high` \| `medium` \| `low`. Defaults to `medium` |
| `source` | string | no | `adr-0007` \| `conversation` \| `code` \| `external:<url>`. Defaults to `conversation` |
| `expires` | string | no | `YYYY-MM-DD` after which the fact stops being loaded |

Returns the action taken and the index cost:

```
created: fact-0016 (supersedes fact-0009)
Index: 13/16 facts listed, ~1980 tokens, 3 omitted over budget.
```

The index is rebuilt automatically on every write, so a separate `memory_index` call is only
needed after editing facts by other means.

## `memory_index`

No input. Rebuilds `.foundry/memory/INDEX.md` and reports budget usage.

```
Rebuilt /home/me/project/.foundry/memory/INDEX.md
13/16 facts listed, ~1980 tokens, 3 omitted.
```

## `runbook_list`

No input. Lists runbooks with their trigger conditions. Consult this **before** starting any
recurring or error-prone task — a runbook that exists must be followed rather than improvised.

```
- **deploy-production** — Deploy to production
  trigger: deploy, release to prod
- **rotate-api-keys** — Rotate third-party API keys
```

With none: `No runbooks yet. Create one with the `runbook-author` skill after any task worth
repeating.`

## `runbook_get`

| Field | Type | Required |
|---|---|---|
| `slug` | string | yes |

Returns the full markdown of `.foundry/runbooks/<slug>.md`. An unknown slug returns an error
result listing the available slugs.

## `contract_validate`

Validates a JSON artifact against a Foundry contract schema. Returns the list of violations.

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema` | string | yes | Contract id, e.g. `finding.v1` |
| `data` | object | no | The artifact to validate |
| `path` | string | no | Alternatively, a path to a JSON file, resolved against the project root when relative |

Exactly one of `data` or `path` must be supplied; with neither it returns
`Provide either \`data\` or \`path\`.` as an error.

```
INVALID against finding.v1:
- missing required property "failureScenario"
```

or `VALID against finding.v1.`

## `blackboard_write`

Writes a wave artifact and validates it against its contract in one step. This is how an agent
hands work to the next wave.

| Field | Type | Required | Notes |
|---|---|---|---|
| `wave` | string | yes | Wave id, e.g. `analysis` |
| `agent` | string | yes | Producing agent name |
| `schema` | string | yes | Contract id the artifact conforms to |
| `data` | object | yes | The artifact |

The server sets `schema` and `producedBy` itself from `schema` and `agent`, then validates. On
failure **nothing is written**:

```
Rejected: artifact does not satisfy finding.v1.
- missing required property "failureScenario"
Fix and call again.
```

On success it writes `.foundry/blackboard/<wave>/<agent>.json` and returns the path with a token
cost, plus the firewall instruction:

```
Wrote .foundry/blackboard/audit/appsec-reviewer.json (2841 bytes, ~711 tokens).
Return to your caller ONLY this path and a summary of at most 300 tokens.
```

`wave` and `agent` are sanitised: anything outside `[A-Za-z0-9._-]` becomes `-`, and both are
truncated to 80 characters. This is what stops a wave name from escaping the blackboard directory.

## `blackboard_read`

Reads artifacts for a wave. Returns metadata and summaries by default.

| Field | Type | Required | Notes |
|---|---|---|---|
| `wave` | string | yes | |
| `agent` | string | no | Restrict to one producer |
| `full` | boolean | no | Return the whole artifact. Use only when you genuinely need it |

Default (summary) shape, one entry per artifact:

```
- **appsec-reviewer.json** · schema review.v1 · by appsec-reviewer · ~711 tokens
  Six findings, two high. Access control on /api/orders is the blocking one.
```

The summary line is taken from `summary`, then `title`, then `goal`, truncated to 400 characters;
`(no summary field)` when none of the three exists. With `full: true` each artifact is returned
verbatim in a fenced JSON block — which is exactly the file dump the context firewall exists to
prevent, so pass it deliberately.

## `token_report`

No input. Reports Foundry token accounting for the project, including the recorded gate events.

```
# Foundry token report

- Memory index: ~1980 tokens of a 4000 budget (always in context)
- Facts stored: 16, ~9700 tokens total (retrieved on demand only)
- Blackboard artifacts: ~24800 tokens (never enter context wholesale)
- Recorded events: memory_search=41, memory_write=16, gate_blocked=3, blackboard_write=9

Loading all memory eagerly would cost ~34500 tokens per session; the index-first path costs ~1980.
```

Event counts come from `.foundry/metrics/events.jsonl`, which is gitignored.

---

## Resources

The server also implements `resources/list` and `resources/read`. Two resources are always
present, plus one per runbook.

| URI | Name | Content |
|---|---|---|
| `foundry://memory/index` | Memory index | `.foundry/memory/INDEX.md`, built on demand if missing |
| `foundry://contracts` | I/O contracts | A markdown list of every available contract id |
| `foundry://runbooks/<slug>` | Runbook: `<title>` | The runbook markdown; the resource description is its trigger |

All three are `text/markdown`. An unknown URI returns JSON-RPC error `-32602` with the message
`Unknown resource: <uri>`.

## Limits

- `memory_search` is keyword scoring, not semantic search. A fact phrased differently from your
  query may not surface; `type` and `limit` narrow, they do not broaden.
- The server is stateless per call and reads from disk each time. It is cheap, but it is not a
  cache.
- A tool that throws returns an error *result* rather than a JSON-RPC error, so the model sees the
  message and can correct itself: `<tool> failed: <message>`.
- Only `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list` and `resources/read` are
  implemented. There are no prompts, no sampling and no subscriptions.
