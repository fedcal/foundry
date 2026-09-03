---
name: token-budget
description: Measure and reduce what a Claude Code session costs — where tokens go, which levers actually move the number, and how much Foundry's memory system is saving. Use when a session feels expensive, before starting long work, or when the user asks about cost, token usage or context pressure.
argument-hint: "[report | plan | audit]"
model: haiku
effort: low
metadata:
  foundry.vertical: core
  foundry.io: "project -> token report"
---

# Token budget

Cost control is an engineering problem with measurable levers, not an attitude. Measure first.

## report

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs" tokens
```

Also call the `token_report` tool on the `foundry` MCP server. For the breakdown of what is
actually resident in the window, ask the user to run `/context` and paste the result — `/context`
is a built-in CLI command, not a skill and not a tool, so you cannot invoke it yourself and must
not report a breakdown you did not receive.

Report the numbers you measured, never an estimate presented as a measurement.

## The levers, ordered by how much they move

### 1. Context firewall (largest)

A subagent has its own context window. If it returns a wall of text, the parent pays for everything
the child read, and the isolation bought nothing. Foundry enforces this at `SubagentStop`: a reply
over 3× the 300-token handoff budget is rejected with instructions to write a blackboard artifact
instead.

Applies to every research, audit and sweep agent. Check compliance with:

```bash
grep -c '"kind":"subagent_return"' .foundry/metrics/events.jsonl
```

### 2. Index-first retrieval

Loading every stored fact eagerly costs the full memory size on every session. Loading an index and
retrieving 3–5 facts on demand costs a fraction. `token_report` prints both numbers for this
project — use them, they are specific to it.

### 3. Model and effort routing

Extraction, classification, formatting and lint triage do not need a frontier model. Architecture,
threat modelling and legal analysis do. Every Foundry agent declares `model:` and `effort:`;
an agent doing cheap work on an expensive model is a defect worth fixing.

### 4. Progressive disclosure

A `SKILL.md` is loaded when the skill fires. Keeping it under 500 lines and pushing depth into
`references/` means the depth is paid for only when needed.

### 5. Prompt cache alignment

The cache is invalidated by changes near the start of the context. Editing `CLAUDE.md` mid-session,
switching models, or compacting all cost a full uncached turn. Batch instruction changes rather
than trickling them, and prefer starting a fresh session to fighting a polluted one.

### 6. Compaction discipline

Compaction summarises the transcript; anything not written down is lost. There is no model turn
between the decision to compact and the compaction itself, so nothing can prompt you to save your
work at that moment — **persist as you go**: call `memory_write` when a decision is taken, not at
the end of the session.

Foundry's `PreCompact` hook does not and cannot ask you for anything. Its only channel is plain
stdout, which the runtime joins into the instructions given to the compaction *summariser*, so all
it can do is tell the summariser what must survive the summary. Treat it as a safety net for what
you forgot to write down, never as the reminder you were relying on.

## audit

Walk the project's own Foundry assets and report:

- agents whose `model`/`effort` do not match their work class;
- skills whose `SKILL.md` exceeds 500 lines;
- research agents without an output contract (they will return dumps);
- an index over budget;
- facts that are expired, superseded, duplicated or missing their `**Why:**` line —
  `node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs" memory prune` lists exactly these, and deletes
  nothing;
- questions memory failed to answer:
  `grep '"kind":"memory_search"' .foundry/metrics/events.jsonl | grep '"hits":0'`. A query that
  repeatedly returns nothing is a gap in memory, not noise in it.

Do **not** report "facts never retrieved". Nothing records it: `memory_search` logs the query and
the number of hits, never which fact ids came back, so that number cannot be derived from anything
Foundry stores. Saying it anyway would be exactly the estimate-presented-as-a-measurement this
skill exists to prevent.

## What this skill does not do

It does not report your Anthropic billing — that is `/cost` and `/usage`. It reports what *this
project's configuration* costs and what to change about it.
