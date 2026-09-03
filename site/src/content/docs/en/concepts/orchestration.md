---
title: Orchestration
description: Three execution mechanisms and when each is right, waves and gates, the three-level nesting limit, SendMessage, the context firewall and worktree isolation.
sidebar:
  order: 5
---

Orchestration costs real tokens: a plan, a dispatch prompt per agent, a synthesis pass. Pay it only
when the work genuinely splits. The first decision is always whether to orchestrate at all.

| Signal | What to do |
|---|---|
| One specialist covers the whole task | Delegate once. No orchestration |
| Independent areas that do not need each other's output | Orchestrate, one wave |
| Stages where each needs the previous stage's result | Orchestrate, several waves |
| Discovery of unknown size — audit every route, migrate every module | Scout first, then a dynamic workflow |

If the answer is no, say so in one line and proceed. Ceremony around a one-step task is a defect,
not diligence.

## Three mechanisms

They are not interchangeable. Choosing the wrong one is the most common way an orchestrated run
becomes more expensive than doing the work directly.

| Mechanism | How it runs | Right when | Wrong when |
|---|---|---|---|
| **In-session fan-out** | `Agent` calls from the `foundry-orchestrator` agent | 2–6 specialists, and you want to steer between waves | The item list is only known at runtime, or the work exceeds one context |
| **Dynamic workflow** | A script in `workflows/`, run with the `Workflow` tool | The item list is discovered at runtime and the same treatment applies to each item: audit sweep, migration, per-file review | The steps need human judgement between them |
| **Headless fan-out** | `claude -p` processes | CI, or work larger than a single session's context | You want to intervene mid-run; the CLI is not authenticated |

`foundry-core` ships three workflows — `feature-delivery.js`, `audit-sweep.js` and
`compliance-sweep.js` — and two playbooks, `feature-delivery.yaml` and `audit.yaml`.

The headless driver ships with the kernel at `${CLAUDE_PLUGIN_ROOT}/scripts/fanout.mjs`. It reads a
JSON array of work items, spawns one `claude -p` process per item at a fixed concurrency, and
collects the results into a JSON file — nothing is streamed back into a parent conversation.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fanout.mjs" \
  --items routes.json \
  --prompt "Audit {{item}} for missing authorisation checks" \
  --concurrency 4 \
  --allowed-tools "Read,Grep,Glob" \
  --out audit-results.json
```

`--items` takes a file or `-` for stdin. `{{item}}` and `{{index}}` are substituted into the
prompt. `--dry-run` prints the commands without running them, `--model` and `--mcp-config` are
passed through, and the process exits non-zero if any item failed.

:::caution[It needs an authenticated CLI]
Each item is a real `claude -p` process, so `claude` must be on `PATH` and authenticated — in CI
that means providing credentials to the runner. The tool allowlist defaults to `Read,Grep,Glob`:
widen it deliberately, because every spawned process inherits whatever you grant.
:::

### What a workflow may and may not do

A workflow is plain JavaScript with top-level `await` and a pure-literal `meta` export naming the
phases. Inside it you get `agent(prompt, opts)`, `parallel(thunks)`, `pipeline(items, ...stages)`,
`phase(title)`, `log(msg)`, `args`, `budget` and `workflow(nameOrRef, args)`.

`Date.now()`, `new Date()` and `Math.random()` **throw**. Determinism is the point: a workflow that
cannot observe the clock produces the same run twice, which is what makes it rerunnable. Pass a
timestamp through `args` when you need one.

Prefer `pipeline()` to `parallel()`. A barrier that waits for every prior result is right only when
a stage genuinely needs all of them at once; `audit-sweep.js` uses a pipeline over every
(subsystem × lens) pair so a slow lens never blocks a fast one.

## Waves and gates

A **wave** is a set of tasks none of which needs another's output. Two tasks belong in the same wave
only if neither consumes the other's result. Getting this wrong is what produces agents waiting on
files that do not exist yet.

A **gate** is the condition for advancing. It has two parts:

1. Every artifact the wave produced validates against its contract. The `validate-contract` hook
   reports violations automatically; the orchestrator re-dispatches the failing agent **with the
   validation errors**, rather than repairing the artifact itself.
2. The wave's own exit criteria from `plan.v1`, which the schema describes as machine-checkable —
   a count, a threshold, a command that must pass, not "looks good".

If a gate fails twice, the run stops and escalates to the user with what failed, what was tried,
and the two or three options available. Silently lowering the bar is the failure mode gates exist
to prevent.

`feature-delivery.js` shows the shape: Analysis produces requirements, an ADR and a threat model in
parallel; Implementation runs only once the contracts are agreed; Convergence reviews the result
against what Analysis decided.

## Nesting, and what subagents cannot do

Subagents nest **up to three levels** below the main conversation. At the depth limit the `Agent`
tool is simply withheld, so a fourth-level spawn does not error dramatically — the tool is not
there. Cap it lower with `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`.

Spend the depth deliberately. A specialist that needs to split its own work may fan out once more;
a third level almost always means the decomposition above it was wrong.

These tools are **always withheld** from subagents at any depth:

`AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode`, `ScheduleWakeup`,
`TaskOutput`, `Workflow`.

Two consequences that shape every design here. A subagent cannot ask the user anything, so a
question must travel back up as an open question in its handoff and be asked by the main
conversation. And a subagent cannot start a workflow, so the workflow mechanism belongs to the main
conversation only — you cannot nest a workflow inside a fan-out.

### SendMessage

Agents communicate with `SendMessage`; the `foundry-orchestrator` declares it in its `tools` list
alongside `Agent`. The rule that matters is not about the tool but about what you put in it: pass
artifact **paths**, never artifact contents. Pasting a file into a dispatch prompt charges the
parent for it and then charges the child for it again.

Each dispatch carries three things: the exact paths to read, the output contract id, and the
instruction to write results with `blackboard_write` and return at most 300 tokens.

## The context firewall

A subagent has its own context window, which is the entire reason to use one. If it returns
everything it read, the parent pays for all of it and the isolation bought nothing.

The `SubagentStop` hook measures the returned message and denies anything over three times
`handoffSummaryTokenBudget` — 900 tokens by default — with instructions to write the full output to
the blackboard and reply with the path, a summary within budget, and any blocking question.

It runs only at `enforcement: gate`. See [Gates](/foundry/en/concepts/gates/) for the full matrix.

## Worktree isolation for concurrent writers

Agents that write files **while other agents are also writing files** must declare
`isolation: worktree`. Read-only agents — audit, research, review — must not: the setup cost buys
nothing when there is nothing to conflict over.

Worktrees are created at `.claude/worktrees/<name>/`. Gitignored files that are nevertheless needed
inside them go in `.worktreeinclude` at the repository root.

**Foundry registers no `WorktreeCreate` hook, and nothing links Foundry state into a worktree.**
The event exists, but a hook on it aborts worktree creation on any non-zero exit — too heavy a
failure mode for a convenience. So know what actually arrives:

- Whatever of `.foundry/` is **committed** — memory, runbooks, config — arrives through git, like
  any other tracked file.
- `.foundry/blackboard/` is gitignored, so it is **absent from a fresh worktree and per-worktree
  once created**. An artifact an agent writes there is invisible to the main checkout and to its
  sibling agents. An isolated agent must therefore hand its artifact back in its return value, or
  write it under the main checkout, which it resolves from the hook `cwd` — not from
  `${CLAUDE_PROJECT_DIR}`, which does not follow a worktree.
- In a project where `.foundry/` is gitignored entirely, a worktree agent starts with **no Foundry
  state at all**. List what must travel in `.worktreeinclude`, as real files: the runtime copies
  entries one by one and **skips symlinks**, logging `Skipping symlink in .worktreeinclude`, so a
  directory holding any arrives incomplete while appearing to have been copied.

The practical consequence: use `isolation: worktree` for agents that write **source files** in
parallel, which is what it is for. Do not use it for agents whose whole job is to exchange
artifacts through the blackboard — they would each be writing into a private copy.

## The procedure, end to end

1. **Recall.** `memory_search` for prior decisions in this area. A plan that contradicts a recorded
   decision without acknowledging it is wrong by construction.
2. **Plan.** Load a playbook or derive the waves. Write `plan.v1` to
   `.foundry/blackboard/plan/orchestrator.json`.
3. **Dispatch.** One agent per task, the most specific one available, given paths and an output
   contract. Never spawn an agent whose output you cannot describe in advance — if you cannot state
   its contract, the task is not defined yet.
4. **Gate.** Confirm every artifact validates. Re-dispatch failures with the errors.
5. **Synthesise.** Read summaries with `blackboard_read`, not `full`. Write the answer yourself.
   Where two specialists disagree, say so and say which is better supported — do not average them.
6. **Record.** `memory_write` for every decision, constraint and risk the run produced. This is the
   step that makes the next run cheaper, and the step most often skipped.
