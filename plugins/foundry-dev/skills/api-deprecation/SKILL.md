---
name: api-deprecation
description: Run a full API deprecation cycle — mark, announce, measure usage, sunset, remove — with the RFC 9745 Deprecation and RFC 8594 Sunset headers, the OpenAPI and changelog artefacts, the per-consumer telemetry that gates each step, and the removal migration. Use when an endpoint, field, parameter, status code or whole API version must be withdrawn.
user-invocable: true
argument-hint: "<endpoint | field | version> [--phase mark|announce|measure|sunset|remove]"
agent: foundry-dev:service-versioning-engineer
model: opus
effort: high
metadata:
  foundry.vertical: dev
  foundry.io: "adr.v1 -> plan.v1 + headers + telemetry"
license: Apache-2.0
---

# Run an API deprecation cycle

Removing something from an API is a project with five gates, not a commit. Each gate has an
artefact and a **measurement** that must pass before the next one starts. The measurement is
the point: a deprecation without usage telemetry is an announcement followed by an outage.

**Rule that governs everything below: you may not remove what you cannot prove is unused.**

## Scope

Applies to anything a consumer can observe and depend on: an endpoint, an HTTP method on an
endpoint, a request or response field, a query parameter, an enum value, a status code, an
error `type` URI, a header, an authentication scheme, or a whole API major version.

Removing a **response field** is as breaking as removing an endpoint, and is far more often
done by accident. Treat it identically.

## When not to use this

- The change is additive (a new optional field, a new endpoint). No deprecation needed; ship it.
- The API has never been released and has no consumers outside this repository. Delete it and
  say why the cycle was skipped.
- You are removing an internal class or an unpublished interface. That is refactoring.
- The removal is forced by a security incident. **Stop.** An emergency withdrawal is an
  incident procedure with different trade-offs (break consumers now, apologise later); this
  skill's timelines do not apply and pretending they do will delay the fix.
- Event/message schema evolution → `integration-architect`. GraphQL `@deprecated` and Protobuf
  `reserved` have their own mechanics → `protocol-engineer`. The five phases still apply; the
  headers do not.

## Phase 0 — Precondition: know your consumers

Before phase 1, you must be able to list, by name: every consumer, its contact, the API
version it uses, and its last-seen timestamp.

```bash
# internal callers in a monorepo
grep -rn '/v1/orders' --include='*.java' --include='*.ts' --include='*.yaml' . | grep -v '/test/'
# published contracts, if a broker is in use
grep -rn 'pact\|spring-cloud-contract' pom.xml build.gradle build.gradle.kts 2>/dev/null
find . -name '*.pact.json' -o -type d -name pacts 2>/dev/null
```

If the consumer list is unknown, **that is the first deliverable**, not the deprecation. An API
with unknown consumers can only be frozen, never removed. Building the telemetry in phase 3 is
what converts "unknown" into "known" — start it now, and let it run for a full business cycle
before you announce a date.

**A successor must exist first.** The deprecation window starts when the replacement is
generally available, documented and migratable — not when the announcement goes out. Deprecating
without a migration path is hostile, and consumers will simply ignore it.

## Phase 1 — Mark

Make the deprecation visible in every channel a developer might be looking at. Marking is
mechanical and reversible; it commits you to nothing but honesty.

Artefacts:
- **OpenAPI**: `deprecated: true` on the operation or the schema property, and a `description`
  that names the successor and links to the migration guide. This is what shows up in every
  generated SDK and doc site.
- **Response headers** on every response from the deprecated resource: `Deprecation` (RFC 9745)
  and a `Link` with `rel="deprecation"` pointing at the policy page. **Do not emit `Sunset`
  yet** — you do not have a date you will honour. See `references/headers.md` for exact syntax
  and a Spring filter/interceptor implementation.
- **Code**: `@Deprecated` on the controller method with a Javadoc `@deprecated` line naming the
  successor, so internal callers get a compiler warning.
- **Changelog**: an entry under a `Deprecated` heading, with the successor and the (not yet
  fixed) intended window.
- **Telemetry**: the per-version, per-consumer counter must be emitting **before** you leave
  this phase (phase 3 depends on having history).

Gate to leave phase 1:
- [ ] Successor exists, is documented, and a migration guide is published.
- [ ] Headers verified in an automated test, not by hand.
- [ ] Telemetry emitting and visible in a dashboard.
- [ ] No `Sunset` header emitted yet.

## Phase 2 — Announce

An announcement is a dated, addressed communication — not a line in a changelog nobody
subscribes to.

Set the window length from the consumer relationship, and record it as a `decision` fact:

| Relationship | Minimum window | Gate |
|---|---|---|
| Internal, same org, contracts in a broker | Weeks | "Can I deploy" check is green for all consumers |
| Another team / internal platform | 1–2 quarters | Plus one full release cycle of the slowest consumer |
| Public or contractual | Contractual, else ≥ 2 quarters | Plus ≥ 3 announcements at spaced intervals |
| Mobile clients you cannot force-update | Bounded by your own install-base telemetry | Not by a policy you prefer — measure the tail |

Artefacts:
- A dated announcement to every named consumer contact (template in
  `references/comms-templates.md`), stating: what is deprecated, why, the successor, the
  migration steps, the **sunset date**, and what happens after it.
- The migration guide: before/after request and response examples, a field mapping table, and
  the behavioural differences — including the ones that are worse for the consumer. Hiding
  those guarantees a support escalation on sunset day.
- Now start emitting **`Sunset`** (RFC 8594) with the announced date, plus
  `Link rel="successor-version"` pointing at the replacement resource so a client can discover
  the target from the response itself.
- A dashboard link consumers can use to see **their own** usage. This converts an argument into
  a shared fact and is the single highest-leverage artefact in the whole cycle.

Gate to leave phase 2:
- [ ] Every named consumer has been contacted and the contact is recorded with a date.
- [ ] The sunset date is set, published, and emitted in the header — and you intend to honour it.
- [ ] Migration guide published, including the unfavourable differences.

## Phase 3 — Measure

This is the phase that decides whether the removal happens, and it runs for the whole window.

You must be able to answer, per API version and per consumer identity:
- request count over the last 1, 7 and 30 days;
- last-seen timestamp;
- the trend — is it falling, flat, or rising?

Instrument with a counter tagged by version and by client identity (OAuth client id, API key
id, or a mandated `User-Agent`). Implementation and query examples in
`references/telemetry.md`.

```bash
# is anything still calling it?
curl -s 'localhost:8080/actuator/metrics/http.server.requests?tag=uri:/v1/orders'
```

Rules:
- **Flat traffic near the sunset date means the announcement did not land.** Escalate through a
  different channel; do not treat silence as consent.
- **Rising traffic** means a new integration was built against a deprecated resource — fix the
  discovery path (docs, SDK, portal) that allowed it.
- A consumer you cannot identify counts as **in use**. Add identification (require a client id)
  before you consider removal.
- Reminders at fixed offsets before sunset: 90, 30, 7 and 1 day are a reasonable default for a
  two-quarter window. Scale to the window.
- Optional and effective for public APIs: **brownouts** — return 410 for a scheduled short
  window (minutes) a few weeks before sunset, announced in advance. It surfaces the consumers
  that read no email. Do not brownout without announcing; do not brownout a payment or safety
  path.

Gate to leave phase 3:
- [ ] Zero traffic from unidentified clients for the last 30 days.
- [ ] Every remaining consumer has confirmed migration in writing, or has an agreed extension
      with a new date.
- [ ] The trend is zero, not merely low.

## Phase 4 — Sunset

At the sunset date the resource stops serving its function. Turn it off in a **reversible** way
first: this is the expand/contract discipline applied to an API.

- Flip a **feature flag**, not a deployment. The endpoint returns `410 Gone` with an RFC 9457
  problem body whose `type` is your `resource-gone` URI, `detail` names the successor, and a
  `Link rel="successor-version"` header points at it. Keep the `Sunset` header.
- 410 rather than 404: 410 means "was here, deliberately gone", which is actionable. 404 is
  indistinguishable from a typo and will generate support tickets.
- Keep the code deployed for a defined soak (2–4 weeks is typical) so the flag can be flipped
  back within minutes if a critical consumer surfaces. Announce that this window exists — and
  that it will not be extended.
- Monitor the 410 rate: it is your final, honest count of consumers who never migrated.
- Do not silently degrade instead (empty arrays, nulls, stale data). Silent degradation
  produces incorrect behaviour in the consumer's system, which is worse than a clear failure,
  and it will be your fault.

Gate to leave phase 4:
- [ ] 410 rate at zero, or every remaining caller identified and explicitly accepted as
      breakage by a named owner.
- [ ] The soak period elapsed with the flag off and no rollback.

## Phase 5 — Remove

Only now does code disappear.

- Delete the controller, DTOs, mappers, tests and OpenAPI entries. Remove the feature flag.
- Remove the operation from the OpenAPI document; the diff will be **breaking**, which is
  correct and expected here — it is the one place a breaking OpenAPI diff is allowed to pass CI,
  and it should require an explicit approval, not a silent bypass.
- Regenerate and publish SDKs, with a major version bump.
- Changelog entry under `Removed`, referencing the deprecation announcement date.
- Database: columns and tables that existed **only** for this API can now be dropped — through
  `write-migration`, with its own expand/contract and rename-and-soak. The API's removal does
  not make the drop reversible.
- Contract broker: remove the retired contracts so the provider pipeline stops verifying them.
- Record a `decision` fact via `memory_write`: what was removed, when, the window it ran, and
  how many consumers were affected. The next deprecation is planned from this number.

Gate to leave phase 5:
- [ ] Code, tests, docs, SDKs, contracts and flag all removed.
- [ ] No dead schema left behind (or a `write-migration` plan exists for it).
- [ ] Fact recorded.

## Exit criteria for the whole cycle

- [ ] Every consumer was identified by name before the announcement.
- [ ] A successor existed and was documented before phase 1.
- [ ] `Deprecation` header from phase 1; `Sunset` header only from phase 2 onward; both
      asserted by an automated test.
- [ ] `Link rel="successor-version"` present on every deprecated and gone response.
- [ ] Announcement delivered to every named contact, with dates recorded.
- [ ] Per-consumer telemetry ran for the **entire** window and reached zero.
- [ ] Sunset implemented as a reversible flag returning 410 with an RFC 9457 body, soaked
      before removal.
- [ ] Removal covered code, docs, SDKs, contracts, flags and schema.
- [ ] `plan.v1` written to `.foundry/blackboard/<wave>/api-deprecation.json` with one wave per
      phase and a machine-checkable gate each; caller summary ≤ 300 tokens.

## Deliberately not covered

Choosing what should replace the removed capability (`design-api-contract`,
`solution-architect`); the versioning scheme itself (`service-versioning-engineer`); event and
message schema retirement (`integration-architect`); gRPC/Protobuf `reserved` and GraphQL
`@deprecated` mechanics (`protocol-engineer`); the legal and contractual consequences of
withdrawing a paid or contracted API (foundry-legal — involve them **before** phase 2, not
after); gateway and CDN configuration for the 410 response (foundry-ops); emergency withdrawal
during a security incident.

## Degradation

No telemetry → the honest output is a plan to build it, plus a frozen API. Never a sunset date
derived from a guess. No contract broker → use committed OpenAPI diffs plus recorded-traffic
replay and mark consumer coverage `confidence: low`. No feature-flag platform → implement phase
4 as a configuration property that can be flipped without a rebuild, and state the rollback
time (a redeploy) explicitly. No `foundry` MCP server → write the plan and fact files directly
and note they were not schema-validated. No `superpowers` → the phase gates above are the
verification discipline; do not skip a gate because the change looks small.
