# Tool contract patterns

Each pattern gives the shape that works, the shape that fails, and the failure it prevents.

## Search / list

**Works.**

```json
{
  "name": "search_orders",
  "description": "Find orders by customer, status or date range. Returns at most 20 summaries with a cursor. Use to locate an order id before calling get_order. Do not use to compute totals: call orders_aggregate.",
  "parameters": {
    "customer_email": {"type": "string", "format": "email"},
    "status": {"enum": ["open", "shipped", "cancelled", "refunded"]},
    "created_after": {"type": "string", "format": "date"},
    "cursor": {"type": "string"}
  }
}
```

**Fails.** `query_orders(filter: string)` taking a free-form filter expression. The model invents
a syntax, the parser rejects it, the model rewrites it, and three steps are spent on grammar.

**Prevents.** Syntax loops, unbounded result sets, aggregation questions answered by
hallucinating over a truncated list.

## Read one entity

**Works.** `get_order(order_id)` returning a fixed, documented field set, with `{"error":
"not_found", "hint": "call search_orders first"}` when absent.

**Fails.** A tool returning the entire nested object graph "in case it is needed". It costs
budget on every step afterwards and buries the two fields that mattered.

**Prevents.** Context dilution and per-step cost growth.

## Mutation, reversible

**Works.** `add_order_note(order_id, note)` returning the created note id and a link. Audit log
records run id, step id, principal.

**Fails.** `update_order(order_id, patch: object)` with a free-form patch. It is every mutation at
once, it cannot be permission-checked meaningfully, and one wrong key changes something nobody
intended.

**Prevents.** Unreviewable changes, over-broad permissions, silent field corruption.

## Mutation, irreversible

**Works.**

```json
{
  "name": "refund_order",
  "description": "Refund a shipped order. Irreversible. Requires a confirmation token obtained from request_confirmation. Maximum one refund per run.",
  "parameters": {
    "order_id": {"type": "string"},
    "amount_cents": {"type": "integer", "minimum": 1},
    "reason": {"enum": ["damaged", "late", "duplicate", "goodwill"]},
    "idempotency_key": {"type": "string"},
    "confirmation_token": {"type": "string"},
    "dry_run": {"type": "boolean", "default": false}
  }
}
```

**Fails.** `refund_order(order_id, amount)` with no key, no token and a float amount. A retry
after a timeout double-refunds; a float introduces rounding; nobody approved it.

**Prevents.** Double application on retry, unauthorised effects, currency rounding defects.

Note the pattern: the confirmation token is issued by a separate tool that renders the action for
a human. The gate is a code path, not a sentence in the prompt.

## Long-running work

**Works.** `start_export(...) -> {job_id}` plus `get_export_status(job_id) -> {state, result_ref}`.
The agent polls with a bounded number of attempts and a backoff stated in the tool description.

**Fails.** A synchronous tool that blocks for minutes. It consumes the wall-clock budget, times
out in the middle, and the agent cannot tell whether the work happened.

**Prevents.** Ambiguous timeouts, duplicated expensive work, wall-clock exhaustion.

## Batch

**Works.** `tag_orders(order_ids[], tag)` with a documented maximum length, returning per-item
outcomes: `[{"id":"ORD-1","ok":true},{"id":"ORD-2","ok":false,"error":"forbidden"}]`.

**Fails.** A batch tool that returns one aggregate boolean. Partial failure becomes invisible, and
the agent reports success while half the work is undone.

**Prevents.** Silent partial success — the failure class that is hardest to detect after the fact.

## Human gate

**Works.** `request_confirmation(action_summary, effect_class) -> {token}` that renders the exact
effect to a human, with a timeout and a defined default (deny). The token is single-use, bound to
the run and to the argument hash.

**Fails.** A gate whose token can be reused, or that displays a summary the model wrote rather
than the arguments actually about to be executed. The human approves a description; the system
executes something else.

**Prevents.** Approval bypass, and social engineering of the reviewer through a misleading summary.

Note that in Claude Code, subagents do not have `AskUserQuestion` — a nested agent cannot prompt
the user directly, so the gate must be an artefact the parent acts on.

## Untrusted content fetch

**Works.** `fetch_document(doc_id)` over an allow-listed internal corpus, returning text plus
provenance, with the content wrapped in a data delimiter by the runtime.

**Fails.** `fetch_url(url)` with no allow-list. It is an outbound request the model chooses,
which is both an exfiltration channel (data in the query string) and an injection channel
(instructions in the response).

**Prevents.** Indirect prompt injection with an outbound side channel — the highest-severity
compound failure in agent systems.

## Escape hatch

Give the agent a `report_blocked(reason, evidence)` tool. Without a legitimate way to stop, an
agent that cannot proceed will improvise, and improvisation is where unauthorised actions come
from. A run that ends in `report_blocked` is a good outcome and should be measured as one.
