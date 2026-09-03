# Reading `EXPLAIN (ANALYZE, BUFFERS)`

PostgreSQL-specific. Node names and options differ on other engines.

## Always use these options

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT TEXT) <statement>;
```

- `ANALYZE` — actually runs it, giving **actual** rows and timings. Plain `EXPLAIN` shows only
  the planner's beliefs, which are exactly what you are trying to check.
- `BUFFERS` — block-level I/O. The single most transferable number: `shared read` is the work
  that will still be there on a cold production cache.
- `VERBOSE` — output columns per node, which reveals over-fetching.
- `SETTINGS` — non-default planner GUCs in this session. Explains a plan nobody else can
  reproduce.

`ANALYZE` on an `INSERT`/`UPDATE`/`DELETE` **executes it**. Wrap in `BEGIN; ... ROLLBACK;`.

## Reading order

Plans are trees; execution is bottom-up, indentation inward. Read the deepest nodes first —
that is where the rows come from and where the time usually is.

### 1. Estimated vs actual rows

```
Seq Scan on orders  (cost=0.00..92341.00 rows=1200 width=64)
                    (actual time=0.031..842.117 rows=1843500 loops=1)
```

`rows=1200` estimated, `rows=1843500` actual — a 1500× miss. Every decision above this node was
made on a wrong number, which is how you get a Nested Loop over a million rows.

Causes and fixes, in order:
- Stale statistics → `ANALYZE orders;`
- Skewed distribution → `ALTER TABLE orders ALTER COLUMN status SET STATISTICS 1000; ANALYZE;`
- **Correlated columns** (the planner assumes independence and multiplies selectivities) →
  `CREATE STATISTICS orders_corr (dependencies, ndistinct) ON tenant_id, status FROM orders; ANALYZE orders;`
- An expression the planner cannot estimate → an expression index gives it statistics.

**Fix estimation before indexing.** An index chosen to compensate for a bad estimate produces a
plan that flips when the data shifts.

Note `loops=N`: the reported `actual time` and `rows` are **per loop**. Total = value × loops.
A node showing `actual time=0.8` with `loops=20000` is 16 seconds, not 0.8 ms. This is the most
misread number in any plan.

### 2. Buffers

```
Buffers: shared hit=142 read=14231 dirtied=3 written=0
```

- `hit` — served from PostgreSQL's buffer cache.
- `read` — not in the cache. May still be in the OS page cache, but this is your best proxy
  for real I/O and it is stable across cache states in a way timing is not.
- `dirtied`/`written` — the statement caused writes. On a `SELECT` this is usually hint-bit
  setting or a vacuum debt signal.
- `temp read/written` — the query spilled to disk. See `work_mem` below.

**A change that does not reduce `shared read` did not improve the query.** It ran on a warmer
cache.

### 3. Rows Removed by Filter

```
Seq Scan on orders (actual rows=8 loops=1)
  Filter: (status = 'PENDING'::text)
  Rows Removed by Filter: 1843492
```

1.8 million rows fetched from the heap to return 8. This is the textbook case for a **partial
index**:

```sql
CREATE INDEX CONCURRENTLY idx_orders_pending ON orders (tenant_id, created_at)
  WHERE status = 'PENDING';
```

The query's predicate must be provably implied by the index predicate, or the planner will not
use it. Keep the literal identical.

If the filter appears on an `Index Scan` node rather than a `Seq Scan`, the index found the
rows but the predicate is not covered — add the filtered column to the index.

## Symptom → cause → action

| Plan symptom | Usual cause | Action |
|---|---|---|
| `Seq Scan` on a big table with a selective predicate | No usable index, or the predicate is not sargable | Add an index; remove functions/casts from the column side |
| `Seq Scan` chosen although an index exists | Predicate not sargable, wrong column order, or the planner expects most rows | Check `Filter` vs `Index Cond`; check estimate accuracy |
| `Index Scan` but huge `Rows Removed by Filter` | Index leads with the wrong column, or is missing the filtered column | Reorder the composite: equality columns first, then range/sort |
| `Index Scan` where `Index Only Scan` was possible | Index lacks the projected columns, or the visibility map is stale | `INCLUDE` the payload columns; `VACUUM` the table |
| `Index Only Scan` with a high `Heap Fetches` | Visibility map not maintained (autovacuum behind) | Vacuum; tune autovacuum for that table |
| `Nested Loop` with a large outer | Bad row estimate below it | Fix statistics first; do not force a join type |
| `Sort` with `Sort Method: external merge Disk: NNNkB` | `work_mem` too small for this query | Raise `work_mem` for the session/role, or make the sort unnecessary via an index that provides the order |
| `Hash Join` with `Batches: 8` | Hash spilled to disk | Same as above |
| `Bitmap Heap Scan` with `Recheck Cond` and `lossy` blocks | `work_mem` too small for the bitmap | Raise `work_mem`; or a more selective index |
| Huge `Materialize` or `Memoize` | Repeated inner scans | Often fine — Memoize is a cache; check hit ratio in the node |
| `Limit` node far above an expensive scan | `OFFSET` deep into a large set | Keyset pagination: `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT n` |
| Parallel workers `Workers Launched: 0` but planned > 0 | Worker slots exhausted | Concurrency issue, not a query issue |
| `Function Scan` over a set-returning function in the SELECT list | Function called per row | Move it to a lateral join or precompute |

## Sargability — the predicates that silently kill an index

Not usable:
```sql
WHERE lower(email) = 'a@b.test'          -- unless an expression index on lower(email) exists
WHERE created_at::date = DATE '2026-08-27'
WHERE amount + 0 = 100
WHERE reference LIKE '%abc%'             -- leading wildcard: needs pg_trgm + GIN
WHERE id::text = '42'
```

Usable rewrites:
```sql
CREATE INDEX ... ON users (lower(email));               -- then the first one works
WHERE created_at >= DATE '2026-08-27'
  AND created_at <  DATE '2026-08-28'                   -- range, uses a B-tree
WHERE amount = 100
WHERE reference LIKE 'abc%'                             -- prefix: B-tree with text_pattern_ops
WHERE id = 42
```

An implicit cast on the **column** side disables the index; a cast on the **parameter** side is
free. Check the `Index Cond` line — if your predicate landed in `Filter` instead, it was not
sargable.

## Cross-checking with the catalog

```sql
-- is the new index actually being used?
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes WHERE relname = 'orders';

-- how correlated is the physical order with this column? (< 0.9 makes BRIN useless)
SELECT attname, correlation, n_distinct, null_frac
FROM pg_stats WHERE tablename = 'orders';

-- table bloat signal: dead tuples the planner and the I/O both pay for
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables WHERE relname = 'orders';
```

A table where `n_dead_tup` approaches `n_live_tup` is slow because of bloat, not because of the
query. Vacuum before you index.

## Diagnostics that are not fixes

`SET enable_seqscan = off`, `enable_nestloop = off` and friends tell you whether a better plan
*exists*. They are never the fix — they distort every other plan in the session. If forcing a
setting makes the query fast, the real work is making the planner choose that plan on its own,
via statistics or a better index.
