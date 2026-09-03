# Foundry — design

**Date:** 2026-08-27
**Status:** approved, implemented in v0.1.0
**Repository:** `fedcal/foundry`
**Author:** Federico Calò

---

## 1. Problem

A capable coding agent forgets decisions between sessions, re-reads the same files to re-orient,
returns confident output nobody verified, and gives no way to know what a session cost. Prompting
harder does not fix any of that. Each failure needs a mechanism.

The goal is a reusable, public, de-facto-standard configuration for Claude Code covering research,
development, quality, operations, project management, economics, legal compliance and open source
governance — specific enough to be worth installing, and governed enough that nine verticals stay
coherent.

## 2. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Distribution | Plugin marketplace **and** a project installer | The marketplace is the native mechanism; the installer serves projects that do not want the dependency |
| Relationship to existing work | Original content, explicit soft dependency on `superpowers`, no GSD | Clean licensing for a public repository; no duplication of what superpowers already does well |
| Scope | All verticals at once, built kernel-first | The user asked for full coverage; freezing the kernel before the verticals is what stops them diverging |
| Documentation | Astro Starlight on GitHub Pages, EN + IT | Native i18n, offline search (Pagefind), fast builds |
| Name | **Foundry**, wordmark "Foundry for Claude Code", plugins `foundry-*` | International, industrial, keeps the workshop metaphor the user liked in "officina" |
| Asset language | English assets, bilingual docs | Best model performance and open to external contribution; documentation stays bilingual |
| Executable runtime | Node.js, standard library only | Cross-platform, already required by Claude Code, no supply chain for users to trust |
| Memory | Four tiers, file-based, generated index | Diffable, reviewable in a PR, zero dependencies |
| Jurisdictions | Compliance **engine** plus data **packs** | An omniscient compliance prompt is a fiction; packs extend to any country by adding a file |
| Enforcement | Blocking gates with explicit, expiring overrides | A standard nobody can bypass gets disabled; one nobody can enforce gets ignored |
| Licence | Apache-2.0 | Permissive plus an explicit patent grant — the version enterprises adopt without legal review |
| Orchestration | Blackboard with versioned contracts, plus headless fan-out | Deterministic, inspectable, rerunnable; artifacts are reusable without re-running the agent |

## 3. Reverse engineering

The design is built on the official Claude Code documentation as of **2026-08-27**, verified
against Claude Code **2.1.247**. A locally bundled copy of the documentation was found to be nine
months stale (2025-12-03) and was discarded in favour of the live sources.

Three findings changed the design:

1. **The plugin schema is far richer than the stale copy showed** — `dependencies` with semver,
   `userConfig`, `workflows/`, `outputStyles/`, `lspServers`, `experimental.monitors`, `channels`,
   `bin/` on PATH, `${CLAUDE_PLUGIN_DATA}`. The kernel-plus-verticals split is expressible natively
   through `dependencies` rather than by convention.
2. **Hooks went from 9 events to 31**, gained `if` conditions, exec form with `args`, and hook types
   `command`, `http`, `mcp_tool`, `prompt` and `agent`. `SubagentStop` in particular makes the
   context firewall enforceable rather than merely recommended.
3. **Subagents nest up to three levels and communicate through `SendMessage`.** An earlier
   assumption that agents could not talk to each other was wrong and was corrected before it
   reached the architecture.

## 4. Architecture

### 4.1 Kernel — `foundry-core`

Required by every vertical through `dependencies`.

- **Memory**: T0 scratch, T1 facts, T2 runbooks, T3 ADRs. `INDEX.md` is generated and capped at
  4000 tokens; it is the only memory in context by default.
- **Contracts**: ten JSON Schema 2020-12 files, versioned by filename, validated by a compact
  in-house validator (~140 lines, no dependencies).
- **MCP server**: stdio JSON-RPC, nine tools, three resources. Reading memory through a tool is
  what makes index-first retrieval cheaper than loading files.
- **Gates**: nine hooks. Destructive commands and secret writes deny; protected paths escalate;
  contract violations return to the author; oversized subagent returns are rejected; completion
  claims without verification block; compaction prompts for persistence.
- **Orchestration**: `foundry-orchestrator` agent, two playbooks, three dynamic workflows.
- **Surfaces**: three output styles, the `foundry` CLI on PATH via `bin/`.

### 4.2 Verticals

`research`, `dev`, `quality`, `ops`, `pmo`, `economics`, `legal`, `oss` — each installable alone,
each declaring the kernel dependency, each authored against `AUTHORING.md`.

### 4.3 Token economy

Seven mechanisms, in order of impact: context firewall; index-first retrieval; model and effort
routing per agent; progressive disclosure in skills; `PreCompact` persistence; compact
`SessionStart` state; measurement through `foundry tokens` and `token_report`.

### 4.4 Orchestration mechanisms

In-session fan-out (2–6 specialists, steerable), dynamic workflows (runtime-discovered item lists,
deterministic and rerunnable), headless fan-out (`claude -p`, for CI and oversized work). Agents
writing files concurrently use `isolation: worktree`; read-only agents never do.

## 5. Governance of the repository itself

`AUTHORING.md` is normative and mechanically enforced by `scripts/validate-assets.mjs` in CI:
frontmatter completeness, model and effort declarations, input/output contract sections, skill
length, hook exec form and script existence, workflow `meta` and forbidden non-determinism,
plugin dependency on the kernel, marketplace consistency, English-only assets, and a credential
scan over tracked files.

## 6. What this deliberately does not do

- It does not reimplement `superpowers`; it depends on it and degrades gracefully without it.
- It does not vendor third-party agents or prompts.
- It does not claim legal authority: every compliance output carries a not-legal-advice disclaimer
  and prefers `undetermined` to a confident wrong answer.
- It does not hardcode framework versions, prices or action SHAs that were not verified.
- It does not make an autonomous agent safe to run unattended. The gates reduce specific, named
  risks; they are not a sandbox.

## 7. Verification performed

- Kernel unit tests: 22 tests covering frontmatter parsing, memory deduplication and supersedes
  chains, expiry, search ranking, index budget enforcement, schema validation including `$ref`
  resolution and closed contracts, and override expiry.
- End-to-end MCP exercise: initialise, list tools, write a fact, retrieve it by an unrelated
  phrasing, write a valid artifact, reject an invalid one with per-field errors, produce a token
  report.
- Every gate exercised on both branches — the blocking path and the silent path — including two
  real defects found and fixed (a `git` stderr leak in an empty repository, and a
  temporal-dead-zone crash in the validator).
- Documentation site builds, including a Starlight v0.39+ sidebar API change that the initial
  configuration got wrong.
