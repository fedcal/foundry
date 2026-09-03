# ADR status lifecycle

`adr.v1.status` accepts exactly five values. There is no sixth, and no free text.

```
                 ┌──────────────┐
   drafted ────► │   proposed   │
                 └──┬────────┬──┘
                    │        │
          accepted  │        │  rejected
                    ▼        ▼
              ┌──────────┐  ┌──────────┐
              │ accepted │  │ rejected │   (terminal, kept forever)
              └──┬────┬──┘  └──────────┘
                 │    │
     superseded  │    │  deprecated
                 ▼    ▼
      ┌────────────┐ ┌────────────┐
      │ superseded │ │ deprecated │
      └────────────┘ └────────────┘
```

## What each status means

| Status | Meaning | Who may set it | Body editable? |
|---|---|---|---|
| `proposed` | Written and argued, not yet binding. One-way-door decisions **must** pass through here. | any agent | yes, until accepted |
| `accepted` | Binding. Code that contradicts it is a defect. | a named human in `deciders[]` | **no** |
| `rejected` | Considered and declined. Kept forever so the option is not re-proposed blind. | a named human | no |
| `deprecated` | No longer applies because the context vanished (the component was deleted, the product line closed). Nothing replaces it. | any agent, with a reason line | status line only |
| `superseded` | Replaced by a specific newer ADR. `supersedes` on the new one points back. | set when the replacement is accepted | status line only |

## Transitions that are illegal

- `accepted` → `proposed`. If you want to re-open, write a new ADR that supersedes it.
- `rejected` → `accepted`. Same rule: a new ADR, whose context explains what changed.
- `superseded` → anything. Terminal.
- Deleting an ADR file. Ever. The numbers are a permanent sequence; a gap means somebody deleted
  history and the next reader will not trust any of it.

## Mechanics of a status change

Only these lines change in the old file:

```diff
-- **Status:** accepted
+- **Status:** superseded by [ADR-0012](0012-move-order-events-to-cdc.md)
-- **Superseded by:** —
+- **Superseded by:** ADR-0012
```

And in the artifact:

```diff
-  "status": "accepted",
+  "status": "superseded",
```

Then update `docs/adr/README.md` and write the replacement `fact.v1` through
`mcp__plugin_foundry-core_foundry__memory_write` with `supersedes: <old fact id>`. Do not hand-edit
`.foundry/memory/facts/`.

## Review dates

An ADR with `Review by: <date>` is a promise. Two mechanisms keep it honest:

1. The `fact.v1` written for the ADR carries `expires: <same date>`, so once it lapses the next
   index rebuild — `foundry memory index`, or the
   `mcp__plugin_foundry-core_foundry__memory_index` tool — leaves it out of
   `.foundry/memory/INDEX.md` and the decision stops being quoted as current.
2. A grep gate you can run in CI or a scheduled job:

```bash
node -e '
const fs=require("fs");
const today=process.argv[1];
for (const f of fs.readdirSync("docs/adr").filter(x=>/^\d{4}-/.test(x))) {
  const t=fs.readFileSync("docs/adr/"+f,"utf8");
  const m=t.match(/\*\*Review by:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  const s=t.match(/\*\*Status:\*\*\s*(\w+)/);
  if (m && s && s[1]==="accepted" && m[1] < today) console.log("OVERDUE", f, m[1]);
}' "$(date +%F)"
```

Pass the date in from the caller when running inside a workflow — `Date.now()` and `new Date()`
throw in the Foundry workflow runtime.

An overdue review is not a failure. It is a prompt to either extend the date with one sentence
of justification appended to `docs/adr/README.md`, or to write the superseding ADR.

## Numbering invariants

- Four digits, zero-padded in the filename, plain integer in the artifact.
- Monotonic, no reuse, no renumbering, gaps are never closed.
- If two agents race and both create a file, the `{flag:"wx"}` create in `SKILL.md` §2 guarantees
  the loser advances to the next free number instead of overwriting.
- The number is assigned at *reservation*, not at acceptance. A `rejected` ADR keeps its number.
