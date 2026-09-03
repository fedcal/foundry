# Migration review checklist

Use when `superpowers:requesting-code-review` is unavailable, or as the reviewer's own list.
Every line is a yes/no with evidence — a command you ran or a file line you read.

## Correctness

- [ ] The migration does what the ADR says, and nothing else. No opportunistic extra change
      riding along in the same file.
- [ ] File naming and version match the project convention exactly (Flyway: **two**
      underscores; date-based version; no collision with any branch).
- [ ] The migration is idempotent from the tool's perspective — re-running the set is a no-op.
- [ ] No `SELECT *` and no implicit column ordering assumptions in any DML.
- [ ] Data-modifying statements are deterministic; no `now()`/`random()` where the value must
      be reproducible across a retry.

## Locking

- [ ] `SET lock_timeout` present on every migration taking a strong lock.
- [ ] The lock mode was **observed** via `pg_locks`, not assumed from documentation.
- [ ] Every `CREATE INDEX`/`DROP INDEX` uses `CONCURRENTLY` and runs outside a transaction.
- [ ] An invalid-index check runs after any `CONCURRENTLY` operation.
- [ ] No `ALTER COLUMN TYPE`, `TRUNCATE`, `VACUUM FULL` or non-concurrent `REINDEX` on a live
      table.
- [ ] New constraints use `NOT VALID` + `VALIDATE` on any table above trivial size.

## Rolling-deploy safety

- [ ] The **previous** application version works against this schema. Verified, not assumed.
- [ ] No column or table used by currently-running code is dropped or renamed in this step.
- [ ] The code that writes both shapes is deployed **before** the backfill starts.
- [ ] No contract-phase change ships in the same release as the code change that needs it.

## Backfill

- [ ] Batched and keyset-paginated. No `OFFSET`. No unbounded `UPDATE`/`DELETE`.
- [ ] Idempotent — filters on the not-yet-migrated condition, safe to rerun after a crash.
- [ ] Runs **outside** the migration tool (a job), not inside a Flyway/Liquibase file.
- [ ] Throttled with an observed signal (replication lag), not a fixed sleep alone.
- [ ] Progress is logged with a cursor, so an operator can see an ETA and resume.
- [ ] Free disk space checked: a row-rewriting backfill can double the table's size until
      vacuum reclaims it.
- [ ] Rows that fail to convert are captured to a list, not silently skipped.

## Verification

- [ ] A verification query exists and is stated, and it is run **twice**, minutes apart, to
      catch rows created during the backfill.
- [ ] Constraint state asserted with `convalidated`, not just "the ALTER succeeded".
- [ ] Rehearsed against Testcontainers from empty **and** from a production schema dump.
- [ ] Application boots with `ddl-auto=validate` against the migrated schema.
- [ ] Statement durations recorded at production-like row counts.

## Reversibility

- [ ] Rollback stated per phase, and it is **honest** — no fake `down` script for a `DROP`.
- [ ] Irreversible steps name the forward recovery plan and the **measured** restore time.
- [ ] Where a drop is required, a rename-and-soak step precedes it.
- [ ] The compensating migration, where one exists, is in the same PR and was tested.

## Blast radius

- [ ] Every consumer of the changed object was searched for — including views, functions,
      triggers, reports, analytics jobs and other services' SQL, not just this repository.
- [ ] A new unique or check constraint's violation path is mapped to a 409 with a stable
      problem `type`, not a 500.
- [ ] Adding an index: its write cost and size are stated, and there is a plan to confirm
      `idx_scan > 0` after release.
- [ ] Partitioned tables: future partitions exist and their creation is automated.

## Security and access

- [ ] The migration runs with DDL credentials distinct from the application's runtime user.
- [ ] Grants for any new object are explicit; the runtime role does not inherit DDL rights.
- [ ] No secret, personal data sample, or production identifier is embedded in the migration
      file.
- [ ] For a shared-schema multi-tenant table: RLS policy created/updated alongside the table,
      and a negative test proves a query without the tenant setting returns zero rows.

## Sign-off

A reviewer who cannot answer "what happens if this is running when a deploy rolls back"
has not reviewed it.
