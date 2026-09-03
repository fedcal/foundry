# When the time is not in the database

Before optimising a query, prove the database is where the time goes. These are the
alternatives that present identically as "the endpoint is slow".

## Triage

| Observation | Likely cause | Next step |
|---|---|---|
| Few statements, low total SQL time, high wall time | Not the database | Continue down this list |
| High variance, occasional multi-second outliers on an otherwise fast endpoint | Connection-pool wait, GC pause, or a cold JIT on the first calls | Pool metrics; GC log; discard warm-up runs |
| Latency rises sharply with concurrency but not with data size | Contention: pool exhaustion, row locks, or a `synchronized` block | Pool metrics + `pg_locks` |
| Slow only for large responses | Serialisation / payload size | Measure response bytes; check for over-fetching |
| Slow in production, fast locally, same data | Network round trips, TLS handshakes, or a remote call inside the request | Distributed trace |

## Connection pool exhaustion

The signature is a request that waits before it does anything. HikariCP exposes this through
Micrometer; the two metrics that matter are pending threads and acquisition time.

```bash
curl -s localhost:8080/actuator/metrics/hikaricp.connections.pending
curl -s localhost:8080/actuator/metrics/hikaricp.connections.acquire
curl -s localhost:8080/actuator/metrics/hikaricp.connections.usage
```

Non-zero `pending` means requests are queueing for a connection. Common causes, all of which
look like a slow query:
- A **remote HTTP call inside a `@Transactional` method** — the connection is held for the
  duration of someone else's timeout. This is the most common one.
- `Propagation.REQUIRES_NEW` — takes a **second** connection while the first is held. With a
  pool of N, effective concurrency halves and the code can self-deadlock.
- Virtual threads with an unchanged pool size: ten thousand cheap threads competing for ten
  connections converts a thread queue into a connection timeout storm.
- `spring.jpa.open-in-view=true` — holds a connection for the entire request including
  rendering.

Fix the holding pattern, not the pool size. Enlarging the pool moves the queue into the
database.

## Lock contention

```sql
SELECT blocked.pid AS blocked_pid, blocked.query AS blocked_query,
       blocking.pid AS blocking_pid, blocking.query AS blocking_query,
       blocked.wait_event_type, now() - blocked.xact_start AS blocked_for
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.wait_event_type = 'Lock';

-- sessions holding locks while doing nothing: an application bug
SELECT pid, state, now() - state_change AS idle_for, left(query, 100)
FROM pg_stat_activity WHERE state = 'idle in transaction' ORDER BY idle_for DESC;
```

`idle in transaction` sessions hold locks, block vacuum, and break
`CREATE INDEX CONCURRENTLY`. Set `idle_in_transaction_session_timeout` and fix the code path.

## Serialisation and payload

- Measure the response size. Returning 50 000 rows to render 20 is a design problem no index
  fixes.
- Jackson serialising a lazy proxy triggers loading during rendering — the N+1 moves into the
  serialiser and out of your SQL log.
- Deeply nested DTOs with polymorphism are measurably expensive; flatten.

## Remote calls

A distributed trace answers this in seconds. Without one, count the calls:

```bash
grep -rn 'RestClient\|RestTemplate\|WebClient\|FeignClient' <the request path> --include=*.java
```

An HTTP N+1 (one call per row) is the same defect as a SQL N+1 and is usually worse, because
each iteration costs a network round trip plus a possible TLS handshake. Batch the call or
prefetch.

## JVM

- Discard the first N requests of any benchmark; the JIT has not compiled the path yet.
- A GC log showing pauses correlated with the latency spikes moves the investigation out of
  this skill entirely.
- Virtual threads pinning the carrier thread (`synchronized` around a blocking call) presents
  as sudden throughput collapse under load. Run with `-Djdk.tracePinnedThreads=full` and count
  the events.

## Hand-off

If the time is not in the database, stop this skill and say so explicitly, naming which of the
above it is and the measurement that shows it. Continuing to tune SQL at that point is wasted
effort, and shipping an unnecessary index taxes every write forever.
