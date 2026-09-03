---
name: threat-model
description: Run a threat modelling session against a real codebase - enumerate entry points from source, draw trust boundaries, apply STRIDE per boundary, rank threats by exploitability x impact, and emit risk.v1 artifacts plus a mitigation checklist in which every mitigation is bound to a named test. Use before freezing a design, when a new trust boundary appears (new integration, new tenant model, new public endpoint, new upload path), when onboarding to an unfamiliar service, or after a security incident.
agent: foundry-dev:security-architect
user-invocable: true
argument-hint: "<path> [--wave w1] [--scope <module>] [--crown-jewel <asset>]"
metadata:
  foundry.vertical: dev
  foundry.io: "codebase + scope -> risk.v1 + mitigation checklist"
license: Apache-2.0
---

# Threat model a real codebase

A threat modelling session is four questions (Shostack / the Threat Modeling Manifesto):
*What are we working on? What can go wrong? What are we going to do about it? Did we do a
good enough job?* This skill turns those into a two-to-four hour procedure with artifacts.

Defensive only. Produce weakness classes, detections and mitigations. Never produce exploit
code or attack tooling.

## Preconditions — refuse to start without these

1. A repository path that exists and a stated scope (which services or modules).
2. One named **crown jewel**: the asset whose compromise is worst. Without it every threat
   ranks the same and the output is a list, not a model.
3. A wave id for the blackboard path. Default `w1`.
4. A named owner for the output. Risks without an owner are not risks, they are trivia.

## Timebox

| Phase | Budget | Output |
|---|---|---|
| 1 Assets | 15 min | asset table with C/I/A cost bands |
| 2 Decomposition | 45 min | entry-point table (the longest phase; do not shorten it) |
| 3 Boundaries | 20 min | `B1..Bn` with crossing assets |
| 4 STRIDE | 60 min | threat list, 6 categories answered per boundary |
| 5 Ranking | 20 min | E, I, probability, impactEur, exposureEur |
| 6 Mitigation + proof | 30 min | mitigation checklist, each with `Proof:` |
| 7 Emit | 10 min | validated `risk.v1` + checklist |

If you exceed the Phase 2 budget, narrow the scope. A complete model of one service beats a
partial model of six.

## Phase 1 — Assets

Build `.foundry/scratch/<session>/assets.md`:

| Asset | Where it lives | Read by | Written by | Confidentiality cost | Integrity cost | Availability cost |
|---|---|---|---|---|---|---|

Cost bands, not currency, at this stage: `catastrophic / major / moderate / minor / none`.
An asset scored `none` on all three is out of scope — write it down as out of scope so
nobody re-raises it.

Mark exactly one row as the crown jewel.

## Phase 2 — Decompose from the code

This is the phase that determines whether the model is real. Do not draw a diagram from
what someone tells you the system does.

Run the entry-point sweep in `references/entry-point-sweep.md` (patterns per stack: Spring,
Node/Nest, Python, Go, .NET, plus queues, schedulers, gRPC, GraphQL, file drops, and
outbound calls). Record each entry point in `.foundry/scratch/<session>/entry-points.md`:

| # | Entry point | Reachable by | Runs as | Reads | Writes | Calls out | Authz decision at |
|---|---|---|---|---|---|---|---|

Rules:

- **"Authz decision at" must be a `file:line`.** `unknown` in that column is already a
  finding (CWE-862, ASVS 5.0 V8). Do not fill it with "the framework".
- Include the entry points nobody lists: health and metrics endpoints, actuator/debug
  routes, admin consoles, webhook receivers, error pages that render user input, static
  file handlers, GraphQL introspection, and any `/v1` kept alive for one legacy client.
- Read the deployment reality: `Dockerfile`, compose files, `k8s/**`, `*.tf`, ingress and
  reverse-proxy config, `.github/workflows/**`, and the security filter chain. A boundary
  that exists only in a diagram does not exist.
- Note what is *missing*: an entry point with no test file is where unmodelled behaviour
  accumulates.

Now write the data-flow decomposition as text, not a picture:
`external actor -> [boundary] -> process -> [boundary] -> store`, one line per flow. Text
diffs; a picture does not.

## Phase 3 — Trust boundaries

Enumerate `B1..Bn`. At minimum consider:

`internet -> edge` · `edge -> app` · `app -> database` · `app -> cache` · `app -> object
store` · `app -> broker` · `app -> third party` · `third-party webhook -> app` ·
`tenant A <-> tenant B in one process` · `user -> admin surface` · `build -> registry ->
runtime` · `operator -> production data`

For each: what crosses, in which direction, with what identity, over what channel, and what
verifies the other side. The verification column is where spoofing threats appear on their
own.

## Phase 4 — STRIDE per boundary

For every boundary answer all six categories. "No credible threat because X" is a valid and
required answer; a blank is not. Use the elicitation prompts in
`references/stride-prompts.md` (per-category question sets plus the frequent real forms and
their CWE ids).

Record in `.foundry/scratch/<session>/threats.md`:

| Id | Boundary | STRIDE | Threat (one sentence, no exploit detail) | CWE | ASVS 5.0 chapter |
|---|---|---|---|---|---|

Then run three cross-checks that STRIDE alone misses:

1. **Business logic.** Can the workflow be run out of order, twice, or in parallel with
   itself? Refunds, coupons, quotas, invitations, state machines with no guard on the
   transition. Most of these are CWE-362/CWE-367.
2. **Privacy (LINDDUN).** Linkability, identifiability, detectability, unawareness,
   non-compliance. STRIDE will not surface "two anonymous datasets join into one identity".
3. **Abuse of intended function.** Features working exactly as designed, at a scale or by
   an actor nobody intended: bulk export, search enumeration, invite spam, password-reset
   as an email relay, webhooks as an SSRF proxy.

## Phase 5 — Rank

Two 1–5 axes, each justified in one clause.

**Exploitability (E)**: 5 unauthenticated remote single request · 4 any authenticated user ·
3 specific role or a race window · 2 network position or local access · 1 insider with
production credentials.

**Impact (I)**: 5 crown jewel or cross-tenant breach · 4 mass disclosure or money movement ·
3 single-account compromise · 2 recoverable availability loss · 1 low-value leak.

`probability = clamp((E * I) / 25, 0.01, 0.95)`. This is an ordinal-to-probability
convention, not a measurement — state it in the artifact.

`impactEur` comes from the loss model in `references/impact-model.md` (records × per-record
cost, downtime × revenue per hour, fraud ceiling, regulatory band, remediation labour).
Use order-of-magnitude bands and say they are bands. A fabricated precise figure is worse
than an honest band because it survives into a slide deck.

`exposureEur = probability * impactEur`. Compute it; never type it.

## Phase 6 — Mitigation and proof

For each threat, in this order of preference:

1. **Eliminate** the flow — delete the endpoint, drop the field, remove the dependency.
2. **Structural control** the next developer cannot bypass — parameterised query API,
   deny-by-default policy filter, repository-layer tenant predicate that throws when absent,
   egress allow-list, `__Host-` cookie prefix, database row-level security, unique
   constraint enforcing idempotency.
3. **Local check** at the call site — weakest: the next endpoint added will omit it.

Then bind a proof test. Use the mapping table in `references/mitigation-tests.md`
(threat class → test shape → assertion → where it lives). The rule:

> A mitigation whose removal breaks no test is not a mitigation.

Write `.foundry/blackboard/<wave>/security-architect.checklist.md`:

```markdown
# Mitigation checklist — <scope> — <date from args>

| Exposure | Id | Threat | Mitigation | Proof | Owner | Due |
|---|---|---|---|---|---|---|
| 42000 | T-07 | Tenant id read from request body on PATCH /orders/{id} | Resolve tenant from the verified session in `OrderController`; add a repository predicate that throws when the tenant filter is absent | `OrderTenantIsolationIT#patchOtherTenantReturns404` | payments | 2026-09-15 |
```

Sort descending by exposure. Count and report `Proof: MISSING` entries separately — that
count is the honest measure of how much of the model is aspirational.

## Phase 7 — Emit `risk.v1`

One object per threat that survived ranking. Template in `references/risk-template.json`.

```json
{
  "schema": "risk.v1",
  "producedBy": "security-architect",
  "id": "T-07",
  "title": "Tenant identifier accepted from the request body on order update",
  "category": "security",
  "probability": 0.64,
  "impactEur": 250000,
  "exposureEur": 160000,
  "detection": "Alert on any request where body.tenantId differs from session tenant; counter authz.tenant_mismatch",
  "mitigation": "Resolve tenant from the verified session in OrderController and enforce a repository-level tenant predicate. Proof: OrderTenantIsolationIT#patchOtherTenantReturns404",
  "contingency": "Feature-flag the update endpoint off; replay audit log for cross-tenant writes in the last 90 days",
  "owner": "payments",
  "reviewBy": "2026-09-15",
  "status": "open"
}
```

Validate before returning. `additionalProperties` is `false` on `risk.v1` — an extra field
fails the write. `category` must be one of the schema's enum values; security threats are
`security`, regulation-driven ones are `compliance`.

## Phase 8 — "Did we do a good enough job?"

Exit criteria — all must hold:

- [ ] Every entry point from Phase 2 appears in at least one boundary.
- [ ] Every boundary has all six STRIDE categories answered.
- [ ] Business-logic, privacy and abuse cross-checks recorded.
- [ ] Every risk has `mitigation` ending in `Proof:`.
- [ ] Every risk has a real `owner` and a `reviewBy` date.
- [ ] `exposureEur == probability * impactEur` for every risk, recomputed.
- [ ] Artifact validates against `risk.v1`; checklist written and sorted.
- [ ] `Proof: MISSING` count reported explicitly.
- [ ] Every `E >= 4 and I >= 4` risk is mitigated in the current plan or explicitly accepted
      by a named human.

## Keeping the model alive

A threat model decays the moment the code changes. Re-run this skill when any of these
happen — put them in the definition of done for those changes:

- a new entry point, a new outbound integration, a new file upload or export
- a change to the authentication or authorisation mechanism
- a new tenant isolation mode or a first enterprise customer
- a datastore change (new store, new replication, new region)
- a change to the release pipeline or its credentials
- any security incident, whether or not it was in the model

Persist durable conclusions as `fact.v1` entries of type `risk` via the `memory_write` MCP
tool — never by writing memory files by hand (AUTHORING §3).

## What this skill deliberately does not cover

- **Exploit development or penetration testing.** The model produces hypotheses; confirming
  exploitability requires an authorised test under a separate scope agreement.
- **Line-level vulnerability discovery.** Use the `security-review` skill; boundary-level
  modelling will miss code-level bugs by construction.
- **Infrastructure, cloud posture and container runtime threats** beyond the boundaries they
  create. Route to the ops vertical.
- **Formal risk registers, ISO/IEC 27001 statements of applicability and audit evidence.**
- **Physical, personnel and social-engineering threats.**
- **Quantitative actuarial risk modelling.** The euro figures are bands for ranking, not
  loss forecasts.

## Degradation

- `superpowers` present: use `superpowers:brainstorming` for Phase 1 and
  `superpowers:writing-plans` to turn the Phase 6 checklist into a remediation plan.
  Absent: proceed with the phases above; nothing here depends on it.
- No `rg`: `grep -rn` with the same patterns; record reduced coverage in the artifact.
- No runtime or cloud access: mark every boundary as source-derived and lower confidence in
  the checklist.
- No loss data: use bands from `references/impact-model.md` and label them as bands.
- Monorepo too large for one session: model one bounded context per session and record the
  boundary between contexts as an explicit trust boundary in each.

## References

- `references/entry-point-sweep.md` — search patterns per stack, including the surfaces
  teams forget.
- `references/stride-prompts.md` — elicitation questions per STRIDE category with CWE and
  ASVS chapter mapping.
- `references/impact-model.md` — turning cost bands into `impactEur` honestly.
- `references/mitigation-tests.md` — threat class to proof-test mapping.
- `references/risk-template.json` — copyable `risk.v1` skeleton.
