# Playbook format

A playbook is a declarative description of a multi-wave run. It exists so that the same
orchestration can be reviewed, reused and argued about without re-deriving it from a prompt every
time.

Playbooks live in `${CLAUDE_PLUGIN_ROOT}/playbooks/*.yaml` (shipped) and `.foundry/playbooks/*.yaml`
(project-specific). Project playbooks with the same `id` take precedence.

## Schema

```yaml
id: <kebab-case, unique>
description: <one line: what this run produces>
goal: "<the goal, or a {{placeholder}} filled at dispatch>"

waves:
  - id: <kebab-case>
    description: <why this wave exists as a separate step>

    # Exactly one of `parallel`, `sequential` or `parallel_per_finding`.
    parallel:                      # tasks with no dependency on each other
      - agent: <agent name>        # must exist in an installed plugin
        contract: <schema id>      # the artifact it must produce
        isolation: worktree        # only when it writes files concurrently
    sequential:                    # tasks where each needs the previous result
      - agent: <agent name>
        contract: <schema id>

    inputs_from: <wave id>         # which wave's artifacts this one reads
    gate:                          # machine-checkable exit conditions
      <condition_name>: true
    on_gate_failure: redispatch_once_then_escalate | escalate | continue

escalate_to_user:                  # conditions that always stop the run
  - <plain-language condition>

notes:                             # rules a reader must know; kept out of the machinery
  - <note>
```

## Rules that make a playbook work

**A wave is a dependency boundary, not a theme.** Two tasks belong in the same wave only if
neither needs the other's output. Grouping by topic instead of by dependency serialises work that
could have run in parallel, and parallelises work that cannot.

**Every task names its output contract.** If you cannot say which schema a task produces, the task
is not defined yet. That is a signal to split it, not to leave the field out.

**Gates are assertions the orchestrator must check itself, and they must be checkable.**
Nothing in Foundry parses these files: there is no gate evaluator, and a playbook is read by an
agent, not executed by a runtime. So a gate is a condition the orchestrating agent is required to
verify explicitly — by running a named command, or by inspecting the artifacts on the blackboard —
before it may move to the next wave. `all_artifacts_valid: true` qualifies, because
`contract_validate` answers it; `quality_is_good: true` does not. If a condition can only be
judged by a human, put it in `escalate_to_user` instead, where it belongs. Writing a gate no one
can check is worse than writing none: it reads as a guarantee and behaves as a comment.

**`isolation: worktree` is for concurrent writers only.** A read-only agent in a worktree pays the
setup cost and gains nothing. Getting this wrong is the commonest way a playbook becomes slow.

**Escalation is not failure.** A run that stops and asks a good question has done its job better
than one that guesses and produces a confident wrong answer.

## Placeholders

`{{goal}}` and any other `{{name}}` are substituted at dispatch from the arguments given to the
`orchestrate` skill. A playbook with an unsubstituted placeholder must fail loudly rather than
running with the literal text — an agent asked to implement `{{goal}}` will produce something, and
that something will be wrong.

## Worked example

`${CLAUDE_PLUGIN_ROOT}/playbooks/feature-delivery.yaml` — three waves (analysis, implementation,
convergence), parallel within each, worktree isolation only in the wave that writes code, and gates
that check acceptance criteria rather than task completion.

`${CLAUDE_PLUGIN_ROOT}/playbooks/audit.yaml` — scope, audit across lenses, adversarial verification
per finding, then report. Note its `notes` section: finding nothing is a valid result, and a
finding without a failure scenario must not reach the user.

## When a playbook is the wrong tool

When the item list is discovered at runtime and every item gets the same treatment — auditing every
route, migrating every module — a **dynamic workflow** in `workflows/*.js` is better: it loops,
it is deterministic, and it can be rerun from a cached prefix. A playbook describes a fixed shape;
a workflow describes a computation.
