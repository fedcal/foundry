---
title: Error budget policy — <service> / <journey>
trigger: Error budget consumption crosses 50%, 75% or 100% in the trailing 28-day window.
---

# Error budget policy — <journey>

Signed by: **<product owner name>**, **<engineering owner name>** on **<YYYY-MM-DD>**.
Review date: **<YYYY-MM-DD, at most 6 months out>**.

Store the signed version as a `fact.v1` of type `decision` through the `memory_write` tool so
it is retrievable in future sessions rather than lost in a wiki.

## 1. The SLO this policy governs

| Field | Value |
|---|---|
| Journey | A signed-in customer places an order and sees a confirmation. |
| SLI | `good / valid` where **valid** = all requests to `POST /checkout` at the ingress, excluding health checks, synthetic probes and load-test traffic; **good** = HTTP status not 5xx **and** served within 500 ms. Client 4xx from our own frontend count as **bad**. |
| Measurement point | Ingress access logs. Blind to DNS, CDN and TLS failures before the load balancer; a synthetic probe covers those separately. |
| Target | 99.9% |
| Window | 28-day rolling |
| Error budget | 0.1% = ~40 minutes downtime-equivalent = **~108 800 failed checkouts** at the current rate |
| Dependency ceiling | 99.84% — **the target exceeds the ceiling**, so `<dependency>` must be removed from the critical path by `<date>` or the target lowered to 99.8%. |
| Target derivation | Complaint threshold: support volume rises measurably below 99.85%; rounded to 99.9%. |

## 2. Consequences (automatic, not debated during the incident)

| Budget consumed | Consequence |
|---|---|
| < 50% | Normal operation. Ship. Consider spending budget deliberately (see §4). |
| 50–75% | Warning. At least one reliability item enters the next iteration, owned by a named engineer. |
| 75–100% | Risky deploys (schema changes, infrastructure changes, dependency upgrades) require explicit approval from `<role>`. New features ship behind flags that default to off. |
| > 100% | **Feature freeze on this service.** Only reliability work, security fixes and severity-1 bug fixes merge, until the trailing 28-day window returns below 100%. |
| Exhausted twice in 90 days | The target or the architecture is re-examined and the outcome recorded as an ADR under `docs/adr/`. |

## 3. Override

Exactly **one** role may lift a freeze: `<role, e.g. VP Engineering>`. The override is written,
names a business reason and an end date, and is recorded as an ADR within 48 hours.
"Everyone can override" means the policy does not exist.

## 4. Deliberate spend

The budget is a resource to spend, not only to protect. The following draw from it and are
scheduled when the budget allows:

- risky migrations and cut-overs;
- production load tests and chaos experiments;
- accelerated rollouts of large changes.

A window ending with more than **90%** of the budget unspent for two consecutive windows is
reported as over-provisioned reliability: the team is buying nines nobody asked for with
velocity everybody wants. That is a finding, not a success.

## 5. Exempt events

Only these may be excluded from the budget, decided by `<role>` **after** the event, with the
exclusion and its justification published in the incident record:

- a cloud provider's declared regional outage affecting a dependency we cannot fail away from;
- a deliberate, announced maintenance window agreed with customers in advance;
- traffic from a confirmed denial-of-service attack, excluded only for the attack window.

Everything else counts, including our own bad deploys, expired certificates and
misconfigurations. Ad-hoc undocumented exclusions destroy trust in the number faster than a
missed target ever does.

## 6. Reporting

- The budget is reported at every iteration review, in **failed events**, not only in minutes.
- Breaches produce a postmortem via `foundry-quality:postmortem` within **5 working days**.
- Paging volume is reported alongside the budget: **> 5 pages/week/rotation** means the
  alerting is wrong, not that the rotation is unlucky.
