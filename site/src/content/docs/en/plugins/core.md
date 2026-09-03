---
title: foundry-core
description: The kernel — governed memory, I/O contracts, guard hooks, the Foundry MCP server and the foundry CLI.
sidebar:
  order: 1
---

`foundry-core` is the only mandatory plugin. Every other Foundry plugin declares
`dependencies: [foundry-core]`, so installing any vertical pulls the kernel with it.

It ships no domain expertise. What it ships is the machinery the verticals rely on: the memory
tiers, the eleven JSON Schemas agents hand each other, the hooks that block unverified claims and
oversized subagent returns, the MCP server that makes memory retrieval cheap, and the `foundry`
command line.

## Install

```bash
/plugin marketplace add fedcal/foundry
/plugin install foundry-core@foundry
```

`foundry-core` is the only plugin with `defaultEnabled: true`.

## When to install it

Always — it is required. The real question is what to install *alongside* it. If you want nothing
but memory, contracts and gates, install `foundry-core` on its own; it is useful with zero
verticals. Every vertical you add costs discovery tokens at session start, so add them
deliberately rather than installing `full`.

## When not to use it

- If you do not want any hook to ever block a tool call, do not install it. The gates are the
  point; disabling all of them leaves little behind. See
  [Hooks](/foundry/en/reference/hooks/) for the per-gate override path and the `enforcement: off`
  setting.
- It does not manage your dependencies, run your tests or deploy anything. It records, validates
  and gates.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `foundry-orchestrator` | Plans and runs multi-agent work in waves against a playbook, enforces the contract gate between waves and keeps the parent context small. | `opus` | `high` |
| `context-broker` | Searches memory, runbooks, ADRs and the codebase, then returns a briefing of at most 300 tokens instead of file dumps. | `haiku` | `low` |
| `memory-curator` | Extracts durable facts from a session, deduplicates them, retires what is no longer true and keeps the index inside its token budget. | `haiku` | `low` |
| `runbook-author` | Writes and revises operational runbooks after work that will recur — deploys, incidents, migrations, releases. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `foundry-init` | A project has no `.foundry/` directory, `foundry doctor` reports missing state, or the user asks to set Foundry up here. User-invocable only (`disable-model-invocation: true`). |
| `memory` | A decision or constraint has just been established, you need to know what was decided before, or the index exceeds its budget. |
| `orchestrate` | A task needs several specialists in parallel with gates between stages, or the user asks to fan out or run a full cycle. |
| `runbook` | Before any recurring or error-prone task, and immediately after finishing one someone will repeat. |
| `contracts` | Writing to the blackboard, reacting to a contract validation error, or designing a new agent's output. |
| `handoff` | Finishing a delegated task, ending a wave, or pausing work someone else will resume. |
| `token-budget` | A session feels expensive, before starting long work, or when the user asks about cost or context pressure. |
| `audit-agent-surface` | Before trusting a machine with autonomous work, after installing a plugin or MCP server, when permission mode has been loosened, or as a periodic check. Read-only unless `--fix` is passed. |

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `foundry-orchestrator` | `plan.v1` | `handoff.v1` |
| `context-broker` | natural-language task or question | `handoff.v1` at `.foundry/blackboard/context/context-broker.json` plus a briefing of at most 300 tokens |
| `memory-curator` | session transcript plus existing memory read over MCP | `fact.v1` entries written through `memory_write`, then a rebuilt index; returns a count, not a listing |
| `runbook-author` | the transcript of the work just done, plus the existing runbook if revising | a markdown file at `.foundry/runbooks/<slug>.md` |

## What else it ships

### Contracts

Eleven JSON Schema 2020-12 files in `plugins/foundry-core/schemas/`: `fact.v1`, `finding.v1`,
`adr.v1`, `plan.v1`, `requirement.v1`, `risk.v1`, `estimate.v1`, `compliance-check.v1`,
`review.v1`, `handoff.v1`, `tracker-item.v1`. Full field lists in
[Contracts](/foundry/en/reference/contracts/).

### Hooks

Nine hook scripts wired through `hooks/hooks.json` across eight events: `SessionStart`, `UserPromptSubmit`,
`PreToolUse` (Bash and Write/Edit/NotebookEdit), `PostToolUse`, `SubagentStop`, `Stop`,
`PreCompact` and `SessionEnd`. See [Hooks](/foundry/en/reference/hooks/).

### MCP server

`mcp/server.mjs`, registered as the `foundry` server through `.mcp.json`. Stdio, JSON-RPC 2.0,
protocol `2025-06-18`, zero dependencies. Nine tools and a resource list. See
[MCP tools](/foundry/en/reference/mcp/).

### CLI

`bin/foundry.mjs`. Claude Code puts the plugin's `bin/` directory on PATH but creates no shim, so
the command is `foundry.mjs`, not `foundry` — call it as
`node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs"`. See [CLI](/foundry/en/reference/cli/).

### Workflows

Dynamic workflows in `workflows/`, for work where the item list is only known at runtime.

| Workflow | `meta.name` | Phases | When to use |
|---|---|---|---|
| `feature-delivery.js` | `foundry-feature-delivery` | Analysis, Implementation, Convergence | A feature spanning architecture, frontend, backend and data, where parts can be built in parallel once contracts are agreed. |
| `audit-sweep.js` | `foundry-audit-sweep` | Scope, Audit, Verify, Synthesise | Codebase audits where the item list is discovered at runtime and every finding must survive an attempt to refute it. |
| `compliance-sweep.js` | `foundry-compliance-sweep` | Profile, Assess, Report | Compliance gap analysis where each control is assessed against real evidence rather than assumed. |

Workflow files run under the Claude Code workflow runtime: `Date.now()`, `new Date()` and
`Math.random()` throw, so timestamps must be passed through `args`.

### Playbooks

Declarative YAML wave definitions in `playbooks/`, consumed by the `orchestrate` skill and the
`foundry-orchestrator` agent.

| Playbook | Waves | Gates it enforces |
|---|---|---|
| `feature-delivery.yaml` | `analysis`, `implementation`, `convergence` | all artifacts valid; requirements have acceptance criteria; every threat has a mitigation and a test; tests written before implementation; the project test command passes; no stubbed acceptance criteria |
| `audit.yaml` | `scope`, `audit`, `verify`, … | scope is bounded; every finding has a failure scenario; only unrefuted findings advance |

The audit playbook runs `evidence-verifier` per finding at `opus`/`xhigh` with two lenses
(refutation, reachability), and defaults to *refuted* when the evidence is ambiguous.

### Output styles

Claude Code namespaces a plugin's output styles by plugin name, so the identifier is
`<plugin>:<name>`. The `foundry-core:` prefix is part of the name: the style picker shows it, and
`"outputStyle"` in `settings.json` is matched against the prefixed string. Setting
`"outputStyle": "Foundry Analyst"` matches nothing and silently falls back to the default style.

| Identifier | Voice |
|---|---|
| `foundry-core:Foundry Senior Engineer` | Direct, evidence-first, explicit about uncertainty and trade-offs. |
| `foundry-core:Foundry Analyst` | Shows the model, separates fact from assumption, states what would change the conclusion. |
| `foundry-core:Foundry PMO` | Status against plan, risks with owners, forecasts as ranges, bad news early. |

All three set `keep-coding-instructions: true`, so they overlay a voice on the built-in coding
instructions rather than replacing them.

## Configuration

`foundry init` writes `.foundry/config.json`. Defaults, as implemented in
`plugins/foundry-core/lib/foundry.mjs`:

| Key | Default | Effect |
|---|---|---|
| `enforcement` | `gate` | `gate` blocks, `warn` downgrades denials to a user prompt, `off` disables the guards entirely. |
| `indexTokenBudget` | `4000` | Hard cap on `.foundry/memory/INDEX.md`; facts over budget are omitted from the index, not deleted. |
| `handoffSummaryTokenBudget` | `300` | Target for a subagent's returned summary. The `SubagentStop` gate denies at three times this value. |
| `secretScan` | `true` | Enables the credential patterns in the write guard. |
| `verifyOnStop` | `true` | Enables the `verify-before-claiming` gate. |
| `protectedPaths` | `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `db/migrations/**` | Writes here escalate to the user. |
| `memoryRetrieval` | `{ maxFacts: 8, minScore: 1 }` | Defaults for `memory_search`. |

## Limits

- Token counts are estimates at roughly four characters per token, not tokenizer output. They are
  accurate enough to enforce budgets; for billed usage use `/cost` and `/usage`.
- `memory_search` is keyword scoring, not semantic search. A fact whose title uses different words
  from your query may not surface.
- The `Stop` gate reads the last 400 lines of the transcript. A verification command run much
  earlier in a very long turn may not be seen.
