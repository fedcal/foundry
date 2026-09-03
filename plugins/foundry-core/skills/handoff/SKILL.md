---
name: handoff
description: Hand work from one agent or session to the next without dumping context — write the artifact, summarise inside budget, and state what is unresolved. Use when finishing a delegated task, ending a wave, or pausing work that someone else will resume.
model: haiku
effort: low
metadata:
  foundry.vertical: core
  foundry.io: "work -> handoff.v1"
---

# Handoff

The rule: **artifacts travel by path, understanding travels by summary.**

A subagent runs in its own context window. Everything it read was paid for once, in its own
context. Pasting that material into the reply makes the parent pay for it a second time and throws
away the entire benefit of isolation. Foundry enforces this at `SubagentStop`.

## Procedure

1. Write the full output with `blackboard_write`:

```
blackboard_write(wave: "<wave>", agent: "<your name>", schema: "<contract id>", data: { ... })
```

It validates before writing, so an invalid artifact never reaches disk.

2. Reply with **at most 300 tokens**, in this shape:

```
ARTIFACT: .foundry/blackboard/<wave>/<agent>.json (<contract>)
RESULT: <the finding or conclusion in 1-3 sentences>
CONFIDENCE: high | medium | low — <what would change it>
BLOCKED: <what you could not do, or "nothing">
NEXT: <the single most useful next step>
```

3. Nothing else. No file contents, no diffs, no listings, no restatement of the task.

## Pausing work for a human

When the handoff is to a person rather than an agent, add to the artifact: the current state, the
next concrete action, anything half-done that would confuse someone arriving fresh, and where the
work in progress lives. Write it as a `handoff.v1` artifact and record a memory fact if any
decision was taken along the way.

## Why the limit is hard

Three hundred tokens is roughly a paragraph. That is enough to convey a conclusion and its
confidence. It is not enough to convey evidence — and it should not be: evidence belongs in the
artifact, where it can be re-read by whoever needs it, at the moment they need it, rather than
sitting in everyone's context forever.
