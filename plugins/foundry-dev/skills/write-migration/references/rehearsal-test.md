# Rehearsing a migration against Testcontainers

An unrehearsed migration is an untested deployment of the least reversible kind of change you
ship. These are the checks that actually catch things.

## What the rehearsal must prove

1. The migration **applies** to the schema that exists in production today (not to an empty
   database, which only proves internal consistency).
2. It produces the **intended** schema — asserted with catalog queries, not by eye.
3. The **current** application boots against the new schema with `ddl-auto=validate`.
4. The **previous** application version also works against the new schema — this is what makes
   the expand phase rolling-deploy safe, and it is the check people skip.
5. Its **duration and lock profile** are known at production-like row counts.
6. The rollback, where one exists, returns the schema to the prior state.

## Getting the production schema

```bash
pg_dump --schema-only --no-owner --no-privileges "$PROD_READONLY_URL" > /tmp/prod-schema.sql
```

Schema only. Never copy production data to a developer machine — generate volume
synthetically. If you cannot reach production, dump the highest environment you can and record
that drift is unverified.

## Test skeleton

Original template, Apache-2.0. Adapt to the project's tool and naming.

```java
class MigrationRehearsalIT {

    // same MAJOR as production; read the tag from the project, never "latest"
    static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(
            DockerImageName.parse(System.getProperty("test.postgres.image")));

    @BeforeAll
    static void start() throws Exception {
        DB.start();
        // 1. the schema as it exists in production, BEFORE this change
        runSql(Files.readString(Path.of("build/rehearsal/prod-schema.sql")));
        // 2. representative volume for the affected tables
        seedRows("users", 2_000_000);
    }

    @Test
    void migration_applies_and_produces_the_intended_schema() {
        long start = System.nanoTime();
        migrate();                                  // Flyway or Liquibase, programmatically
        long millis = (System.nanoTime() - start) / 1_000_000;
        System.out.println("migration took " + millis + " ms");   // record this number

        assertThat(columnExists("users", "full_name")).isTrue();
        assertThat(constraintValidated("users_full_name_nn")).isTrue();
        assertThat(invalidIndexes()).isEmpty();      // CONCURRENTLY did not leave a corpse
    }

    @Test
    void application_boots_against_the_migrated_schema() {
        // ddl-auto=validate — catches every entity/schema mismatch here instead of in prod
    }

    @Test
    void previous_application_version_still_works_against_the_new_schema() {
        // Run the N-1 artifact (or its repository/entity layer) against the migrated database.
        // Insert and read through the OLD mapping. This is the rolling-deploy safety proof.
    }

    @Test
    void rollback_returns_the_schema_to_its_prior_state() {
        // Only where a genuine rollback exists. Where it does not, assert nothing and record
        // the irreversibility in plan.v1.rollback instead of writing a fake test.
    }
}
```

## Catalog assertions to use instead of eyeballing

```sql
-- column exists with the intended type and nullability
SELECT data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'full_name';

-- constraint present AND validated (NOT VALID constraints are not enforced retroactively)
SELECT conname, contype, convalidated FROM pg_constraint WHERE conrelid = 'users'::regclass;

-- index present, valid, and with the intended definition
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;   -- must be empty

-- partitions exist for the near future (a missing future partition is an outage)
SELECT c.relname FROM pg_class c
JOIN pg_inherits i ON i.inhrelid = c.oid
WHERE i.inhparent = 'events'::regclass ORDER BY c.relname DESC LIMIT 5;
```

## Measuring the lock profile

Run the migration in one session while a second session watches:

```sql
SELECT l.pid, l.mode, l.granted, l.relation::regclass, left(a.query, 100)
FROM pg_locks l JOIN pg_stat_activity a USING (pid)
WHERE l.relation IS NOT NULL AND l.mode LIKE '%Exclusive%';
```

Record: which lock modes were taken, on which relations, and for how long. That is the number
that decides whether this can run at peak traffic.

## Manual fallback (no test harness yet)

```bash
docker run --rm -d --name mig-rehearsal -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:<MAJOR>
until docker exec mig-rehearsal pg_isready -q; do :; done
psql postgresql://postgres:x@localhost:55432/postgres -f /tmp/prod-schema.sql
time ./mvnw -q flyway:migrate \
  -Dflyway.url=jdbc:postgresql://localhost:55432/postgres \
  -Dflyway.user=postgres -Dflyway.password=x
psql postgresql://postgres:x@localhost:55432/postgres \
  -c "SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;" \
  -c "SELECT conname, convalidated FROM pg_constraint WHERE conrelid='users'::regclass;"
docker rm -f mig-rehearsal
```

Record the `time` output. Then run it a second time against the already-migrated database to
prove the migration set is idempotent from the tool's point of view (it should be a no-op).

## What a rehearsal does not prove

Real concurrency: the lock wait that causes the incident happens because production has
traffic and your rehearsal does not. The rehearsal bounds the *operation* duration; the
`lock_timeout` and the retry are what protect you from the *wait*. State both.
