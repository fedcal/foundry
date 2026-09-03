---
name: write-migration
description: Produce a reviewed database migration that is safe to run against a live PostgreSQL database — expand/migrate/contract phasing, Flyway or Liquibase file conventions, lock avoidance, a batched backfill plan, an honest reversibility statement, and the exact commands to rehearse it against a Testcontainers instance before it reaches any real environment. Use before any ALTER TABLE, CREATE INDEX or data backfill.
user-invocable: true
argument-hint: "<change description> [--table <name>] [--phase expand|migrate|contract]"
agent: foundry-dev:migration-engineer
model: sonnet
effort: medium
metadata:
  foundry.vertical: dev
  foundry.io: "adr.v1 -> plan.v1 + migration files"
license: Apache-2.0
---

# Write a migration

A migration file is the smallest part of this job. The deliverable is a **plan with phases,
locks, a backfill, a rehearsal and an honest rollback statement**, of which the SQL is one
artefact.

Assume throughout: the application is running, on more than one instance, on both the old and
the new code, while this executes.

## When not to use this

- You are deciding *what the schema should be* (keys, indexes, partitioning, tenancy) →
  `database-architect` first. This skill implements a decided target.
- The change is to an already-empty, unreleased table in a project with no environments yet.
  Write it directly and say why the phasing was skipped.
- The engine is not PostgreSQL. `CONCURRENTLY`, `NOT VALID`, `SKIP LOCKED`, and the lock matrix
  below are PostgreSQL-specific and do not transfer.
- The change moves data *between systems* (ETL, CDC, dual-write across services) — different
  problem, different agent.

## Step 1 — Establish the ground truth

```bash
# which tool, and where do files live?
ls -d src/main/resources/db/migration src/main/resources/db/changelog 2>/dev/null
grep -rn 'flyway\|liquibase' pom.xml build.gradle build.gradle.kts gradle/libs.versions.toml 2>/dev/null
# the last few migrations set the naming and versioning convention — copy it exactly
ls -1 src/main/resources/db/migration 2>/dev/null | tail -5
# server major (lock behaviour of specific ALTERs differs across majors)
psql "$DATABASE_URL" -tAc "select current_setting('server_version_num')::int"
# how big is the table, really?
psql "$DATABASE_URL" -tAc "select n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) from pg_stat_user_tables where relname='<table>'"
# deployment model — rolling? how many replicas? read replicas in use?
```

Both Flyway and Liquibase present is a `finding.v1` of severity `high`: two tools racing for
one schema.

Row count decides everything downstream. Under ~100 000 rows most operations are effectively
instant and the phasing is about *code compatibility*, not lock duration. Over ~10 million,
lock duration and backfill batching dominate. State which regime you are in.

## Step 2 — Classify the change

Look it up in `references/lock-matrix.md`. Every operation falls into one of three classes:

- **Safe** — catalog-only or a weak lock; run it directly with a `lock_timeout`.
- **Safe with a technique** — needs `CONCURRENTLY`, or `NOT VALID` + `VALIDATE`, or a helper
  index first.
- **Unsafe in place** — a table rewrite or a semantic break. Must be decomposed into
  expand/migrate/contract.

Verify empirically rather than trusting any table, including that one. On a scratch copy:

```sql
BEGIN;
ALTER TABLE <table> <the change>;
SELECT locktype, mode, relation::regclass
FROM pg_locks WHERE pid = pg_backend_pid() AND relation IS NOT NULL;
ROLLBACK;
```

`AccessExclusiveLock` on a large, busy table means you are planning an outage unless you
change the approach. That query is ground truth; a documentation table is a hint.

## Step 3 — Phase it

Split into three independently deployable steps. Never compress them because the table is
small today.

| Phase | Schema | Code deployed alongside | Reversible |
|---|---|---|---|
| **Expand** | Add the new shape: nullable, no volatile default, no constraint yet | Old code, untouched, still works | Yes — drop it |
| **Migrate** | Backfill in batches; add constraints `NOT VALID`, then `VALIDATE` | Code writes both shapes; a later release flips reads | Yes — flip reads back |
| **Contract** | Drop the old shape | Code uses only the new shape | **No** |

Ordering rule that people get wrong: the code that **writes both shapes** must be fully
deployed *before* the backfill starts, or rows created during the backfill are missed and the
verification query will pass on a moving target.

`references/expand-contract-recipes.md` has worked sequences for: rename a column, change a
type, split a column into two, make a column `NOT NULL`, add a foreign key, add a unique
constraint, move a column to a new table, and add an enum-like value.

## Step 4 — Write the files

Match the project's existing convention exactly — read the last five migration filenames.

**Flyway** (`src/main/resources/db/migration/V<version>__<snake_case>.sql`):
- Two underscores between version and description. One underscore fails at startup, and it is
  the most common mistake in this file format.
- Date-based version plus a sequence (e.g. `V2026_08_27_001__`) so parallel branches do not
  collide. Add a CI check that no two migrations share a version.
- **Applied migrations are immutable.** Editing one after it has run breaks the checksum. Fix
  forward with a new file; never use `repair` to paper over a real divergence.
- `R__` repeatable migrations are for views, functions, grants — never tables.
- Keep `flyway.outOfOrder` false in production.

**Liquibase** (`src/main/resources/db/changelog/`):
- A master changelog including per-release files; never one giant file.
- Stable `id` + `author` per `<changeSet>`; one logical change each.
- Write the `rollback` block **explicitly**. Auto-rollback covers only some change types and
  silently produces nothing for raw `<sql>`.
- `runInTransaction="false"` for anything `CONCURRENTLY`.
- Prefer raw `<sql>` for PostgreSQL-specific work: the abstract change types hide which lock
  you are taking, and that is the thing under review.

**Both**, at the top of any migration taking a strong lock:

```sql
SET lock_timeout = '3s';
SET statement_timeout = '30s';   -- omit for CONCURRENTLY and long operations
```

Fail fast and retry rather than queue. A one-millisecond `ALTER` stuck behind a 30-second
analytics query blocks every subsequent query on that table for 30 seconds — the wait is the
outage, not the operation. Configure this once (Flyway `initSql`, or a first Liquibase
changeset) so it cannot be forgotten.

Index creation, always:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_created
  ON orders (tenant_id, created_at);
```

`CONCURRENTLY` cannot run inside a transaction block — configure the migration to run outside
one, and verify how your tool spells that in your resolved version. If it fails it leaves an
**invalid index** that costs write time and is never used. Check afterwards, every time:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

## Step 5 — Plan the backfill separately

A backfill is a job, not a migration. Putting it in a Flyway file blocks application startup,
holds the migration lock, and can time a readiness probe into a restart loop.

Requirements:
- **Batched**, keyset-paginated by primary key. Never `OFFSET`. Never one unbounded `UPDATE`:
  it takes a long transaction, blocks vacuum from advancing the xmin horizon, rewrites every
  row, and cannot be interrupted safely.
- **Idempotent and resumable** — filters on `WHERE <new_col> IS NULL`, so a rerun after a crash
  is safe.
- **Throttled against replication lag**, not wall-clock speed:
  ```sql
  SELECT client_addr, state, write_lag, flush_lag, replay_lag FROM pg_stat_replication;
  ```
  Slow down when `replay_lag` approaches the alert threshold. A backfill that lags the replicas
  is an outage on the read path.
- **Observable** — log rows processed and the cursor every batch, so an operator sees an ETA.

Batch shape (run from a job):

```sql
WITH batch AS (
  SELECT id FROM users
  WHERE full_name IS NULL AND id > :cursor
  ORDER BY id LIMIT :batch_size
  FOR UPDATE SKIP LOCKED
)
UPDATE users u SET full_name = u.name
FROM batch b WHERE u.id = b.id
RETURNING u.id;
```

Start at 1 000–5 000 rows per batch, sleep between batches, tune by measurement. Check free
disk first: rewriting rows doubles the table's space until vacuum reclaims it.

## Step 6 — Rehearse against Testcontainers

**No migration ships unrehearsed.** Two runs, both required.

```bash
# A. from empty — proves the migration set is internally consistent
./mvnw -q test -Dtest='*MigrationIT'

# B. from the CURRENT production schema — proves it applies to what actually exists
pg_dump --schema-only --no-owner --no-privileges "$PROD_READONLY_URL" > /tmp/prod-schema.sql
```

Rehearsal test to add (details in `references/rehearsal-test.md`):

1. Start a PostgreSQL container of the **same major** as production.
2. Load `/tmp/prod-schema.sql` (schema only — never copy production data to a laptop; generate
   volume synthetically).
3. Seed representative row volumes for the affected tables.
4. Run the migration, timing it and capturing the locks it takes.
5. Assert the schema is what you intended (`information_schema` queries, not eyeballing).
6. Boot the application with `spring.jpa.hibernate.ddl-auto=validate` — this is the check that
   catches a mapping/schema mismatch before production does.
7. Run the **previous** application version against the **new** schema. This proves the expand
   phase is rolling-deploy safe. Skipping it is how expand phases quietly become breaking.
8. Run the rollback script (where one exists) and assert the schema returns to the prior state.

Manual equivalent, if no test harness exists yet:

```bash
docker run --rm -d --name mig-rehearsal -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:<YOUR-MAJOR>
psql postgresql://postgres:x@localhost:55432/postgres -f /tmp/prod-schema.sql
./mvnw -q flyway:migrate -Dflyway.url=jdbc:postgresql://localhost:55432/postgres \
       -Dflyway.user=postgres -Dflyway.password=x
psql postgresql://postgres:x@localhost:55432/postgres \
     -c "SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;"
docker rm -f mig-rehearsal
```

Record the measured duration of every statement. "It was fast locally on 500 rows" is not a
measurement of anything.

## Step 7 — State reversibility honestly

Write a `down` only where it is real. A fake rollback script is worse than none: it convinces
an on-call engineer that a recovery path exists.

**Reversible** — `ADD COLUMN` (nullable), `CREATE INDEX`, `ADD CONSTRAINT`, `CREATE TABLE`
(if empty), adding a row to a lookup table.

**Irreversible** — `DROP COLUMN`, `DROP TABLE`, lossy type narrowing, a destructive backfill
that overwrote the source, dropping a PostgreSQL enum value (unsupported), and any migration
whose data effects were already consumed downstream (events emitted, webhooks fired).

For the irreversible set, the recovery plan is **forward** and must exist before the run:
- A verified snapshot immediately before, with the restore time you **measured**, not the one
  the platform advertises.
- Prefer a **two-step contract**: rename to `zz_deprecated_<name>`, soak, then drop in a later
  release. A rename is instantly reversible; a drop is not. Add a check that fails if anything
  still references the renamed object.
- The compensating migration written and reviewed in the same PR.

Put this in `plan.v1.rollback` as prose. If it is irreversible, the field says so.

## Step 8 — Review and record

If `superpowers` is installed, invoke `superpowers:requesting-code-review` and put the
migration through it — this is exactly the class of change where a second reader pays. If it
is absent, apply the checklist in `references/review-checklist.md` yourself, line by line.

Then write `plan.v1` to `.foundry/blackboard/<wave>/write-migration.json` via
`blackboard_write`: one wave per phase, each with a machine-checkable `gate`, and an honest
`rollback`. Return ≤ 300 tokens.

## Exit criteria

- [ ] The change is classified (safe / safe-with-technique / unsafe-in-place) and the lock mode
      was **observed** via `pg_locks`, not assumed.
- [ ] Decomposed into expand / migrate / contract, each independently deployable, unless a
      documented exception applies.
- [ ] `lock_timeout` set on every migration taking a strong lock, with a retry at the runner.
- [ ] Every index created `CONCURRENTLY`, outside a transaction, with the invalid-index check
      after.
- [ ] No unbounded `UPDATE`/`DELETE`. Backfill is batched, keyset-paginated, idempotent,
      throttled against replication lag, and runs outside the migration tool.
- [ ] Rehearsed on Testcontainers **from empty and from a production schema dump**, with
      statement durations recorded.
- [ ] Previous application version verified against the new schema (rolling-deploy safety).
- [ ] Application boots with `ddl-auto=validate` against the migrated schema.
- [ ] Rollback stated per phase and honest; irreversible phases name the forward recovery plan
      and the measured restore time.
- [ ] Migration file naming and versioning match the existing convention; no collision.
- [ ] `plan.v1` written with a gate per phase; caller summary ≤ 300 tokens.

## Deliberately not covered

Choosing the target schema (`database-architect`); ORM mapping changes that follow
(`persistence-engineer`); API compatibility during the skew window
(`service-versioning-engineer`); backup infrastructure, PITR configuration, replica
provisioning and deploy orchestration (foundry-ops); non-PostgreSQL engines; cross-system data
migration; seeding reference data as part of application bootstrap.

## Degradation

No Docker → the migration is **unrehearsed**; set `status: partial` in the handoff and refuse
the gate. Do not rehearse on H2. No access to a production schema dump → rehearse from empty
only, and state that drift between environments is unverified. No `pg_stat_replication`
(single node) → note that the backfill throttle is untested against replication. No
`superpowers` → use the inline review checklist. No `foundry` MCP server → write the plan file
directly and note it was not schema-validated.
