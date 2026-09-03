---
title: foundry-dev
description: Architecture, domain modelling, protocols, data, security, identity, UX and accessibility, Angular and Spring Boot.
sidebar:
  order: 3
---

`foundry-dev` is the largest vertical: nineteen agents and seventeen skills covering the decisions
that are expensive to reverse and the implementation work that follows them. It is opinionated
about stack in two places — Angular on the frontend, Spring Boot 3 and PostgreSQL on the backend —
and stack-neutral everywhere else.

## Install

```bash
/plugin install foundry-dev@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- You are making architectural decisions you will have to live with: boundaries, consistency
  models, topology, build-vs-buy.
- You are writing Angular or Spring Boot code and want the conventions already in the codebase
  respected rather than a generic scaffold.
- You need a threat model, an application-security review, an accessibility audit or an API
  contract designed before implementation.

## When not to use it

- It does not run your CI or deploy anything — that is `foundry-ops`.
- It does not own test strategy, performance budgets in CI or SLOs — that is `foundry-quality`.
- `accessibility-engineer` fixes accessibility technically; the *legal* side of a conformance
  claim lives in `foundry-legal`.
- The Angular and Spring agents detect the project's real conventions first. On a codebase using
  neither, most of that value disappears; the architecture, security and data agents still apply.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `solution-architect` | Decisions that are expensive to reverse: component boundaries, consistency and state models, runtime and deployment topology, build-vs-buy, technology selection. | `opus` | `high` |
| `domain-modeler` | Turns a fuzzy domain into named bounded contexts, a context map with explicit relationship patterns, aggregates with stated invariants and a ubiquitous language. | `opus` | `high` |
| `integration-architect` | Two systems exchanging data across a process, team or vendor boundary: sync vs async, delivery semantics, idempotency, transactional outbox, saga and compensation, anti-corruption layers. | `opus` | `high` |
| `protocol-engineer` | Picking and correctly using a wire protocol — HTTP/1.1, HTTP/2, HTTP/3, REST maturity, gRPC, GraphQL, WebSocket, SSE, AMQP, Kafka, MQTT, CoAP. | `sonnet` | `medium` |
| `database-architect` | PostgreSQL-first schema design: normalisation and deliberate denormalisation, primary key strategy, index design verified with `EXPLAIN`. | `opus` | `high` |
| `persistence-engineer` | JPA/Hibernate correctness and performance: fetch strategies, N+1 detection, entity graphs, projections, optimistic locking, JDBC batching. | `sonnet` | `medium` |
| `migration-engineer` | Changing a database schema without downtime: expand/migrate/contract, Flyway or Liquibase conventions, batched backfills, PostgreSQL lock avoidance. | `sonnet` | `medium` |
| `spring-engineer` | Spring Boot 3 application code: package structure, DI, configuration binding, transaction boundaries, Bean Validation, RFC 9457 errors, Testcontainers. | `sonnet` | `medium` |
| `python-engineer` | General-purpose Python application and library code: type hints and static typing, packaging and dependency management, async/await and structured concurrency, error-handling architecture, pytest test design. | `sonnet` | `medium` |
| `fastapi-engineer` | FastAPI service code: dependency injection, Pydantic v2 schemas, async SQLAlchemy 2.0 sessions, Alembic migrations, OAuth2/JWT wiring, exception handlers, OpenAPI generation, pytest/httpx testing. | `sonnet` | `medium` |
| `angular-engineer` | Modern Angular: standalone components, signals, built-in control flow, deferrable views, typed reactive forms, lazy routing, SSR. | `sonnet` | `medium` |
| `frontend-performance-engineer` | Core Web Vitals (LCP, INP, CLS) with numeric targets, `angular.json` bundle budgets, image and font strategy, hydration cost. | `sonnet` | `medium` |
| `ux-architect` | Interaction rather than decoration: task flows, information architecture, cognitive load, error prevention and recovery, form design, empty/loading/error states, microcopy. | `opus` | `high` |
| `accessibility-engineer` | Verifies and fixes against WCAG 2.2 Level AA, the ARIA Authoring Practices patterns and EN 301 549: keyboard operability, focus management across SPA route changes. | `sonnet` | `medium` |
| `security-architect` | Threat models a system by decomposing it into data flows, applying STRIDE per trust boundary and ranking threats by exploitability against impact. | `opus` | `high` |
| `appsec-reviewer` | Adversarial application-security code review against OWASP ASVS 5.0 and the OWASP Top 10 — injection, broken access control including IDOR and mass assignment, SSRF, unsafe deserialisation. | `opus` | `high` |
| `identity-engineer` | Authentication and authorisation: OAuth 2.1 / OIDC flow selection per client type, PKCE, token lifetimes and rotation, refresh-token reuse detection, session fixation. | `opus` | `high` |
| `supply-chain-guardian` | SBOM generation and checking (CycloneDX/SPDX), vulnerability triage separating reachable from unreachable, pinning and lockfile integrity. | `sonnet` | `medium` |
| `service-versioning-engineer` | Compatibility across service boundaries: SemVer for services versus APIs, URI vs media-type vs header versioning, consumer-driven contract testing, deprecation windows. | `opus` | `high` |

## Skills

| Skill | When it fires |
|---|---|
| `write-adr` | A decision is expensive to reverse and needs a validated `adr.v1` plus the rendered `docs/adr/NNNN-slug.md`. |
| `design-api-contract` | Contract-first design of an HTTP API (OpenAPI 3.1) or an event-driven API (AsyncAPI 3), with an RFC 9457 problem-details error model. |
| `evolve-schema` | An API or event schema must change without breaking consumers — classify the change, run an expand-contract migration. |
| `api-deprecation` | A full deprecation cycle: mark, announce, measure usage, sunset, remove, with RFC 9745 `Deprecation` and RFC 8594 `Sunset` headers. |
| `decompose-service` | Deciding whether to extract a service from a monolith, using measured coupling and cohesion rather than intuition. |
| `spring-endpoint` | Adding or changing a Spring Boot HTTP endpoint end to end, following the conventions already in the codebase. |
| `angular-component` | Scaffolding or refactoring an Angular component to match the project's real conventions, detected rather than assumed. |
| `python-service` | Creating or reviewing a Python/FastAPI service end-to-end: project layout and packaging, settings validation at startup, async SQLAlchemy wiring with Alembic baseline, one working vertical-slice route, test harness, health vs readiness endpoints, Dockerfile. |
| `design-tokens` | Establishing or refactoring a three-tier token system with theming, dark mode and contrast validation of every semantic pair. |
| `ux-review` | A heuristic plus task-based usability review of a flow, with severities tied to user impact. |
| `audit-accessibility` | A repeatable WCAG 2.2 Level AA audit of a page, route or component — automated `axe` pass first, then the manual checks automation cannot do. |
| `threat-model` | A threat modelling session against a real codebase: entry points enumerated from source, STRIDE per trust boundary. |
| `security-review` | An adversarial security pass over a diff, a module or a whole service, mapped to OWASP ASVS 5.0 and CWE. |
| `harden-headers` | Setting HTTP security headers and cookie flags: CSP without `unsafe-inline` including the nonce or hash migration path, HSTS, COOP/COEP/CORP, Referrer-Policy. |
| `secret-hygiene` | Detecting, rotating and removing leaked secrets across the working tree and the full git history, in the correct rotation order. |
| `optimise-query` | A slow query or ORM-backed endpoint: reproduce, measure with `EXPLAIN (ANALYZE, BUFFERS)`, one hypothesis, one change at a time. |
| `write-migration` | A reviewed migration safe to run against a live PostgreSQL database, with expand/migrate/contract phasing and lock avoidance. |

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `solution-architect` | `requirement.v1` | `adr.v1` |
| `domain-modeler` | `requirement.v1` (accepted raw and incomplete) | `requirement.v1` — each traced to a command, policy or invariant found in the domain |
| `integration-architect` | `requirement.v1` | `adr.v1` |
| `protocol-engineer` | `requirement.v1` | `adr.v1`, plus `finding.v1` for misuse discovered |
| `database-architect` | `requirement.v1` | `adr.v1` |
| `persistence-engineer` | `finding.v1[]` with a `failureScenario`, or `plan.v1` | `review.v1`, `dimension: persistence`, `metrics` carrying before/after numbers |
| `migration-engineer` | `adr.v1` | `plan.v1` |
| `spring-engineer` | `plan.v1` | `review.v1` |
| `angular-engineer` | `requirement.v1` and `plan.v1` | `handoff.v1` |
| `frontend-performance-engineer` | `requirement.v1` | `finding.v1` |
| `ux-architect` | `requirement.v1` | `review.v1` |
| `accessibility-engineer` | `requirement.v1` | `finding.v1` |
| `security-architect` | `plan.v1` | `risk.v1` |
| `appsec-reviewer` | a scoped review request | `review.v1` with an array of `finding.v1` in `findings` |
| `identity-engineer` | a scoped design or review request | `adr.v1` in design mode, one ADR per decision |
| `supply-chain-guardian` | a scoped scan request | `review.v1`, `dimension: supply-chain`, with `finding.v1` entries |
| `service-versioning-engineer` | `adr.v1` | `adr.v1` and `review.v1` |

## What else it ships

`references/stack-versions.json` is a **resolver**, not a version list. It deliberately contains no
version numbers: it tells an agent how to read the versions the project actually uses from files on
disk, and which upstream endpoint to query for "what is current today". Its `verifiedOn` field is
`null` in this repository, which obliges an agent to treat every "current release" claim as unknown
and resolve it live before asserting it.

The reason is stated in the file: a marketplace asset outlives the release it was written against,
and a stale pinned version number is worse than no number because it is confidently wrong.

## Limits

- `database-architect`, `migration-engineer` and `optimise-query` assume PostgreSQL. The general
  reasoning transfers; the specific lock behaviour, `EXPLAIN` output and DDL do not.
- `audit-accessibility` runs an automated pass first, and automation provably cannot decide most
  WCAG criteria. The manual checklist is where the real coverage is, and it needs a human or a
  browser session.
- `supply-chain-guardian` depends on an SBOM generator and a vulnerability source being available
  in the environment. It announces their absence rather than guessing.
