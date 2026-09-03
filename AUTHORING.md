# Foundry Asset Authoring Contract

**This file is normative.** Every agent, skill, hook, workflow and command in this repository
MUST comply with it. It is the single source of truth that keeps twelve plugins written by
different authors behaving like one system.

Verified against the installed Claude Code binary — not against documentation, which lags — on
**2026-08-28** for Claude Code **2.1.250**. Do not author against memory of older schemas, and do
not add a field here without confirming the loader actually reads it: a key the loader discards is
indistinguishable from a key that works, right up to the moment the behaviour it promised is
missing.

---

## 0. Non-negotiable rules

1. **English only** in every asset (agents, skills, hooks, commands, workflows, code comments).
   User-facing documentation is bilingual EN/IT and lives in `site/`, never inside plugins.
2. **No vendored third-party content.** Do not copy prompts, text or code from other repositories.
   Everything here is original work licensed Apache-2.0.
3. **Never duplicate `superpowers`.** Foundry declares an explicit soft dependency on it.
   If a capability exists there (TDD discipline, systematic debugging, brainstorming,
   writing plans, receiving code review, verification before completion), Foundry **invokes it**
   and does not reimplement it. See §7.
4. **No GSD.** Nothing in this repository may reference, require or reimplement `gsd-*`.
5. **Zero runtime dependencies.** All executable code is Node.js ≥ 20 using only the standard
   library (`node:fs`, `node:path`, `node:process`, `node:crypto`, `node:test`, …).
   No `npm install` is ever required to use Foundry.
6. **Cross-platform.** Hooks and scripts must run unmodified on Linux, macOS and Windows.
   Always use hook *exec form* (`command` + `args`), never shell pipelines.
7. **No generic filler.** An asset that could apply to any project without change is a defect.
   Every asset names concrete files, commands, thresholds, standards or failure modes.

---

## 1. Verified component schemas

### 1.1 `plugin.json` (`.claude-plugin/plugin.json`)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "foundry-<vertical>",
  "displayName": "Foundry <Vertical>",
  "version": "0.1.0",
  "description": "<one line, <=120 chars>",
  "author": { "name": "Federico Calò", "url": "https://federicocalo.dev" },
  "homepage": "https://fedcal.github.io/foundry",
  "repository": "https://github.com/fedcal/foundry",
  "license": "Apache-2.0",
  "keywords": ["claude-code", "..."],
  "dependencies": [{ "name": "foundry-core", "version": "^0.1.0" }],
  "defaultEnabled": false
}
```

Path fields, and whether they **add to** or **replace** the default directory:

| Field | Default dir | Behaviour |
|---|---|---|
| `skills` | `skills/` | adds |
| `commands` | `commands/` | replaces |
| `agents` | `agents/` | replaces |
| `workflows` | `workflows/` | replaces |
| `outputStyles` | `output-styles/` | replaces |
| `hooks` | `hooks/hooks.json` | merges |
| `mcpServers` | `.mcp.json` | merges |
| `lspServers` | `.lsp.json` | merges |
| `experimental.themes` | `themes/` | replaces |
| `experimental.monitors` | `monitors/monitors.json` | replaces |

Other supported fields: `metadata` (free-form), `userConfig`, `channels`, `bin/` (added to PATH).

### 1.2 Substitution variables

| Variable | Resolves to | Use for |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | plugin install dir | bundled scripts, schemas, templates |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/{id}/` (survives updates) | caches, generated state |
| `${CLAUDE_PROJECT_DIR}` | project root (stays at main checkout in worktrees) | project-local paths |
| `${CLAUDE_SKILL_DIR}` | the skill's own directory | scripts referenced in `allowed-tools` |
| `${user_config.KEY}` | plugin `userConfig` value | configurable endpoints/paths |

In worktrees `${CLAUDE_PROJECT_DIR}` does **not** follow the worktree — read `cwd` from hook stdin.

### 1.3 Agent frontmatter (`agents/<name>.md`)

```yaml
---
name: kebab-case-unique          # required, no ':' (reserved for plugin namespacing)
description: <when Claude should delegate here>   # required, decides routing
tools: Read, Grep, Glob, Bash    # omit to inherit all
disallowedTools: Write, Edit     # applied before tools resolution
model: sonnet                    # sonnet|opus|haiku|fable|<full id>|inherit
effort: medium                   # low|medium|high|xhigh|max — validated by the loader
maxTurns: 20                     # positive integer — validated by the loader
skills: [skill-a, skill-b]       # preloaded into the agent context at startup
memory: project                  # user|project|local — persistent cross-session memory
background: false
isolation: worktree              # temporary git worktree, isolated checkout
color: cyan
---
```

**Never set `permissionMode`, `mcpServers` or `hooks` on a plugin agent.** The loader discards all
three and warns, verbatim: *"Plugin agent file &lt;path&gt; sets &lt;key&gt;, which is ignored for plugin
agents. Use .claude/agents/ for this level of control."* Seventy agents in this repository declared
a `permissionMode` and forty an `mcpServers` before this was checked — every one a promise the
runtime never kept, and a warning on every load. `scripts/validate-assets.mjs` now rejects them.

An agent that needs the `foundry` MCP tools does not scope them here: it simply omits `tools:`, and
inherits everything the session has. An explicit `tools:` allowlist that does not name the
`mcp__plugin_foundry-core_foundry__*` tools silently removes them, which is the failure the
validator's MCP-reachability check exists to catch.

**Subagents nest up to 3 levels** below the main conversation and communicate with `SendMessage`.
At the depth limit the `Agent` tool is withheld. Cap it explicitly with
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Tools always withheld from subagents:
`AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode`, `ScheduleWakeup`,
`TaskOutput`, `Workflow`. **Never write an agent that depends on those.**

### 1.4 Skill frontmatter (`skills/<name>/SKILL.md`)

```yaml
---
name: kebab-case
description: <what it does AND when to use it>   # this is the retrieval key
allowed-tools: Read Grep Glob                    # space- or comma-separated; PRE-APPROVES only
disallowed-tools: Write Edit                     # the only key that actually denies
disable-model-invocation: true                   # user-invocable only (/name)
user-invocable: true
argument-hint: "[path] [--fix]"
arguments: ...
context: fork                                    # run the skill in its own subagent context
agent: <agent-name>                              # run through a specific agent
model: haiku
effort: low
background: false
paths: ["src/**"]                                # scope the skill to matching paths
compatibility: ...
metadata: { foundry.vertical: dev, foundry.io: "input->output" }
license: Apache-2.0
---
```

**`allowed-tools` does not restrict anything.** The runtime turns it into *allow* rules
(`alwaysAllowRules`) and `disallowed-tools` into *deny* rules (`alwaysDenyRules`); every tool the
session already has stays callable while the skill runs, inline or `context: fork`. A skill that
omits `Bash` from `allowed-tools` can still run `Bash`. **`disallowed-tools` is the only skill
frontmatter key that actually denies a tool.** Never express a guardrail as an omission from
`allowed-tools` — write it out in `disallowed-tools`.

`SKILL.md` body **must stay under 500 lines**. Anything longer goes in
`references/*.md`, `scripts/`, `templates/` and is loaded only on demand (progressive disclosure).

### 1.5 Hooks (`hooks/hooks.json`)

31 events are available. The ones that matter here:

| Event | Blocking | Matcher target |
|---|---|---|
| `SessionStart` | no | `startup`,`resume`,`clear`,`compact`,`fork` |
| `UserPromptSubmit` | yes | — |
| `PreToolUse` | yes | tool name |
| `PostToolUse` | no | tool name |
| `PostToolUseFailure` | no | tool name |
| `PostToolBatch` | yes | — |
| `PermissionRequest` | via decision | tool name |
| `SubagentStart` / `SubagentStop` | stop: yes | agent type |
| `Stop` | yes | — |
| `PreCompact` / `PostCompact` | pre: yes | `manual`,`auto` |
| `TaskCreated` / `TaskCompleted` | yes | — |
| `InstructionsLoaded` | no | load reason |
| `FileChanged` | no | literal filenames |
| `WorktreeCreate` | provider — see §8 | — |
| `SessionEnd` | no | end reason |

Entry shape (**always exec form**):

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "if": "Bash(git push *)",
        "statusMessage": "Foundry: checking push safety",
        "timeout": 20,
        "command": "node",
        "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/guard-bash.mjs"]
      }]
    }]
  }
}
```

Hook output contract (stdout JSON). **There are two channels, and picking the wrong one is a
silent no-op** — the runtime discards output it cannot interpret and the gate simply never fires.

**Channel A — `hookSpecificOutput`.** The event name in the payload must match the event that
fired, and the fields available differ per event:

```json
{ "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "...",
    "additionalContext": "...",
    "updatedInput": { }
} }
```

`permissionDecision` is exactly `allow|deny|ask|defer` — nothing else. A value outside that set
(`escalate`, `warn`, `block`, …) is rejected by the schema and the call proceeds **ungated**: it
fails open. `updatedInput` is `PreToolUse` only. `defer` is print-mode and solo-only — in an
interactive session the runtime logs *"returned permissionDecision=defer in interactive mode;
ignoring (defer is print-mode only)"* and it is also ignored when other tool calls share the batch
— so a gate that must hold in an interactive session uses `deny` or `ask`.
`permissionDecision` exists on `PreToolUse` alone. On `Stop`, `SubagentStop`, `PostToolUse`,
`PostToolBatch`, `UserPromptSubmit` and `PostToolUseFailure` this channel carries
`additionalContext` — advisory text handed to the model, after which the turn continues — and on
those events it cannot stop anything.

**Channel B — top-level `decision`.** This is the only way to *block*, and the only channel that
stops a `Stop` or `SubagentStop` turn:

```json
{ "decision": "block", "reason": "why, and what to do about it", "continue": true }
```

`lib/foundry.mjs` encodes the split as `BLOCK_VIA_DECISION = new Set(['Stop','SubagentStop'])`.
Sending a `Stop` gate a `permissionDecision` produces output nothing interprets. Exiting with
status **2** blocks too, using stderr as the reason; `continue: false` ends the turn outright.

Exit 0 with no stdout = no opinion.
`UserPromptSubmit` timeout is 30 s. `SessionEnd` hooks share a budget that is **1.5 s by default**:
`Math.max(1500, Math.min(largestTimeoutMs, 60000))`, overridden outright by
`CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`. Only a `SessionEnd` entry declared in `settings.json`
(or on an agent) feeds `largestTimeoutMs`; a **plugin**-declared `timeout` — Foundry's entry sets
`"timeout": 5` — bounds that one hook's own process but never enters the shared budget, which
stays at 1.5 s. Keep `SessionEnd` hooks trivial: the budget is shared across every `SessionEnd`
hook in the session, not per hook.

### 1.6 Workflows (`workflows/<name>.js`)

Plain JavaScript, top-level `await`, must start with a pure-literal `meta`:

```js
export const meta = {
  name: 'foundry-feature-delivery',
  description: 'Wave-based delivery: analysis -> implementation -> convergence',
  phases: [{ title: 'Analysis' }, { title: 'Implementation' }, { title: 'Convergence' }],
}
```

Available: `agent(prompt, opts)`, `parallel(thunks)`, `pipeline(items, ...stages)`, `phase(title)`,
`log(msg)`, `args`, `budget`, `workflow(nameOrRef, args)`.
`Date.now()`, `new Date()` and `Math.random()` **throw** — pass timestamps via `args`.
Prefer `pipeline()` over `parallel()`: use a barrier only when a stage genuinely needs every
prior result at once.

---

## 2. Model and effort routing (token economy)

Declare `model:` and `effort:` on **every** agent. Deviating requires a one-line justification
in the agent body.

| Work | model | effort |
|---|---|---|
| Extraction, classification, formatting, index generation, lint triage | `haiku` | `low` |
| Implementation, review, test authoring, refactoring, docs | `sonnet` | `medium` |
| Architecture, threat modelling, legal analysis, economic modelling, final synthesis | `opus` | `high` |
| Adversarial verification of a high-stakes finding | `opus` | `xhigh` |

**Context firewall (mandatory).** Any agent that reads a lot (research, audit, sweep) MUST:
1. write its full output to `.foundry/blackboard/<wave>/<agent>.json`, and
2. return to its caller **only** the artifact path plus a summary of **≤ 300 tokens**.

Returning raw file dumps to the parent context is a defect.

---

## 3. Memory model

Four tiers. Never invent a fifth.

| Tier | Path | Lifetime | Git |
|---|---|---|---|
| T0 scratch | `.foundry/scratch/<session>/` | session | ignored |
| T1 facts | `.foundry/memory/facts/<id>.md` | project | tracked |
| T2 runbooks | `.foundry/runbooks/<slug>.md` | project | tracked |
| T3 decisions | `docs/adr/NNNN-<slug>.md` | forever | tracked |

Fact frontmatter (`fact.v1`):

```yaml
---
id: fact-0001
type: decision | constraint | convention | domain | risk | metric | glossary
scope: project | module:<name> | vertical:<name>
title: <=80 chars, states the fact itself, not the topic
tags: [a, b]
confidence: high | medium | low
source: adr-0007 | conversation | code | external:<url>
created: YYYY-MM-DD
expires: YYYY-MM-DD | null
supersedes: fact-0000 | null
---
```

Body: ≤ 120 words. Facts of type `decision` and `risk` must include `**Why:**` and
`**How to apply:**` lines. Link related facts with `[[fact-id]]`.

`.foundry/memory/INDEX.md` is generated by `scripts/gen-memory-index.mjs`; it is the **only**
memory file loaded into context by default and is hard-capped at **4000 tokens**.
Everything else is retrieved on demand through the `foundry` MCP server.

**Never** write memory by hand from an agent — call the MCP tool `memory_write`, which
deduplicates, assigns ids and maintains `supersedes` chains.

---

## 4. I/O contracts

Every agent declares, verbatim, in its body:

```
## Input contract
`<schema-id>` — <what it needs>

## Output contract
`<schema-id>` — written to `.foundry/blackboard/<wave>/<agent>.json`
```

Schemas live in `plugins/foundry-core/schemas/*.schema.json` (JSON Schema 2020-12) and are
versioned by filename: `finding.v1`, `adr.v1`, `plan.v1`, `requirement.v1`, `risk.v1`,
`estimate.v1`, `compliance-check.v1`, `review.v1`, `handoff.v1`, `fact.v1`.

Breaking a schema means adding `*.v2`, never editing `*.v1`.

There are two validation paths, and only one of them is a gate:

- **Blocking** — the MCP tool `mcp__plugin_foundry-core_foundry__blackboard_write` validates the
  artifact against its schema *before* writing anything, so an invalid artifact never reaches the
  blackboard. This is the path an agent should use.
- **Non-blocking** — the `PostToolUse` hook `validate-contract.mjs` catches a blackboard file
  written with `Write`/`Edit` instead. `PostToolUse` runs *after* the tool, so the invalid file is
  already on disk; the hook returns the violations as `additionalContext` for the agent to correct.
  It corrects, it does not prevent. `foundry doctor` sweeps for artifacts that slipped through.

---

## 5. Quality bar for a Foundry asset

An asset ships only if all of these hold:

- [ ] It names **concrete** artifacts: real file paths, real commands, real config keys.
- [ ] It states **when not to use it** and what it deliberately does not cover.
- [ ] It defines **measurable** exit criteria (thresholds, counts, gates) — not "make it good".
- [ ] It declares `model:`/`effort:` and respects §2 routing.
- [ ] It declares input/output contracts (agents) or progressive disclosure (skills).
- [ ] It degrades gracefully when an optional dependency (`superpowers`, an MCP server,
      a CLI like `gh`) is absent — detect, announce, continue.
- [ ] Body ≤ 500 lines; longer material moved to `references/`.
- [ ] It cites the standard it enforces where one exists (WCAG 2.2 SC number, OWASP ASVS
      control id, ISO clause, GDPR article, RFC number).

---

## 6. Naming

- Plugins: `foundry-<vertical>`
- Agents: `<domain>-<role>` — `angular-architect`, `gdpr-analyst`, `cost-engineer`
- Skills: `<verb>-<object>` or `<domain>-<artifact>` — `design-api-contract`, `adr-write`
- Commands/user-invocable skills: exposed as `/foundry-<vertical>:<name>`
- Blackboard files: `.foundry/blackboard/<wave>/<agent>.json`
- Schemas: `<noun>.v<major>.schema.json`

## 7. Interop with `superpowers`

Soft dependency, detected at runtime, never assumed:

| Need | Delegate to |
|---|---|
| Test-first discipline | `superpowers:test-driven-development` |
| Root-causing a failure | `superpowers:systematic-debugging` |
| Turning an idea into a spec | `superpowers:brainstorming` |
| Turning a spec into a plan | `superpowers:writing-plans` |
| Reviewing / receiving review | `superpowers:requesting-code-review`, `receiving-code-review` |
| Claiming completion | `superpowers:verification-before-completion` |

Pattern to use inside a skill:

```
If the `superpowers` plugin is installed, invoke `superpowers:test-driven-development`
and follow it. If it is not, apply the reduced checklist in `references/tdd-fallback.md`.
```

## 8. Worktrees and parallelism

- Agents that write files while other agents also write files MUST declare `isolation: worktree`.
- **A worktree is a new branch, and by default it is not branched from where you are.** The
  `worktree.baseRef` setting governs the base ref and defaults to `fresh`, which branches from
  `origin/<default-branch>`. A worktree-isolated agent therefore cannot see the feature branch you
  are on, the commits you have not pushed, or the uncommitted files the session just produced —
  it gets a clean checkout of the remote default branch. Set
  `"worktree": { "baseRef": "head" }` in `.claude/settings.json` when a fan-out must build on the
  session's current state, and commit before fanning out either way. The setting applies to
  `claude --worktree`, `EnterWorktree` and agent `isolation` alike.
- Worktrees land in `.claude/worktrees/<name>/`; gitignored files needed inside them are listed
  in `.worktreeinclude` at the repo root. The runtime copies those paths **file by file and skips
  symlinks**, so a directory containing any arrives incomplete — list real files, and verify.
- To drive a worktree by hand rather than through an agent: `EnterWorktree` creates or switches
  into one (`name` to create, `path` to enter an existing one), `ExitWorktree` leaves it with
  `action: "keep" | "remove"` — and refuses to remove a worktree with uncommitted files or
  unmerged commits unless `discard_changes: true`. `claude --worktree` does the same for a headless
  run. `EnterWorktree` is deliberately inert unless a human or `CLAUDE.md` says "worktree";
  agent `isolation: worktree` does not go through it and needs no such authorisation.
- **`WorktreeCreate` is a provider, not a preparation step, and Foundry registers no hook on it.**
  When a `WorktreeCreate` hook *is* configured it replaces git worktree creation: it must create
  the directory and print its absolute path on stdout (a command hook) or return
  `hookSpecificOutput.worktreePath` (http/callback). Succeeding without emitting a path is a hard
  failure — *"WorktreeCreate hook failed: hook succeeded but returned no worktree path"* — so the
  tempting "warn on stderr and exit 0" shape breaks every worktree creation in the repository.
  Its input is `{ hook_event_name, name }` — a name, not a path (`worktree_path` belongs to
  `WorktreeRemove`).
  Environment preparation is the runtime's job, through `.worktreeinclude` and
  `worktree.symlinkDirectories`, not this hook's.
- **Nothing links Foundry state into a worktree automatically.**
  Committed `.foundry/` content arrives through git; `.foundry/blackboard/` is
  gitignored and therefore **per-worktree**, so an artifact written inside a worktree is invisible
  to the main checkout. An agent isolated in a worktree returns its artifact path relative to the
  main checkout, or hands the content back in its return value.
- `${CLAUDE_PROJECT_DIR}` does not follow a worktree; resolve the project root from the `cwd` field
  on hook stdin, as every Foundry hook does.
- Read-only agents (audit, research, review) must **not** use worktrees — it is pure overhead.
