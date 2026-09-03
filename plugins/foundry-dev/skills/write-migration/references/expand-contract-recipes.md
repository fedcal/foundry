# Expand / migrate / contract recipes

Each recipe is a sequence of **independently deployable** steps. Never merge two steps because
the table is small. The step boundary is what makes rollback possible.

Notation: `S`n = a schema migration, `C`n = a code deployment, `B` = a backfill job.

---

## 1. Rename a column (`users.name` → `users.full_name`)

- **S1** `ALTER TABLE users ADD COLUMN full_name text;` (nullable, no default)
- **C1** Write both `name` and `full_name`; read `name`. *Must be fully rolled out before B.*
- **B**  Batched: `UPDATE ... SET full_name = name WHERE full_name IS NULL` (keyset paged)
- **V**  `SELECT count(*) FROM users WHERE full_name IS NULL AND name IS NOT NULL;` → 0, twice,
         minutes apart (catches rows created mid-backfill)
- **S2** `ALTER TABLE users ADD CONSTRAINT users_full_name_nn CHECK (full_name IS NOT NULL) NOT VALID;`
         then `ALTER TABLE users VALIDATE CONSTRAINT users_full_name_nn;`
- **C2** Read `full_name`; still write both
- *soak — at least one full business cycle, and long enough that rollback to C1 is implausible*
- **C3** Write only `full_name`
- **S3** `ALTER TABLE users RENAME COLUMN name TO zz_deprecated_name;` (instantly reversible)
- *soak, with a monitor that fails if anything still references it*
- **S4** `ALTER TABLE users DROP COLUMN zz_deprecated_name;` — **irreversible**

Rollback: reversible up to and including S3. After S4, recovery is restore-from-backup.

---

## 2. Change a column type (`amount int` → `numeric(19,4)`)

Never `ALTER COLUMN TYPE` in place on a large table: full rewrite under `ACCESS EXCLUSIVE`.

- **S1** `ALTER TABLE orders ADD COLUMN amount_v2 numeric(19,4);`
- **C1** Write both; read `amount`. Application converts on write.
- **B**  Batched `UPDATE orders SET amount_v2 = amount::numeric WHERE amount_v2 IS NULL`
- **V**  `SELECT count(*) FROM orders WHERE amount_v2 IS DISTINCT FROM amount::numeric;` → 0
- **S2** `CHECK (amount_v2 IS NOT NULL) NOT VALID` → `VALIDATE`
- **C2..C3, S3..S4** as in recipe 1

If the conversion is **lossy** in the other direction (narrowing), say so in `plan.v1.rollback`:
reverting the column type does not revert truncated values.

---

## 3. Split one column into two (`address` → `street`, `city`)

- **S1** `ADD COLUMN street text, ADD COLUMN city text;`
- **C1** Write all three (parse on write); read `address`
- **B**  Batched parse-and-fill. **Log every row that fails to parse** — a splitting backfill
         always has a dirty tail, and discovering it after the contract phase is fatal.
- **V**  Reconcile: count of rows where the recomposed value differs from `address` → 0, or an
         explicitly accepted exception list
- **C2** Read the new columns; keep writing all three
- **C3 / S2** Contract as above

The parse failure list is a deliverable of this recipe, not a side effect. Do not proceed to
contract until it is empty or signed off.

---

## 4. Make an existing nullable column `NOT NULL`

- **S1** Set a default for **new** rows if one is appropriate:
         `ALTER TABLE t ALTER COLUMN c SET DEFAULT '...';` (catalog-only for a non-volatile default)
- **C1** Application always supplies a value
- **B**  Batched backfill of existing NULLs
- **S2** `ALTER TABLE t ADD CONSTRAINT t_c_nn CHECK (c IS NOT NULL) NOT VALID;`
- **S3** `ALTER TABLE t VALIDATE CONSTRAINT t_c_nn;` — `SHARE UPDATE EXCLUSIVE`, does not block
         reads or writes
- **S4** *Optional* `ALTER TABLE t ALTER COLUMN c SET NOT NULL;` — on servers that can use the
         validated check to skip the scan this is fast. **Probe your major first**; if it
         rewrites, stop at S3 — a validated CHECK enforces the same guarantee.

---

## 5. Add a foreign key to a large table

- **S1** `CREATE INDEX CONCURRENTLY idx_child_parent ON child (parent_id);`
         (an unindexed FK column makes every parent delete/update scan the child table)
- **V**  Find orphans **before** adding the constraint:
         `SELECT count(*) FROM child c LEFT JOIN parent p ON p.id = c.parent_id
          WHERE c.parent_id IS NOT NULL AND p.id IS NULL;`
         Non-zero means a data-cleanup decision is required first — that is a product question,
         not a migration question.
- **S2** `ALTER TABLE child ADD CONSTRAINT fk_child_parent FOREIGN KEY (parent_id)
          REFERENCES parent(id) NOT VALID;` (brief lock, no scan)
- **S3** `ALTER TABLE child VALIDATE CONSTRAINT fk_child_parent;` (weak lock, scans)

Choose `ON DELETE` deliberately: `RESTRICT` by default, `CASCADE` only inside an aggregate you
own. `CASCADE` on a large child table turns one delete into an unbounded one.

---

## 6. Add a unique constraint to a live table

- **V**  Find duplicates first; resolving them is a product decision:
         `SELECT lower(email), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;`
- **S1** `CREATE UNIQUE INDEX CONCURRENTLY uq_users_email ON users (lower(email));`
         (fails if duplicates exist — leaves an invalid index; clean it up and retry)
- **S2** `ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE USING INDEX uq_users_email;`
         (fast catalog change)
- **C1** Map the resulting constraint violation to HTTP 409 with a stable problem `type` — a
         500 from a constraint violation is a defect, and this migration creates the
         possibility of it.

For "unique among active rows", use a **partial** unique index:
`CREATE UNIQUE INDEX CONCURRENTLY ... ON users (lower(email)) WHERE deleted_at IS NULL;`

---

## 7. Move a column to a new table (extract an entity)

- **S1** `CREATE TABLE profile (...)` with an FK back to the owner
- **C1** Write to both places; read the old column
- **B**  Batched copy
- **V**  Row-count and checksum reconciliation between old and new
- **C2** Read from the new table; keep dual-writing
- **C3** Write only to the new table
- **S2** Rename the old column to `zz_deprecated_*`, soak, then drop

Watch for the read path silently falling back to the old column in some branch. Grep for the
old column name across the whole repository — including SQL strings, views, reports and any
analytics job outside this codebase — before the contract phase. The forgotten consumer is
always a report.

---

## 8. Add a value to an enum-like column

- **Lookup table** (recommended): `INSERT INTO order_status (code, label) VALUES (...);` — a
  plain, reversible data migration.
- **PostgreSQL native enum**: `ALTER TYPE order_status ADD VALUE 'PARTIALLY_SHIPPED';` — adding
  is easy; **removing or reordering is not supported at all**, and `ADD VALUE` has transaction
  restrictions that vary by major. Probe before using it inside a migration transaction.
- **CHECK constraint on text**: drop and recreate the constraint using `NOT VALID` + `VALIDATE`
  so the table is not scanned under a strong lock.

Consumer-side rule regardless of representation: a new enum value is a **breaking API change**
unless consumers were explicitly told to tolerate unknown values. Coordinate with
`service-versioning-engineer`.

---

## Universal verification queries

```sql
-- backfill completeness (run twice, minutes apart)
SELECT count(*) FROM t WHERE new_col IS NULL AND old_col IS NOT NULL;

-- constraint state
SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 't'::regclass;

-- invalid indexes left by a failed CONCURRENTLY
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;

-- is the new index actually used? (after traffic, not immediately)
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname = 't';

-- did the table bloat during the backfill?
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables WHERE relname = 't';
```
