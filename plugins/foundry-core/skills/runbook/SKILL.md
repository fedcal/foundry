---
name: runbook
description: Find, follow, create or revise an operational runbook. Use BEFORE starting any recurring or error-prone task (deploy, release, migration, incident, audit), and immediately AFTER finishing one that someone will repeat.
argument-hint: "list | get <slug> | write <slug>"
metadata:
  foundry.vertical: core
  foundry.io: "procedure -> .foundry/runbooks/<slug>.md"
---

# Runbooks

A procedure that exists must be followed rather than re-derived. Re-deriving is how a team pays
for the same mistake twice.

## Before the work: check

```
runbook_list()          # via the foundry MCP server
runbook_get(slug)       # full text
```

If a runbook matches the task, follow it exactly — commands, order, gates. If you believe a step is
wrong, say so and propose a revision; do not silently take a different path. Silent deviation is
what makes runbooks rot until nobody trusts them.

If none matches and the task is recurring or error-prone, plan to write one afterwards.

## After the work: write or revise

Dispatch the `runbook-author` agent. It reconstructs what was actually done, including the wrong
turns — those become the "Known traps" section, which is the most valuable part of the document.

Required structure:

1. When to use / when not to use
2. Preconditions (each independently checkable)
3. Steps (exact command, expected output, what to do when it differs)
4. Gates (where to stop unless a condition holds)
5. Rollback (and the point of no return) — mandatory for anything mutating
6. Known traps (symptom → fix)
7. Definition of done
8. Changelog (dated)

## The revision rule

A runbook that failed you is not a bad runbook, it is an incomplete one. When a step did not work:

1. fix the step;
2. add the failure to Known traps with its symptom;
3. update `lastVerified` only if you actually executed the steps;
4. add a dated changelog line.

Never leave a known trap undocumented because "it was obvious once we saw it". It was not obvious
before, and it will not be obvious next time either.

## What this skill does not do

It does not document architecture — that is an ADR. It does not explain concepts — that is
documentation. A runbook is for an operator executing a procedure under time pressure.
