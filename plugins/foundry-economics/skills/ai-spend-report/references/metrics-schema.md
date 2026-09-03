# `.foundry/metrics/events.jsonl` — what it proves and what it does not

One JSON object per line, append-only, written by `recordMetric()` in
`plugins/foundry-core/lib/foundry.mjs`. Every line has an ISO-8601 `ts` and a `kind`.
Telemetry failures are swallowed by design, so **absence of an event is not proof the thing
did not happen** — treat counts as lower bounds.

## Event kinds

| `kind` | Extra fields | Written by | What it supports |
|---|---|---|---|
| `memory_search` | `query`, `hits` | MCP `memory_search` | retrieval demand; zero-hit rate |
| `memory_write` | `action`, `id` | MCP `memory_write` | memory growth; write-side cost of the memory system |
| `blackboard_write` | `wave`, `agent`, `schema`, `bytes` | MCP `blackboard_write` | artifact volume per agent and per wave |
| `subagent_return` | `agent`, `tokens` | `hooks/subagent-firewall.mjs` | **the only token-bearing event** — per-agent return cost |
| `gate_blocked` | `gate`, plus `file` or `tool` | `guard-bash`, `guard-write`, `stop-verify` | rework and incidents avoided |
| `gate_escalated` | `gate`, `file` | `guard-write` | protected-path friction |
| `gate_override_used` | `gate`, `reason` | `guard-bash` | whether gates are being worked around |
| `contract_valid` | `schema` | `hooks/validate-contract.mjs` | artifact writes that passed first time |
| `contract_violation` | `schema`, `count` | `hooks/validate-contract.mjs` | **retry waste** — the artifact had to be produced twice |
| `session_end` | `reason`, `session` | `hooks/session-end.mjs` | session boundaries and counts |

## The central limitation — state it in every report

**This is a gate-and-memory ledger, not a token ledger.**

Present: `subagent_return.tokens`, and `blackboard_write.bytes` (bytes on disk, which is a
proxy for artifact size, *not* a token count of anything that entered a context window).

Absent: input tokens, output tokens, cache-write tokens, cache-read tokens for the main
conversation; per-call model identity; per-call latency; anything about the human's turns.

Consequences you must respect:

1. **Never present a scaled-up `subagent_return` total as total session spend.** It measures
   what subagents returned, which is a small and unrepresentative slice.
2. **Whole-session totals require a provider usage export or `/cost` output**, supplied by a
   human, joined by timestamp window. Mark those figures `[given: <who/when>]`.
3. **Feature attribution is not in this file.** No event kind carries a branch name or a feature
   tag, so the only available join is `git reflog` against the session's time window. That is a
   heuristic — and a weak one whenever two branches were touched in one session: label it, give a
   confidence, and recommend adding an explicit feature tag.
4. `session_end` may be missing for crashed or force-quit sessions. Session counts are lower
   bounds; say so when the count drives a per-session figure.

## Metrics you can compute honestly

```
sessions                   = |distinct session_end.session|
tokens_per_agent_run       = Σ subagent_return.tokens / count(subagent_return)   [report p80 too]
retry_waste_rate           = contract_violation / (contract_valid + contract_violation)
memory_zero_hit_rate       = |memory_search where hits=0| / |memory_search|
searches_per_session       = |memory_search| / sessions
memory_write_rate          = |memory_write| / sessions
gate_override_rate         = gate_override_used / (gate_blocked + gate_override_used)
artifact_bytes_per_agent   = Σ blackboard_write.bytes grouped by agent
```

### How to read them

- **`retry_waste_rate` above zero is a bug, not a cost.** Each violation means an agent
  produced an artifact, had it rejected by `validate-contract.mjs`, and produced it again.
  Fix the agent's output-contract handling; no model change will help.
- **`memory_zero_hit_rate`** high means facts are titled badly — `fact.v1` requires the title
  to state the fact, not the topic, precisely so search finds it. Not evidence that memory is
  worthless.
- **`gate_override_rate`** high means a gate is mis-tuned and is being routed around. That is
  a governance signal, not a cost signal, but it belongs in the report because a gate everyone
  overrides costs tokens and buys nothing.
- **`tokens_per_agent_run` p80** is the correct input to a token budget. The mean will breach
  on roughly half the runs.

## Joining to a provider usage export

When a human supplies an export:

1. Sort both by timestamp.
2. Bucket usage rows into session windows: `[first event of session, session_end.ts]`.
3. Report the **unassigned share** — usage rows that fall outside any window. If it is large,
   say the attribution is weak rather than spreading the remainder pro-rata. Spreading
   unattributable cost is how a report acquires false precision.
4. Mark every derived figure `[given: <export name>, <date>]`.

## Privacy

`memory_search.query` contains user-authored text and may include sensitive material. Never
quote raw queries in a report; report counts and hit rates only.

Attribution in this vertical is to **agents, features and workflows** — never to individuals.
Do not build per-person productivity metrics from this file. If asked, decline and explain
that the data was not collected for that purpose and is not fit for it.
