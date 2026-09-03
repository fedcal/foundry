# PostgreSQL lock classification for schema changes

**Verify, do not trust.** Lock behaviour of several `ALTER TABLE` forms has changed across
PostgreSQL majors — operations that once rewrote the table no longer do. Confirm on your
resolved server major before relying on any row here:

```sql
BEGIN;
ALTER TABLE <table> <change>;
SELECT locktype, mode, relation::regclass
FROM pg_locks WHERE pid = pg_backend_pid() AND relation IS NOT NULL;
ROLLBACK;
```

## The two facts that drive everything

1. `ACCESS EXCLUSIVE` conflicts with **every** other lock mode, including plain `SELECT`.
2. Lock requests **queue**, and everything arriving after them queues too. A one-millisecond
   `ALTER` waiting behind a 30-second query blocks all traffic to that table for 30 seconds.
   **The wait is the outage, not the operation.**

Hence: `SET lock_timeout` on every strong-lock migration, and retry.

## Lock modes, weakest to strongest

| Mode | Taken by | Blocks |
|---|---|---|
| `ACCESS SHARE` | `SELECT` | only `ACCESS EXCLUSIVE` |
| `ROW SHARE` | `SELECT FOR UPDATE/SHARE` | `EXCLUSIVE`, `ACCESS EXCLUSIVE` |
| `ROW EXCLUSIVE` | `INSERT`, `UPDATE`, `DELETE` | `SHARE` and above |
| `SHARE UPDATE EXCLUSIVE` | `VACUUM`, `ANALYZE`, `CREATE INDEX CONCURRENTLY`, `VALIDATE CONSTRAINT` | other maintenance; **not** reads or writes |
| `SHARE` | `CREATE INDEX` (non-concurrent) | writes |
| `SHARE ROW EXCLUSIVE` | some `ALTER TABLE` forms, `CREATE TRIGGER` | writes and `SHARE` |
| `EXCLUSIVE` | `REFRESH MATERIALIZED VIEW` (non-concurrent) | everything except `ACCESS SHARE` |
| `ACCESS EXCLUSIVE` | most `ALTER TABLE`, `DROP`, `TRUNCATE`, `REINDEX`, `VACUUM FULL` | **everything** |

## Classification

### Class A — safe: catalog-only, brief `ACCESS EXCLUSIVE`

Still needs `lock_timeout`, because the *wait* can be long even when the operation is not.

- `ADD COLUMN` nullable, no default or with a **non-volatile** default.
- `DROP COLUMN` (marks the column dead; space is reclaimed later by vacuum).
- `RENAME COLUMN` / `RENAME TABLE` / `RENAME CONSTRAINT`.
- `ALTER COLUMN SET/DROP DEFAULT`.
- `ALTER COLUMN DROP NOT NULL`.
- `ADD CONSTRAINT ... NOT VALID` (CHECK or FOREIGN KEY) — no scan.
- `SET STATISTICS`, `SET (fillfactor = ...)`.
- Attaching a pre-built unique index: `ADD CONSTRAINT ... UNIQUE USING INDEX ...`.

Caveat: **a rename is atomic in the database and instantly breaks every running instance of
the old code.** It is only acceptable when no old code is running — i.e. not during a rolling
deploy. Use expand/contract instead.

### Class B — safe with a technique

| Change | Technique |
|---|---|
| Create an index | `CREATE INDEX CONCURRENTLY`, outside a transaction; check for invalid indexes after |
| Drop an index | `DROP INDEX CONCURRENTLY` |
| Add a `CHECK` constraint | `ADD CONSTRAINT ... CHECK (...) NOT VALID;` then `VALIDATE CONSTRAINT` (takes only `SHARE UPDATE EXCLUSIVE`, does not block reads or writes) |
| Add a foreign key | Index the child column concurrently **first**, then `ADD CONSTRAINT ... NOT VALID`, then `VALIDATE CONSTRAINT` |
| Add a unique constraint | `CREATE UNIQUE INDEX CONCURRENTLY`, then `ADD CONSTRAINT ... UNIQUE USING INDEX` |
| `SET NOT NULL` | Add `CHECK (col IS NOT NULL) NOT VALID`, `VALIDATE`, then `SET NOT NULL`. On servers that can use a validated check to skip the scan this is fast — **probe your major**, do not assume |
| Add a column with a volatile default (`now()`, `gen_random_uuid()`) | Do **not**. Add nullable, backfill in batches, then set the default for new rows |
| Refresh a materialised view | `REFRESH MATERIALIZED VIEW CONCURRENTLY` (requires a unique index on the view) |

`CREATE INDEX CONCURRENTLY` details that bite:
- Cannot run inside a transaction block.
- Two table scans; waits for all transactions older than it to finish — a single long-running
  or `idle in transaction` session stalls it indefinitely.
- On failure it leaves an **invalid** index: it costs write time and is never used. Always
  check and clean up.
- On a **partitioned** table, index creation semantics differ per major; build on partitions
  and attach, and verify the behaviour on your server.

### Class C — unsafe in place: must be decomposed

| Change | Why | Do instead |
|---|---|---|
| `ALTER COLUMN TYPE` (most conversions) | Full table rewrite under `ACCESS EXCLUSIVE`; all indexes rebuilt | Expand to a new column, backfill, switch, contract |
| Narrowing a type (`text`→`varchar(20)`, `numeric`→`int`) | Rewrite **and** data loss | Expand/contract; the reverse restores the type, not the data |
| `RENAME COLUMN` during a rolling deploy | Old code breaks instantly | Add new column, dual-write, switch reads, drop old |
| Adding a `NOT NULL` column with a volatile default | Rewrite | Nullable + batched backfill + default for new rows |
| `TRUNCATE` on a live table | `ACCESS EXCLUSIVE`, and irreversible | Batched `DELETE`, or `DROP PARTITION` if partitioned |
| `VACUUM FULL` / `REINDEX` (non-concurrent) | `ACCESS EXCLUSIVE` for the whole rewrite | `REINDEX CONCURRENTLY` where available; or a maintenance window |
| Converting a table to partitioned | Requires moving all data | Create the partitioned table alongside, dual-write, migrate, switch |
| Removing a value from a PostgreSQL `enum` type | Not supported at all | This is why lookup tables beat native enums |

Widening within a family (`varchar(50)`→`varchar(100)`, `varchar`→`text`) is frequently
metadata-only. **Verify with the `pg_locks` probe** rather than assuming, because the answer
depends on the exact conversion and the server major.

## Before you run anything

```sql
-- who is holding a lock on this table right now?
SELECT pid, state, wait_event_type, now() - xact_start AS age, left(query, 120)
FROM pg_stat_activity
WHERE state <> 'idle' AND now() - xact_start > interval '30 seconds'
ORDER BY age DESC;

-- sessions idle in a transaction: they hold locks and stall CONCURRENTLY
SELECT pid, now() - state_change AS idle_for, left(query, 100)
FROM pg_stat_activity WHERE state = 'idle in transaction' ORDER BY idle_for DESC;
```

If either returns rows on the target table, do not start. Set
`idle_in_transaction_session_timeout` on the application role and fix the code path that
leaves transactions open.
