# When statement count scales with rows

If issuing the request with 20 rows produces roughly 20× the statements of the 1-row case, no
index will help. The fix is in the mapping or the query shape.

## Confirm it

```bash
# same endpoint, two datasets
./mvnw -q test -Dtest=<Test> -Dspring.profiles.active=sql 2>&1 | grep -c '^Hibernate: '
```

Enable in a test/dev profile only:

```properties
spring.jpa.properties.hibernate.generate_statistics=true
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.orm.jdbc.bind=TRACE
```

Server side, the signature is a query with an enormous `calls` count and `rows/calls` near 1:

```sql
SELECT calls, rows, rows::float/calls AS rows_per_call, mean_exec_time, left(query, 120)
FROM pg_stat_statements WHERE calls > 100 ORDER BY calls DESC LIMIT 20;
```

## Root causes, in order of frequency

1. **`@ManyToOne` / `@OneToOne` left at the default fetch type.** JPA defaults both to
   **EAGER**; `@OneToMany`/`@ManyToMany` default to LAZY. The defaults are backwards relative
   to what you want. Every `*ToOne` should be explicitly `FetchType.LAZY`.
   ```bash
   grep -rn '@ManyToOne\b' -A1 src/main/java --include=*.java | grep -v fetch
   grep -rn '@OneToOne\b'  -A1 src/main/java --include=*.java | grep -v fetch
   ```
2. **Lazy association touched in a loop** — usually inside a mapper that builds the DTO.
3. **Open Session In View** hiding the loop behind the serialiser. Set
   `spring.jpa.open-in-view=false` and the exception will point at the real place.
4. **`@ElementCollection`** or a lazy `@Embedded` collection resolved per row.

## Fixes, in the order to try them

1. **Projection / DTO query.** If the endpoint returns a flat view, do not load entities.
   Cheapest, fastest, and it removes dirty-checking cost too.
2. **`@EntityGraph`** on the repository method. Declarative, composes with Spring Data,
   overridable per query — unlike `FetchType.EAGER`, which is a global commitment.
3. **`join fetch`** in explicit JPQL. Precise, but see the traps.
4. **`@BatchSize` / `hibernate.default_batch_fetch_size`.** Turns N selects into ceil(N/size).
   The right answer when you genuinely need the entities and a join would multiply rows. As a
   global default it is the single highest value-per-effort Hibernate setting.
5. **Two explicit queries.** Load parents, then children with `WHERE parent_id IN (:ids)`, and
   stitch in memory. Unfashionable, frequently fastest, always predictable.

## Traps

- **`join fetch` + pagination.** Fetching a collection while using `setFirstResult`/
  `setMaxResults` forces in-memory pagination after fetching everything (historically warned as
  `HHH000104`). Fix: page the ids first, then fetch the collection for that page of ids.
- **Two collection `join fetch` in one query** → cartesian product, and with `List` mappings,
  duplicated rows. Fetch at most one collection per query; batch the rest.
- **`distinct` to hide duplicates** from a collection join makes the database sort a
  multiplied result set. Fix the join, not the symptom.
- **`FetchType.EAGER` cannot be overridden per query.** LAZY + an entity graph is strictly more
  flexible.
- **`LazyInitializationException` during serialisation** means an entity escaped the
  transaction into the web layer. The fix is a DTO, not turning OSIV on.

## Lock the fix in

An N+1 fix without a regression guard comes back. Assert the statement count:

```java
Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
stats.setStatisticsEnabled(true);
stats.clear();
service.list(PageRequest.of(0, 20));
assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(3);
```

Run the same assertion with 1 and with 20 seeded rows. Constant count = fixed.
