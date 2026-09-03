---
title: Authoring assets
description: A readable walkthrough of the rules every Foundry agent, skill, hook and workflow must satisfy — CI enforces them.
sidebar:
  order: 5
---

:::note[The normative source is the file, not this page]
[`AUTHORING.md`](https://github.com/fedcal/foundry/blob/main/AUTHORING.md) in the repository root
is normative, and `scripts/validate-assets.mjs` enforces it in CI. This page explains it; where the
two differ, the file wins.
:::

`AUTHORING.md` was verified against the official Claude Code documentation on **2026-08-27** for
Claude Code **2.1.247**. Do not author against memory of older schemas.

## The seven non-negotiable rules

| # | Rule | Why |
|---|---|---|
| 1 | **English only** in every asset — agents, skills, hooks, commands, workflows, code comments. | User-facing docs are bilingual and live in `site/`, never inside plugins. |
| 2 | **No vendored third-party content.** | Everything here is original work licensed Apache-2.0. |
| 3 | **Never duplicate `superpowers`.** If a capability exists there, invoke it. | Reimplementing TDD discipline or debugging methodology produces two subtly different versions of the same idea. |
| 4 | **No GSD.** Nothing may reference, require or reimplement `gsd-*`. | |
| 5 | **Zero runtime dependencies.** Node.js ≥ 20, standard library only. | `npm install` is never required to use Foundry. |
| 6 | **Cross-platform.** Hook *exec form* (`command` + `args`), never shell pipelines. | Hooks must run unmodified on Linux, macOS and Windows. |
| 7 | **No generic filler.** An asset that could apply to any project without change is a defect. | Every asset names concrete files, commands, thresholds, standards or failure modes. |

## Agent frontmatter

```yaml
---
name: kebab-case-unique          # required, no ':' (reserved for plugin namespacing)
description: <when Claude should delegate here>   # required, decides routing
tools: Read, Grep, Glob, Bash    # omit to inherit all
disallowedTools: Write, Edit     # applied before tools resolution
model: sonnet                    # sonnet|opus|haiku|fable|<full id>|inherit
effort: medium                   # low|medium|high|xhigh|max
maxTurns: 20
permissionMode: default          # default|acceptEdits|auto|dontAsk|plan|bypassPermissions
skills: [skill-a, skill-b]       # preloaded into the agent context at startup
mcpServers: [foundry]            # scoped to this agent only
memory: project                  # user|project|local
background: false
isolation: worktree              # temporary git worktree, isolated checkout
color: cyan
hooks: { ... }                   # agent-scoped hooks
---
```

`description` is the routing key. It decides whether Claude delegates here at all, so write it as
*when to use this and when not to*, not as a job title.

### Tools withheld from subagents

Subagents nest up to three levels below the main conversation and communicate with `SendMessage`.
At the depth limit the `Agent` tool is withheld. These tools are **always** withheld from
subagents, so never write an agent that depends on them:

`AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode`, `ScheduleWakeup`,
`TaskOutput`, `Workflow`.

Cap the depth explicitly with `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`.

## Skill frontmatter

```yaml
---
name: kebab-case
description: <what it does AND when to use it>   # this is the retrieval key
allowed-tools: Read Grep Glob                    # space-separated; restricts and pre-approves
disallowed-tools: Write Edit
disable-model-invocation: true                   # user-invocable only (/name)
user-invocable: true
argument-hint: "[path] [--fix]"
context: fork                                    # run the skill in its own subagent context
agent: <agent-name>                              # run through a specific agent
model: haiku
effort: low
paths: ["src/**"]                                # scope the skill to matching paths
metadata: { foundry.vertical: dev, foundry.io: "input->output" }
license: Apache-2.0
---
```

The `SKILL.md` body **must stay under 500 lines** — `validate-assets.mjs` fails the build at 501.
Anything longer goes in `references/*.md`, `scripts/` or `templates/` and is loaded only on demand.
That is progressive disclosure, and it is the difference between a skill that costs 400 tokens to
consider and one that costs 4000.

## Model and effort routing

Declare `model:` and `effort:` on **every** agent. Deviating requires a one-line justification in
the agent body.

| Work | model | effort |
|---|---|---|
| Extraction, classification, formatting, index generation, lint triage | `haiku` | `low` |
| Implementation, review, test authoring, refactoring, docs | `sonnet` | `medium` |
| Architecture, threat modelling, legal analysis, economic modelling, final synthesis | `opus` | `high` |
| Adversarial verification of a high-stakes finding | `opus` | `xhigh` |

### The context firewall is mandatory

Any agent that reads a lot — research, audit, sweep — MUST:

1. write its full output to `.foundry/blackboard/<wave>/<agent>.json`, and
2. return to its caller **only** the artifact path plus a summary of **at most 300 tokens**.

Returning raw file dumps to the parent context is a defect, and the `SubagentStop` gate enforces
it at three times the configured budget. See [Hooks](/foundry/en/reference/hooks/).

## The memory model

Four tiers. Never invent a fifth.

| Tier | Path | Lifetime | Git |
|---|---|---|---|
| T0 scratch | `.foundry/scratch/<session>/` | session | ignored |
| T1 facts | `.foundry/memory/facts/<id>.md` | project | tracked |
| T2 runbooks | `.foundry/runbooks/<slug>.md` | project | tracked |
| T3 decisions | `docs/adr/NNNN-<slug>.md` | forever | tracked |

Fact bodies are at most 120 words. Facts of type `decision` and `risk` must include a `**Why:**`
and a `**How to apply:**` line — `foundry doctor` fails if they do not. Link related facts with
`[[fact-id]]`.

`.foundry/memory/INDEX.md` is generated, is the **only** memory file loaded into context by
default, and is hard-capped at 4000 tokens. Everything else is retrieved on demand through the
`foundry` MCP server.

**Never** write memory by hand from an agent. Call `memory_write`, which deduplicates, assigns ids
and maintains supersedes chains.

## I/O contracts

Every agent declares, verbatim, in its body:

```
## Input contract
`<schema-id>` — <what it needs>

## Output contract
`<schema-id>` — written to `.foundry/blackboard/<wave>/<agent>.json`
```

Schemas are listed in [Contracts](/foundry/en/reference/contracts/). Breaking a schema means adding
`*.v2`, never editing `*.v1`.

## Hooks

Foundry uses these events, out of the 31 available:

| Event | Blocking | Matcher target |
|---|---|---|
| `SessionStart` | no | `startup`, `resume`, `clear`, `compact`, `fork` |
| `UserPromptSubmit` | yes | — |
| `PreToolUse` | yes | tool name |
| `PostToolUse` | no | tool name |
| `PostToolUseFailure` | no | tool name |
| `PostToolBatch` | yes | — |
| `PermissionRequest` | via decision | tool name |
| `SubagentStart` / `SubagentStop` | stop: yes | agent type |
| `Stop` | yes | — |
| `PreCompact` / `PostCompact` | pre: yes | `manual`, `auto` |
| `TaskCreated` / `TaskCompleted` | yes | — |
| `InstructionsLoaded` | no | load reason |
| `FileChanged` | no | literal filenames |
| `WorktreeCreate` | yes | — |
| `SessionEnd` | no | end reason |

Entry shape, always exec form:

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

Output contract on stdout:

```json
{ "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "...",
    "additionalContext": "...",
    "updatedInput": { }
} }
```

Budgets that matter: `SessionEnd` hooks share **1.5 s** across all plugins; `UserPromptSubmit` has
a 30 s timeout and every prompt pays it. Exit 0 with no stdout means *no opinion*.

## Workflows

Plain JavaScript with top-level `await`, starting with a pure-literal `meta`:

```js
export const meta = {
  name: 'foundry-feature-delivery',
  description: 'Wave-based delivery: analysis -> implementation -> convergence',
  phases: [{ title: 'Analysis' }, { title: 'Implementation' }, { title: 'Convergence' }],
}
```

Available: `agent(prompt, opts)`, `parallel(thunks)`, `pipeline(items, ...stages)`, `phase(title)`,
`log(msg)`, `args`, `budget`, `workflow(nameOrRef, args)`.

`Date.now()`, `new Date()` and `Math.random()` **throw**. Pass timestamps through `args`.

Prefer `pipeline()` over `parallel()`: use a barrier only when a stage genuinely needs every prior
result at once.

## Substitution variables

| Variable | Resolves to | Use for |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | plugin install directory | bundled scripts, schemas, templates |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/{id}/`, survives updates | caches, generated state |
| `${CLAUDE_PROJECT_DIR}` | project root; stays at the main checkout in worktrees | project-local paths |
| `${CLAUDE_SKILL_DIR}` | the skill's own directory | scripts referenced in `allowed-tools` |
| `${user_config.KEY}` | plugin `userConfig` value | configurable endpoints and paths |

In worktrees `${CLAUDE_PROJECT_DIR}` does **not** follow the worktree. Read `cwd` from hook stdin
instead — that is what `projectRoot()` in `lib/foundry.mjs` does.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Plugins | `foundry-<vertical>` | `foundry-dev` |
| Agents | `<domain>-<role>` | `angular-architect`, `gdpr-analyst`, `cost-engineer` |
| Skills | `<verb>-<object>` or `<domain>-<artifact>` | `design-api-contract`, `adr-write` |
| Commands and user-invocable skills | `/foundry-<vertical>:<name>` | `/foundry-legal:compliance-scan` |
| Blackboard files | `.foundry/blackboard/<wave>/<agent>.json` | |
| Schemas | `<noun>.v<major>.schema.json` | `finding.v1.schema.json` |

## Interop with `superpowers`

A soft dependency, detected at runtime, never assumed.

| Need | Delegate to |
|---|---|
| Test-first discipline | `superpowers:test-driven-development` |
| Root-causing a failure | `superpowers:systematic-debugging` |
| Turning an idea into a spec | `superpowers:brainstorming` |
| Turning a spec into a plan | `superpowers:writing-plans` |
| Reviewing and receiving review | `superpowers:requesting-code-review`, `superpowers:receiving-code-review` |
| Claiming completion | `superpowers:verification-before-completion` |

The pattern to use inside a skill:

> If the `superpowers` plugin is installed, invoke `superpowers:test-driven-development` and follow
> it. If it is not, apply the reduced checklist in `references/tdd-fallback.md`.

## Worktrees and parallelism

- An agent that writes files while other agents also write files MUST declare
  `isolation: worktree`.
- Worktrees land in `.claude/worktrees/<name>/`. Gitignored files needed inside them are listed in
  `.worktreeinclude` at the repository root. The runtime copies those entries **file by file and
  skips symlinks**, so a directory holding any arrives incomplete — list real files, and verify.
- **Foundry registers no `WorktreeCreate` hook.** The event exists and a hook on it may prepare the
  environment (a non-zero exit aborts creation), but nothing links Foundry state into a worktree
  automatically. Committed `.foundry/` content arrives through git; `.foundry/blackboard/` is
  gitignored and therefore per-worktree, so an artifact written inside a worktree is invisible to
  the main checkout.
- `${CLAUDE_PROJECT_DIR}` does not follow a worktree; resolve the project root from the `cwd` field
  on hook stdin, as every Foundry hook does.
- Read-only agents — audit, research, review — must **not** use worktrees. It is pure overhead.

## The quality bar

An asset ships only if all of these hold:

- [ ] It names **concrete** artifacts: real file paths, real commands, real config keys.
- [ ] It states **when not to use it** and what it deliberately does not cover.
- [ ] It defines **measurable** exit criteria — thresholds, counts, gates — not "make it good".
- [ ] It declares `model:`/`effort:` and respects the routing table.
- [ ] It declares input/output contracts (agents) or progressive disclosure (skills).
- [ ] It degrades gracefully when an optional dependency (`superpowers`, an MCP server, a CLI such
      as `gh`) is absent — detect, announce, continue.
- [ ] Body ≤ 500 lines; longer material moved to `references/`.
- [ ] It cites the standard it enforces where one exists — WCAG 2.2 SC number, OWASP ASVS control
      id, ISO clause, GDPR article, RFC number.

## Checking your work

```bash
node scripts/validate-assets.mjs
```

The validator checks the marketplace manifest, every `plugin.json`, agent and skill frontmatter,
the model and effort enums, the 500-line skill limit, and scans for Italian text leaking into an
asset. It runs in CI and is expected to pass with zero errors.
