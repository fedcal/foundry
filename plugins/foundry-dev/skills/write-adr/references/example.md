# Worked example — ADR 0007

A complete, filled ADR plus the exact `adr.v1` artifact it produces. Read this when a reviewer
disputes that your options were "genuinely different", or when you are unsure how much detail a
section needs.

Scenario: a B2B order platform publishes order events to Kafka. Orders are written to Postgres.
Support reports missing shipment notifications a few times a week.

---

# 0007. Publish order events through a transactional outbox

- **Status:** accepted
- **Date:** 2026-08-27
- **Deciders:** Order platform team lead, Head of Engineering
- **Decision class:** two-way door
- **Supersedes:** —
- **Superseded by:** —
- **Review by:** 2027-02-28

## Context

`OrderService.confirm()` commits the order to Postgres and then calls
`kafkaTemplate.send("orders.v1", event)`. The two operations are not atomic. Between January and
August the incident log records 11 occurrences of an order existing in Postgres with no
corresponding `OrderConfirmed` event, all correlated with pod restarts during deploys. Each
occurrence costs roughly 40 minutes of support time and one manual event replay.

We are about to add a second consumer (invoicing), which triples the blast radius of a lost
event, so the workaround of "support notices and replays" stops being viable now.

Constraints treated as fixed (not decided here):

- Postgres remains the system of record for orders (ADR-0002).
- Kafka remains the event transport (ADR-0004).
- No new operational component may require a dedicated on-call rota (ops constraint).

## Decision drivers

| # | Driver | 25010 characteristic | Weight |
|---|---|---|---|
| D1 | Zero committed orders without a published event, measured over a 30-day window across ≥ 20 deploys | Reliability | 45 |
| D2 | Event visible to consumers within 2 s at p99 of order commit | Performance efficiency | 20 |
| D3 | No additional on-call surface: no new always-on process outside the existing service deployment | Maintainability | 20 |
| D4 | Adding a third consumer costs ≤ 1 person-day of producer-side work | Flexibility | 15 |
| | | **Total** | **100** |

## Considered options

### Option A — Transactional outbox with an in-process poller

Insert the event into an `outbox` table in the same transaction as the order write. A scheduled
task inside the existing service polls unpublished rows with `FOR UPDATE SKIP LOCKED`, publishes
to Kafka, then stamps `published_at`.

- **Pros:** atomicity guaranteed by the database; no new deployable; publishing survives broker
  outages because rows accumulate; ordering per aggregate preserved by ordering on `occurred_at`.
- **Cons:** polling adds latency (bounded by the interval); duplicate publishes are possible on
  poller crash, so consumers must dedup; the outbox table needs pruning.
- **Cost:** build 4 person-days · run €0/month · reverse in 12 months 2 person-days

### Option B — Transactional outbox read by Debezium CDC

Same outbox table, but a Debezium connector on Kafka Connect tails the Postgres write-ahead log
and publishes rows as they commit.

- **Pros:** sub-second publish latency; no polling load on the primary; the same mechanism scales
  to other tables later.
- **Cons:** introduces Kafka Connect and a connector as an operated component; requires logical
  replication slots, which can retain WAL and fill the disk if the connector stalls; a new
  failure mode with its own on-call knowledge.
- **Cost:** build 6 person-days · run ≈ €180/month · reverse in 12 months 4 person-days

### Option C — Keep dual-write, add a reconciliation job

Leave the code as is; run a job every 5 minutes that finds orders with no matching event and
republishes.

- **Pros:** smallest change; no new tables; no consumer changes.
- **Cons:** the gap is detected, not prevented, so the window is up to 5 minutes; the job needs
  its own idempotency; the reconciliation query grows with the orders table; the failure remains
  invisible to consumers during the window.
- **Cost:** build 2 person-days · run €0/month · reverse 1 person-day

These three differ on failure mode (A/B prevent, C detects), on topology (B adds a component,
A and C do not), and on runtime model (B is always-on infrastructure).

## Scoring

| Driver | Weight | A | B | C |
|---|---|---|---|---|
| D1 zero lost events | 45 | 5 | 5 | 2 |
| D2 p99 ≤ 2 s | 20 | 4 | 5 | 1 |
| D3 no new on-call surface | 20 | 5 | 1 | 5 |
| D4 third consumer ≤ 1 day | 15 | 4 | 4 | 3 |
| **Weighted total** | **100** | **460** | **385** | **255** |

Evidence: D1/A — outbox insert is in the same transaction, so atomicity is a database property,
verified by the integration test `OutboxAtomicityTest#noOrderWithoutOutboxRow`.
D2/A — measured on staging: 200 ms poll interval + 60 ms publish gives p99 340 ms, well inside
2 s (`k6 run perf/outbox-latency.js`). D2/B — Debezium latency claim taken from vendor docs,
not measured here, so scored on evidence but flagged. D3/B — Kafka Connect would be the first
component in this platform outside the service deployments.

**Sensitivity:** moving the top weight from D1 to D2 makes B win (A 460 → 430, B 385 → 410),
so the decision is sensitive to whether latency matters more than operational surface. The
business confirmed the 2 s bound is a comfort target, not a contractual one, so D1 keeps the
top weight. Removing unevidenced scores does not change the winner.

## Decision outcome

We will implement the transactional outbox with an in-process poller (Option A), because D1
(zero lost events over 30 days) carries 45 of 100 weight and Option A makes atomicity a property
of the existing Postgres transaction rather than of an additional operated component.

## Consequences

**Positive**

- Lost events become structurally impossible rather than rare: the order and its outbox row
  commit or roll back together.
- Publishing survives a Kafka outage — rows accumulate and drain when the broker returns.
- Adding the invoicing consumer requires no producer change.

**Negative**

- We accept performance efficiency at p99 ≈ 340 ms publish latency (a 200 ms polling floor)
  in exchange for reliability at zero lost events. A CDC design would be faster.
- Every consumer must now be idempotent: the poller publishes at-least-once, and a crash between
  publish and `published_at` update produces a duplicate. This is work pushed onto three teams.
- One more table with a retention policy to own.

**Risks**

| Risk | Detection signal | Mitigation | Owner |
|---|---|---|---|
| Poller stalls; events silently stop flowing | alert on oldest unpublished row age > 60 s | health check on poller thread + page | Order platform |
| Outbox table grows without bound | table size alert at 5 GB | nightly delete of rows with `published_at < now() - 7 days` | Order platform |
| A consumer is not actually idempotent | duplicate shipment notifications reported | inbox table with `message_id` in each consumer, verified by contract test | Consumer teams |

## Fitness function

```bash
./gradlew test --tests '*OutboxAtomicityTest'
grep -rn "kafkaTemplate.send" src/main/java/com/acme/order/domain/ && exit 1 || exit 0
```

Wired into: `.github/workflows/ci.yml` job `architecture-gates`. Failure means someone published
to Kafka directly from domain code again; move the publish into the outbox.

## Implementation notes

- Affected components: `src/main/java/com/acme/order/`, migration `V37__create_outbox.sql`
- Migration/rollout: create table → dual-write outbox + direct publish for one week with a
  comparison metric → remove the direct publish.
- Exit path if we are wrong: the outbox table stays; swap the poller for a Debezium connector
  without touching producer code (this is why the decision class is two-way door).

## Related

- Depends on: ADR-0002 (Postgres as system of record), ADR-0004 (Kafka as event transport)
- Requirements: REQ-ORD-014, REQ-ORD-021
- Memory fact: fact-0042

---

## The `adr.v1` artifact this renders to

```json
{
  "schema": "adr.v1",
  "producedBy": "integration-architect",
  "number": 7,
  "title": "Publish order events through a transactional outbox",
  "status": "accepted",
  "date": "2026-08-27",
  "deciders": ["Order platform team lead", "Head of Engineering"],
  "context": "OrderService.confirm() commits to Postgres then publishes to Kafka non-atomically; 11 lost events recorded Jan-Aug, all correlated with pod restarts. A second consumer (invoicing) is about to triple the blast radius.",
  "drivers": [
    "D1 Reliability: zero committed orders without a published event over a 30-day window across >= 20 deploys (weight 45)",
    "D2 Performance efficiency: event visible to consumers within 2 s at p99 of order commit (weight 20)",
    "D3 Maintainability: no new always-on process outside existing service deployments (weight 20)",
    "D4 Flexibility: adding a third consumer costs <= 1 person-day of producer work (weight 15)"
  ],
  "options": [
    {
      "name": "Transactional outbox with in-process poller",
      "pros": ["Atomicity is a database property", "No new deployable", "Survives broker outage", "Per-aggregate ordering preserved"],
      "cons": ["200 ms polling latency floor", "At-least-once: consumers must dedup", "Outbox table needs pruning"],
      "cost": "build 4 person-days; run EUR 0/month; reverse in 12 months 2 person-days"
    },
    {
      "name": "Transactional outbox read by Debezium CDC",
      "pros": ["Sub-second publish latency", "No polling load on the primary", "Reusable for other tables"],
      "cons": ["Adds Kafka Connect as an operated component", "Replication slot can retain WAL and fill disk", "New on-call knowledge required"],
      "cost": "build 6 person-days; run EUR 180/month; reverse in 12 months 4 person-days"
    },
    {
      "name": "Keep dual-write, add a 5-minute reconciliation job",
      "pros": ["Smallest change", "No consumer changes"],
      "cons": ["Detects instead of preventing; up to 5-minute gap", "Reconciliation query grows with the orders table", "Failure invisible to consumers during the window"],
      "cost": "build 2 person-days; run EUR 0/month; reverse 1 person-day"
    }
  ],
  "decision": "We will implement the transactional outbox with an in-process poller, because D1 (zero lost events) carries 45 of 100 weight and this option makes atomicity a property of the existing Postgres transaction rather than of an additional operated component.",
  "consequences": {
    "positive": [
      "Lost events become structurally impossible: order and outbox row commit together",
      "Publishing survives a Kafka outage; rows drain when the broker returns",
      "Adding the invoicing consumer requires no producer change"
    ],
    "negative": [
      "We accept performance efficiency at p99 ~340 ms publish latency in exchange for reliability at zero lost events",
      "Every consumer must become idempotent; at-least-once publishing pushes work onto three teams",
      "One more table with a retention policy to own"
    ],
    "risks": [
      "Poller stalls silently - detected by alert on oldest unpublished row age > 60 s",
      "Outbox table grows unbounded - detected by table size alert at 5 GB",
      "A consumer is not actually idempotent - detected by duplicate shipment notification reports"
    ]
  },
  "supersedes": null
}
```

## What makes this example pass review

- Three options that differ on **failure mode**, **topology** and **runtime model** — not three
  vendors of the same idea.
- Every driver ends in a unit. Weights sum to 100 with exactly one above 15... and D2/D3 tie at
  20, which is legal (the rule is *at most three* above 15).
- The sensitivity analysis found that the winner flips under a different weighting, and the ADR
  says so instead of hiding it.
- The negative consequence names the sacrifice in the required sentence form and admits the work
  pushed onto other teams.
- The fitness function is two commands that fail a build.
