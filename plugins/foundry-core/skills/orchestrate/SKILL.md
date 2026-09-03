---
name: orchestrate
description: Run multi-agent work in waves against a Foundry playbook — delivery, audit, research or migration. Use when a task needs several specialists working in parallel with gates between stages, or when the user asks to orchestrate, fan out, or run a full cycle.
argument-hint: "[playbook] [goal]"
metadata:
  foundry.vertical: core
  foundry.io: "goal -> plan.v1 -> handoff.v1 per wave"
---

# Orchestrate a multi-agent run

Turns a goal into waves of specialists, with a validated contract between each wave.

## Decide first whether to orchestrate at all

Orchestration costs real tokens: a plan, a dispatch prompt per agent, a synthesis pass. Pay it only
when the work genuinely splits.

| Signal | Action |
|---|---|
| One specialist covers the whole task | Delegate once, no orchestration |
| Independent areas that do not need each other's output | Orchestrate, one wave |
| Stages where each needs the previous stage's result | Orchestrate, several waves |
| Unknown-size discovery (audit every route, migrate every module) | Scout, then a dynamic workflow |

If you decide not to orchestrate, say why in one line and proceed directly.

## Choose the execution mechanism

Three mechanisms exist. They are not interchangeable.

1. **In-session fan-out** — `Agent` calls from the `foundry-orchestrator`. Best for 2–6 specialists
   where you want to steer between waves. Subagents nest up to three levels.
2. **Dynamic workflow** — a script in `workflows/`, run with the `Workflow` tool. Best when the
   item list is discovered at runtime and the same treatment applies to each item (audit sweep,
   migration, per-file review). Deterministic and rerunnable.
3. **Headless fan-out** — `${CLAUDE_PLUGIN_ROOT}/scripts/fanout.mjs` spawning `claude -p` processes. Best in CI, or for
   work larger than one session's context. Requires the CLI to be authenticated.

## Procedure

This skill runs **inline in the main conversation**. That is the only layer that can gate between
waves, put a question to the user and reach the `Workflow` tool — a subagent has none of those.
So choose one of the two shapes below and commit to it. Mixing them is how a run ends up with a
gate nobody could ever execute.

### Shape A — drive the waves yourself (the default, 2–6 specialists)

1. **Recall.** `memory_search` for prior decisions in this area. Contradicting a recorded decision
   without acknowledging it invalidates the whole run.
2. **Plan.** Load `playbooks/<name>.yaml`, or derive waves. Write `plan.v1` to
   `.foundry/blackboard/plan/orchestrator.json` with `blackboard_write`.
3. **Dispatch one wave.** Emit every `Agent` call in the wave in a **single message** — that is
   what makes them run concurrently; one call per message is a queue, not a wave. Give each agent
   artifact *paths*, never artifact contents, its output contract id, and the instruction to write
   results with `blackboard_write` and return ≤300 tokens.
4. **Gate.** When the wave's agents have reported, call `contract_validate` yourself for every
   artifact they name. Do not wait to be told by the `validate-contract` hook: it is a `PostToolUse`
   hook and it injects its violations into the context of the agent that made the write, not into
   yours. Re-dispatch a failing agent with the errors `contract_validate` returned, then return to
   step 3 for the next wave.
5. **Synthesise.** Read summaries with `blackboard_read`. Write the answer yourself; resolve
   disagreements between specialists explicitly rather than averaging them.
6. **Record.** `memory_write` for every decision, constraint and risk the run produced.

### Shape B — delegate the whole run (a plan too large to hold in this context)

Do steps 1 and 2, then dispatch the `foundry-core:foundry-orchestrator` agent with the plan
*path*. It runs every wave inside its own turn and returns exactly once, so there is no moment at
which control comes back to you mid-run: **you cannot gate between its waves, and it gates its own.**
When it returns, read its `handoff.v1`, verify with `contract_validate` the artifacts it names, and
if `status` is `"blocked"` put the decision it states to the user — the orchestrator is a subagent
and cannot ask anyone anything. Then do step 6 yourself.

## Isolation

Each mechanism isolates differently, and only the first does it for you.

- **In-session agents** that write files while other agents also write must be dispatched with
  `isolation: "worktree"`; read-only agents must not — the setup cost buys nothing. Gitignored
  files needed inside a worktree go in `.worktreeinclude` at the repository root; the runtime
  copies those paths file by file and skips symlinks. `.foundry/blackboard/` is gitignored and so
  is per-worktree: an isolated writer's artifact is invisible from the main checkout, so have it
  return the content or a path relative to the main checkout.
- **Headless fan-out has no isolation.** `fanout.mjs` passes neither `--worktree` nor a per-worker
  `cwd`, so every `claude -p` process runs in this same checkout. That is safe with the default
  read-only allowlist (`Read,Grep,Glob`). If you pass `--allowed-tools` including `Write` or
  `Edit`, every worker must have a disjoint target path — one item per file is the shape that
  makes this true. If they cannot be disjoint, do not use fan-out for that work.

## Escalation

Stop and ask the user when a gate fails twice, when specialists disagree on something material,
when the budget would be exceeded, or before any irreversible action that was not explicitly
authorised. You can do this because you run inline; the agents you dispatch cannot, so treat a
returned `status: "blocked"` as their version of the same request and carry it to the user.

## Definition of done

Every wave artifact validates against its contract, the synthesis names its sources, and the
decisions taken are in memory. See `references/playbook-format.md` for the playbook schema.
