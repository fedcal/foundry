---
name: contracts
description: Work with Foundry I/O contracts — validate an artifact, choose the right schema for a handoff, or add a new contract version. Use when writing to the blackboard, when a contract validation error appears, or when designing a new agent's output.
argument-hint: "list | validate <schema> <path> | new <name>"
model: haiku
effort: low
metadata:
  foundry.vertical: core
  foundry.io: "artifact -> validation result"
---

# I/O contracts

Contracts are what let twelve plugins written by different authors interoperate. An agent's output is
not "some markdown" — it is a named, versioned, machine-checkable artifact.

## Available contracts

| Contract | Use for |
|---|---|
| `fact.v1` | one durable project fact |
| `finding.v1` | a defect, gap or risk found by an audit or review |
| `review.v1` | the outcome of a review pass, containing findings |
| `adr.v1` | an architecture decision with options and consequences |
| `requirement.v1` | a requirement with Given/When/Then acceptance criteria |
| `plan.v1` | a wave-based execution plan with gates |
| `risk.v1` | a quantified risk with an owned mitigation |
| `estimate.v1` | a three-point estimate with explicit assumptions |
| `compliance-check.v1` | one control assessed against one jurisdiction |
| `handoff.v1` | what one wave passes to the next |

Full schemas: `${CLAUDE_PLUGIN_ROOT}/schemas/*.schema.json`.

## Validate

```
contract_validate(schema: "finding.v1", path: ".foundry/blackboard/audit/appsec-reviewer.json")
```

Writing to the blackboard validates automatically — the `PostToolUse` hook returns the violations
to the agent, which then corrects itself. Prefer `blackboard_write`, which validates before it
writes and never leaves an invalid artifact on disk.

## Reading a validation error

Errors are JSON pointers: `#/findings/2/failureScenario: missing required property`. That means the
third finding has no failure scenario — which is the contract enforcing that a finding without a
concrete failure path is speculation, not a finding. Fix the content, not the schema.

## Adding a contract

1. Copy the shape of an existing schema: `$schema` 2020-12, `$id` under
   `https://fedcal.github.io/foundry/schemas/`, `additionalProperties: false`, and the two universal
   properties `schema` and `producedBy`.
2. Make required fields the ones whose absence would make the artifact useless — nothing more.
   Over-required schemas get worked around.
3. Never edit a published `vN` schema. Add `vN+1` and migrate consumers deliberately.

## Design rule

A field exists to be acted on. If no consumer reads it, delete it. The most common contract defect
is a schema that records everything and enables nothing.
