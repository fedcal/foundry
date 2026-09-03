---
title: FAQ
description: Straight answers about superpowers, cost, language, affiliation, partial installs and turning gates off.
sidebar:
  order: 4
---

## Does Foundry replace superpowers?

No. It depends on it.

Rule 3 of the authoring contract is *never duplicate `superpowers`*. Where a capability exists
there, Foundry invokes it rather than reimplementing it:

| Need | Delegated to |
|---|---|
| Test-first discipline | `superpowers:test-driven-development` |
| Root-causing a failure | `superpowers:systematic-debugging` |
| Turning an idea into a spec | `superpowers:brainstorming` |
| Turning a spec into a plan | `superpowers:writing-plans` |
| Reviewing and receiving review | `superpowers:requesting-code-review`, `superpowers:receiving-code-review` |
| Claiming completion | `superpowers:verification-before-completion` |

Foundry adds what is not there: governed memory, contracts between agents, guard hooks, model and
effort routing, and the verticals.

## Does it work without superpowers?

Yes, degraded.

The dependency is soft and detected at runtime, never assumed. When `superpowers` is absent,
Foundry falls back to reduced checklists — `plugins/foundry-quality/references/tdd-fallback.md` is
the clearest example, and it names which superpowers skill each item would otherwise have used, so
the degradation is visible rather than silent.

You lose the depth of the TDD and debugging methodology. You keep memory, contracts, gates and
every vertical.

Graceful degradation is a rule, not an accident: the quality bar requires every asset to detect a
missing optional dependency, announce it, and continue. The same applies to a missing MCP server or
a missing `gh`.

## Why are the assets in English when the docs are bilingual?

Because agents and documentation have different readers.

Rule 1 of the authoring contract is *English only in every asset* — agents, skills, hooks,
commands, workflows, code comments. Twelve plugins written by different authors have to behave like
one system, and a mixed-language corpus of agent descriptions makes routing worse: the
`description` field is the retrieval key that decides which agent Claude delegates to.

User-facing documentation is bilingual EN/IT and lives in `site/`, never inside a plugin.
`scripts/validate-assets.mjs` scans every asset for Italian markers and prints a warning when it
finds one, but a warning does not fail the run as CI invokes it — the marker list is a heuristic,
so the check flags rather than blocks, and a reviewer decides. (`--strict` turns every warning into
a failure; the workflow does not pass it.) The split is the one `CONTRIBUTING.md` states: CI
enforces most of the contract mechanically, a reviewer enforces the rest.

## How much does it cost?

Foundry itself is free and Apache-2.0 licensed. What it changes is your Claude Code token usage,
and it is designed to reduce it.

Four mechanisms:

| Mechanism | Effect |
|---|---|
| Index-first memory | Only a 4000-token index is loaded per session; facts, runbooks and artifacts are retrieved on demand |
| Context firewall | A subagent that returns more than three times the 300-token handoff budget is sent back to write an artifact instead |
| Model and effort routing | `haiku`/`low` for extraction and classification, `sonnet`/`medium` for implementation, `opus`/`high` for architecture and analysis |
| Measurement | `foundry tokens` and the `token_report` MCP tool print what the configuration costs |

Run `foundry tokens` on your own project for a real number. It prints what eager loading would cost
against what index-first costs, and the difference.

Two caveats. Figures are estimated at roughly four characters per token, not tokenizer output — use
`/cost` and `/usage` for billed amounts. And installing plugins you do not need costs discovery
tokens at session start, which is why the `full` profile says in its own description to pick
something narrower for real work.

## Is it affiliated with Anthropic?

No.

Foundry is an independent open source project by Federico Calò. It is not affiliated with, endorsed
by, or sponsored by Anthropic. It is a plugin marketplace that runs inside Claude Code; that is the
whole relationship.

## Can I install only one plugin?

Yes — plus the kernel, which comes automatically.

Every vertical declares `"dependencies": [{ "name": "foundry-core", "version": "^0.1.0" }]`, so
installing one pulls `foundry-core` with it. There is no other coupling: verticals do not depend on
each other.

```bash
/plugin marketplace add fedcal/foundry
/plugin install foundry-legal@foundry     # pulls foundry-core
```

Installing narrowly is the recommended approach. The kernel on its own — memory, contracts, gates,
CLI — is also useful with zero verticals.

If you want a curated set instead, apply a profile:

```bash
foundry profile oss-library
```

## How do I disable a gate?

Three levels, from narrowest to broadest.

### One rule, temporarily

Add an entry to `.foundry/overrides.json`. Every block message tells you the exact shape:

```json
{
  "overrides": [
    { "gate": "git-push-force", "reason": "Rewriting a botched tag on a private fork", "expires": "2026-09-15" }
  ]
}
```

An override with a past `expires` date stops applying on its own. Using one records a
`gate_override_used` metric with your reason, so the decision stays auditable.

Overridable ids: `rm-recursive-force`, `git-push-force`, `git-reset-hard-remote`,
`git-clean-force`, `db-drop`, `chmod-777`, `curl-pipe-shell`, `history-rewrite`, and
`protected-path`.

### One category, permanently

Edit `.foundry/config.json`:

| Want | Change |
|---|---|
| Drop credential scanning | `"secretScan": false` |
| Drop the completion check | `"verifyOnStop": false` |
| Different protected paths | replace `protectedPaths` |
| Allow larger subagent returns | raise `handoffSummaryTokenBudget` |

### Everything

```json
{ "enforcement": "warn" }
```

`warn` turns Bash denials into prompts. It does **not** switch off the context firewall or the
verify-before-claiming gate: those have their own settings, and a level called "warn" should not
silently disable a gate whose own flag says it is on.

```json
{ "enforcement": "off" }
```

`off` disables all four guards. Context injection, contract validation and metrics keep running
regardless — they never block anything.

Three gates have no per-rule override by design: credential detection (fix the value, or make the
placeholder obviously fake), the context firewall (raise the budget instead), and
verify-before-claiming (set `verifyOnStop: false`).

Full details, including every rule and every message, are in
[Hooks and gates](/foundry/en/reference/hooks/).

## What if a gate blocks something and I do not understand why?

Every block states the reason and the way out in the same message; the Bash gates also name the
rule id and the override to add. Then run:

```bash
foundry doctor
```

It reports expired overrides still sitting in the file, invalid blackboard artifacts, and whether
the memory index is over budget — which covers most of the confusing cases.
