# Extraction playbook

Use only after `SKILL.md` Step 2 found **no firing gate** and Step 3 (modular monolith + fitness
function + data ownership) is already done. If data ownership is not yet split, stop: extracting
the process first is the single most common way this goes wrong.

Seven stages. Each is independently deployable and independently reversible, and each has a gate
that a machine can check. Map them one-to-one onto `plan.v1` waves.

---

## Stage 1 — Freeze the seam

**Goal:** the module's public surface stops moving while you work on it.

- The port interface is final and reviewed. Every caller goes through it; nothing reaches into
  internals.
- Write the contract now, before anything moves: `contracts/http/<service>.openapi.yaml` and/or
  `contracts/async/<service>.asyncapi.yaml` via `design-api-contract`. The in-process port and
  the future network contract must be shape-compatible, or you will discover the mismatch after
  the expensive part.
- The contract deliberately omits anything the callers do not use today. Do not "future-proof".

**Gate:** fitness function green in CI; zero references to the module's internals from outside;
contract lints clean.

```bash
grep -rn --include=*.java "com\.acme\.orders\.internal\." src/main/java | grep -v "/com/acme/orders/" ; test $? -ne 0
```

---

## Stage 2 — Sever the data

**Goal:** exactly one writer per table, and no cross-boundary joins.

- Move the module's tables into their own schema (`orders.*`), keep them in the same physical
  database for now — you are separating *ownership*, not *hardware*.
- Revoke `INSERT/UPDATE/DELETE` from every other role. Read access goes next.
- Replace cross-boundary joins with a call to the port. Where a join was doing real work, either
  denormalise a copy into the reader (and accept staleness, with a stated window) or accept the
  extra call and measure the latency cost now, while rollback is trivial.

**Gate:**

```sql
SELECT table_name, count(DISTINCT grantee) AS writers
FROM information_schema.role_table_grants
WHERE privilege_type IN ('INSERT','UPDATE','DELETE') AND table_schema = 'orders'
GROUP BY table_name HAVING count(DISTINCT grantee) > 1;   -- must return zero rows
```

**This is where most extractions die**, and it is a good place to die: you are still in one
process, and abandoning here costs nothing but has already improved the codebase.

---

## Stage 3 — Make the seam remote-shaped in-process

**Goal:** callers already behave as if the call were remote, while it still is not.

- The port becomes asynchronous in signature (returns a future/promise/`Mono`), even though it
  resolves immediately.
- Serialise and deserialise across the port in tests — the DTOs must survive a JSON round trip.
  This flushes out shared mutable objects, lazy-loaded proxies and `Optional`-in-a-field problems
  while they are still cheap.
- Add a timeout, a retry decision and an error type to the port even though nothing can fail yet.

**Gate:** a test asserting the round trip:

```java
@Test void portDtosSurviveSerialisation() { /* assertThat(fromJson(toJson(dto))).isEqualTo(dto) */ }
```

---

## Stage 4 — Deploy the new service, dark

**Goal:** the service exists and runs, and nothing depends on it.

- New deployable, new pipeline, own migrations, own health endpoint, own dashboards and SLO.
- It reads from the same database schema it owns. Do **not** also duplicate the data yet.
- Shadow traffic: the monolith calls both the in-process port and the new service, uses only the
  in-process result, and compares. Log divergences with a counter.

**Gate:** divergence rate < 0.1% over 10 000 shadow calls, and p99 of the remote path recorded
(you will need it for Stage 5's rollback decision).

---

## Stage 5 — Strangle: cut traffic over behind a flag

**Goal:** the network path becomes the real one, reversibly.

- One flag, one operation at a time, in order of increasing risk: reads first, then idempotent
  writes, then non-idempotent writes (which by now must carry an idempotency key —
  `integration-architect` owns that design).
- Ramp 1% → 10% → 50% → 100%, with a defined bake time at each step and an explicit rollback
  trigger (error rate, p99, business metric).
- Keep the in-process implementation compiled and callable for the whole ramp. Deleting it early
  converts a flag flip into an emergency deploy.

**Gate:** at 100% for one full business cycle (a week including a month-end if the domain has
one), with SLO burn inside budget.

---

## Stage 6 — Delete the old path

**Goal:** no dual implementation. This stage is not optional; skipping it is how you end up
maintaining both forever.

- Remove the in-process implementation, the flag, the shadow comparison and the dead DTOs.
- Remove the monolith's read access to the module's schema. Now the separation is physical.
- Move the module's tables to their own database instance only if a Step 0 driver actually
  requires it (residency, independent scaling of storage). Otherwise leave them; a separate
  schema with one writer already gives you the isolation that matters.

**Gate:** `grep` finds no reference to the old implementation; the flag no longer exists in the
flag system; database grants show the monolith has no access to the schema.

---

## Stage 7 — Arm the reversal criteria

**Goal:** the decision stays falsifiable.

Schedule the measurements from `references/metrics.md` to run monthly and alert when:

- co-change between the two repositories (by ticket id or by correlated deploys) exceeds 30%;
- more than 20% of changes require an ordered deploy of both;
- the primary journey's p99 exceeds the budget written in the ADR.

Any of these firing means opening a new ADR that supersedes the extraction ADR — possibly to
merge back. Merging back is a legitimate, respectable outcome. It is also nearly impossible to
propose without these numbers agreed in advance, which is why they are written before the split
rather than after.

---

## Rollback at each stage

| Stage | Rollback | Cost |
|---|---|---|
| 1 | revert the port refactor | hours |
| 2 | restore grants, re-add joins | a day; data unchanged |
| 3 | revert signature change | hours |
| 4 | delete the deployment | hours; nothing depended on it |
| 5 | flip the flag off | seconds |
| 6 | redeploy the previous monolith release, restore grants | hours, and this is the first stage where rollback is genuinely unpleasant |
| 7 | new ADR, merge back | weeks |

The point of the ordering is that everything expensive happens after everything cheap has already
had a chance to fail.

---

## What this playbook does not cover

- **Splitting the database physically**, replication topology, connection pooling and failover:
  `foundry-ops` plus the database agents.
- **The integration design of the new seam** — outbox, saga, retry, DLQ, backpressure:
  `integration-architect`.
- **Team and on-call reorganisation** implied by a new owned service.
- **Cost modelling** of running an additional deployable: `foundry-economics`.
- **Extracting more than one service at a time.** Do not. Finish one, measure, then decide again.
