---
name: memory
description: Capture, recall, curate and prune Foundry project memory. Use when a decision or constraint has just been established, when you need to know what was decided before, or when the memory index exceeds its token budget.
argument-hint: "capture | recall <query> | prune | index"
metadata:
  foundry.vertical: core
  foundry.io: "session -> fact.v1"
---

# Foundry memory

Four tiers, one purpose: make the next session cheaper and better informed than this one.

| Tier | Location | What lives there |
|---|---|---|
| T0 scratch | `.foundry/scratch/<session>/` | working files, discarded at will |
| T1 facts | `.foundry/memory/facts/` | atomic durable facts, one per file |
| T2 runbooks | `.foundry/runbooks/` | procedures someone will repeat |
| T3 decisions | `docs/adr/` | architecture decisions, permanent and public |

Only `INDEX.md` is loaded into context by default, capped at 4000 tokens. Everything else is
retrieved on demand. This is the single biggest token saving Foundry makes, and it only works if
nobody bypasses it by reading fact files directly.

## capture

Dispatch the `memory-curator` agent, or write directly with the `memory_write` tool.

Store a fact only if it is **durable**, **non-derivable from the repository**, and would change how
someone works. Everything else is noise that costs tokens forever.

For `decision` and `risk` facts the body must contain:

```
**Why:** the reasoning, including what was rejected
**How to apply:** what someone should do differently because of this
```

## recall

```
memory_search(query: "<what you need to know>", type?: <fact type>, limit?: <n>)
```

Always search before planning, before proposing an architecture, and whenever the user refers to
something "we decided". Never read `.foundry/memory/facts/` directly — that loads everything and
defeats the design.

## prune

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs" memory prune
```

Reports facts that are expired, superseded, contradictory or never retrieved. Retire by setting
`expires`, not by deleting: the history of a decision is part of its value.

## index

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs" memory index
```

Rebuilds `INDEX.md`. If it reports dropped entries, consolidate narrow facts into broader ones
rather than raising the budget — a bigger index is a permanent tax on every session.

## Anti-patterns

| Do not | Because |
|---|---|
| Store what `git log` already says | It is derivable, and it is more accurate at the source |
| Store session state ("currently editing X") | It is stale within the hour |
| Write fact files by hand | You bypass deduplication and the supersedes chain |
| Raise the index budget to fit more facts | The cost is paid on every future session |
| Record a decision without its reasoning | It becomes cargo cult and nobody dares change it |
