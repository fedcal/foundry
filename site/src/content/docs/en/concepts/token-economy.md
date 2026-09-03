---
title: Token economy
description: Seven mechanisms that reduce what a session costs, in order of impact, each with the code that implements it — and an honest account of how the estimate is computed.
sidebar:
  order: 3
---

Cost control is an engineering problem with measurable levers, not an attitude. Foundry implements
seven of them. Six are enforced by code; the seventh is a practice, and this page says so.

## The seven mechanisms, in order of impact

### 1. Context firewall

A subagent has its own context window. If it returns a wall of text, the parent pays for everything
the child read and the isolation bought nothing.

**Mechanism:** the `SubagentStop` hook `subagent-firewall.mjs` estimates the tokens in the
subagent's final message. Over three times `handoffSummaryTokenBudget` — 900 tokens with the default
of 300 — the return is denied and the agent is told to write a blackboard artifact and reply with
the path, a summary within budget, and any blocking question.

The gate is active at every enforcement level except `off` — it denies at `warn` exactly as it does
at `gate`. It is tuned with `handoffSummaryTokenBudget`, not with `enforcement`, so a profile that
lowers enforcement (such as `startup-mvp`) keeps the largest saving.

### 2. Index-first memory

**Mechanism:** `buildIndex()` writes one line per fact into `.foundry/memory/INDEX.md`, capped at
`indexTokenBudget`. The `SessionStart` hook injects that file and nothing else from memory. Full
fact text is retrieved on demand through `memory_search`.

The saving grows with the project: the index is capped, the corpus is not. `foundry tokens` prints
both figures for your project — use those, not an average from someone else's.

### 3. Model and effort routing

Extraction, classification and lint triage do not need a frontier model; architecture and threat
modelling do.

**Mechanism:** every Foundry agent declares `model:` and `effort:` in its frontmatter, following the
routing table in `AUTHORING.md` §2 — `haiku`/`low` for extraction and formatting, `sonnet`/`medium`
for implementation and review, `opus`/`high` for architecture and legal analysis, `opus`/`xhigh` for
adversarial verification of a high-stakes finding. Workflows pass the same two options per `agent()`
call, so `audit-sweep.js` scopes with `haiku`, audits with `sonnet` and refutes with `opus`.

An agent doing cheap work on an expensive model is a defect worth fixing, and
`scripts/validate-assets.mjs` checks that the declarations are present.

### 4. Summary-first blackboard reads

**Mechanism:** `blackboard_read` returns metadata plus a truncated summary line per artifact.
The whole artifact is returned only when the caller passes `full: true`. An orchestrator
synthesising six wave artifacts therefore reads six summaries, not six documents.

`blackboard_write` reports the artifact's size in tokens when it writes it, so an agent knows what
it would cost the parent to read it in full.

### 5. Progressive disclosure in skills

**Mechanism:** a `SKILL.md` body is capped at 500 lines by the authoring contract, and depth moves
to `references/*.md`, `scripts/` and `templates/`. The body is loaded when the skill fires; the
references are loaded only if the skill actually needs them.

### 6. Targeted prompt-time retrieval

**Mechanism:** the `UserPromptSubmit` hook `prompt-context.mjs` searches memory with the user's own
words and injects at most five facts scoring 3 or higher, plus any runbook whose trigger appears in
the prompt. Prompts shorter than 12 characters are ignored, and when nothing scores high enough the
hook exits with no output at all.

The design choice here is restraint: injecting the five best facts is cheap and usually right;
injecting twenty would cost more than letting the agent call `memory_search` when it needs to.

### 7. Compaction discipline

Compaction summarises the transcript. Anything not written down as a fact is effectively forgotten,
and the next session pays to rediscover it.

**Mechanism:** the `PreCompact` hook `precompact-persist.mjs` injects a reminder naming the current
fact count and asking for `memory_write` calls before the transcript is summarised. It does not
block — it cannot know what is worth keeping — so this is the one mechanism whose value depends on
the agent acting on it.

### The practice with no mechanism: prompt cache alignment

The prompt cache is invalidated by changes near the start of the context. Editing `CLAUDE.md`
mid-session, switching models, or compacting each cost a full uncached turn. Batch instruction
changes rather than trickling them, and prefer a fresh session to fighting a polluted one.

Foundry does not enforce this and has no hook for it. It is listed because it is often the largest
single number on a bad day.

## Measuring

Two views on the same numbers.

```bash
foundry tokens
```

```
Foundry token accounting

  memory index (always loaded)   ~142 tokens  (budget 4000)
  facts, retrieved on demand     ~860 tokens across 9 facts
  runbooks, retrieved on demand  ~0 tokens
  blackboard artifacts           ~0 tokens (never loaded wholesale)

  eager loading would cost       ~860 tokens per session
  index-first costs              ~142 tokens per session
  saving                         ~718 tokens per session (83%)

Estimates use ~4 characters per token. For billed usage see /cost and /usage.
```

In-session, the `token_report` tool of the `foundry` MCP server prints the same accounting plus a
count of recorded gate events. `/context` shows what is actually resident right now.

### The estimate is not a tokenizer

`estimateTokens()` is `Math.ceil(text.length / 4)`. That is the whole implementation, and it is
deliberate: a tokenizer would be a runtime dependency, and Foundry has none.

What that means in practice:

- It **overestimates** prose made of long common words, which a real tokenizer packs efficiently.
- It **underestimates** minified code, JSON with long keys, base64 and non-Latin scripts, where the
  real ratio is well below four characters per token.
- It is deterministic, so comparing two configurations with it is sound even where the absolute
  number is off.

Use it for budgets and comparisons. For money, use `/cost` and `/usage`; Foundry reports what this
project's configuration costs, never what Anthropic billed you.

## What is recorded

`.foundry/metrics/events.jsonl` gets one JSON line per event, and is gitignored. The kinds written
are `memory_search`, `memory_write`, `blackboard_write`, `contract_valid`, `contract_violation`,
`gate_blocked`, `gate_escalated`, `gate_override_used`, `subagent_return` and `session_end`.

Telemetry writes are wrapped so a failure can never break a session, which also means a full disk
loses metrics silently. Nothing leaves the machine, and nothing here is sent anywhere.

Counting subagent returns is the quickest way to see whether the firewall is doing anything:

```bash
grep -c '"kind":"subagent_return"' .foundry/metrics/events.jsonl
```

## Where the cost actually goes

Before optimising, check the order. In a typical Foundry session the ranking is: what subagents
return, what is resident at session start, which model ran which task, and only then everything
else. The first three are the ones with mechanisms behind them.
