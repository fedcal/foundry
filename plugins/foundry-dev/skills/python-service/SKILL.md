---
name: python-service
description: Create or review a Python/FastAPI service end-to-end — project layout and packaging tool, Pydantic settings validated at startup, async SQLAlchemy session wiring with an Alembic baseline, one working vertical-slice route (schema, dependency, service function, error handling), a pytest/httpx test harness, health vs readiness endpoints, and a Dockerfile. Use when starting a new Python service, adding FastAPI to an existing Python codebase, or auditing an existing service against these conventions.
user-invocable: true
argument-hint: "[service-name] [--review]"
agent: foundry-dev:fastapi-engineer
model: sonnet
effort: medium
metadata:
  foundry.vertical: dev
  foundry.io: "requirement.v1 -> review.v1"
license: Apache-2.0
---

# Create or review a Python service

A Python service is not a single `main.py`. It is packaging, settings, a database session
lifecycle, one working vertical slice, an error model, a test harness and a container image
that agree with each other. This skill produces (or audits) all of them in the project's
existing style — it never introduces a new architectural pattern silently; if the required
pattern is missing, it stops and says so.

Run with `--review` against an existing service to audit it against the checklist below
instead of scaffolding a new one; every "create" step becomes a "verify, and file a
`finding.v1` if it disagrees".

## When not to use this

- You are adding a single new endpoint to an already-scaffolded FastAPI service → go straight
  to `fastapi-engineer`, this skill's setup steps do not apply.
- The service has no HTTP surface at all (a worker, a CLI, a batch job) → `python-engineer`
  directly; skip §4 (routes) and §9 (OpenAPI) entirely.
- The database schema itself is undecided → `database-architect` first; this skill assumes a
  schema exists or is being created alongside the first migration, not designed from scratch.
- Auth flow selection (which OAuth2 grant, token lifetime policy) is undecided →
  `identity-engineer` first; this skill wires whatever flow was already decided.

## Step 1 — Detect the project's real stack (never skip)

Run every command in `references/detection-probes.md` before writing anything. It covers:
Python version and packaging tool already in use, whether Pydantic v1 or v2 idioms are
available, whether SQLAlchemy's 2.0 typed-declarative style is available, and whether a router
already exists to copy the shape from. Write the answers down in one short block before
proceeding — they decide every choice below.

If this is a brand-new, empty repository, there is nothing to detect: proceed to Step 2 with
the defaults in `references/project-layout.md`.

## Step 2 — Project layout and packaging tool

New service: apply the `src`-layout skeleton in `references/project-layout.md`. Do not invent
a different tree — a fourth layout style per service is what makes onboarding slow.

Existing service: follow whatever layout and packaging tool (`uv`/Poetry/pip-tools) it already
uses. Introducing a second packaging tool alongside an existing one is a defect, not a choice.

`pyproject.toml` never carries a version number you have not verified. The template in
`references/project-layout.md` lists dependency **names** with no pins; resolve and pin the
actual current versions with the packaging tool's own resolver (`uv add fastapi`,
`poetry add fastapi`, …) rather than typing a number from memory.

## Step 3 — Settings, validated at startup

- One `pydantic-settings` `BaseSettings` (or the project's existing v1 equivalent) reading
  environment variables, instantiated once at import time so a bad value fails the process
  before it accepts a request.
- `.env` is a local-development convenience loaded only outside the production code path
  (guard it behind an `ENVIRONMENT`/`APP_ENV` check, or simply never call `load_dotenv()` in
  the production entry point).
- No `os.environ[...]` read scattered elsewhere in the codebase — every setting flows through
  the one `Settings` object.

## Step 4 — Database session and Alembic baseline

- `create_async_engine` + `async_sessionmaker`, both created once in the app's `lifespan`
  context manager, not at import time and not per request.
- A `yield`-dependency (`get_db_session`) hands out one `AsyncSession` per request and closes
  it in a `finally`. Handlers never construct a session themselves.
- `alembic init` with an async-aware `env.py` (the template's `env.py` must call
  `run_async_migrations`, not the sync template Alembic scaffolds by default — verify this by
  reading the generated `env.py`, do not assume). First migration establishes the baseline
  schema; every later schema change is a new revision, never an edit to an applied one.
- Run `alembic upgrade head` against a real disposable Postgres before the test suite runs —
  see `references/testing-recipes.md` for the Testcontainers pattern. Never substitute SQLite
  here.

## Step 5 — Write the failing test first

If `superpowers` is installed, invoke `superpowers:test-driven-development` and follow it. If
absent: the first thing you write for the template route is a test that fails because the
route does not exist, then you make it pass. Templates for both the slice test and the
integration test are in `references/testing-recipes.md`.

## Step 6 — The template vertical slice

Implement exactly one route end to end, to prove every layer agrees, using
`fastapi-engineer`'s non-negotiables:

1. **Request/response schemas** — separate Pydantic models; the request schema rejects any
   client-supplied `id`/`created_at`/role field.
2. **Router** — thin; maps HTTP to a service-layer call and back, no business conditional.
3. **Dependency chain** — `get_db_session` → `get_repository` → `get_service`, composed with
   `Depends()`, so every layer is replaceable in a test via `app.dependency_overrides`.
4. **Service function** — the actual behaviour; owns the transaction (commit once, roll back
   on exception).
5. **Response mapping** — the service/repository never returns a raw ORM instance to the
   router; the router never returns one to the client.

## Step 7 — Error handling

Register `@app.exception_handler` for: the domain exception(s) the slice can raise, Pydantic's
`RequestValidationError` (FastAPI's default is close but confirm the body shape matches the
rest of the API), and a catch-all for unhandled exceptions that logs the real error and
returns an opaque body with a correlation id — never a stack trace or SQL fragment to the
client. If the project has no error-handling convention yet, this slice establishes one; say
so explicitly, it is an architectural addition.

## Step 8 — Health and readiness

Two endpoints, not one: liveness never touches the database; readiness does (a lightweight
`SELECT 1` through the session dependency). Wire both before the first deploy — a service with
no readiness probe fails open during a rolling restart.

## Step 9 — OpenAPI

Confirm the app boots and the schema generates:

```bash
python3 -c "import json; from app.main import app; json.dump(app.openapi(), open('/tmp/openapi.json', 'w')); print('ok')"
```

Every route in the slice has a `response_model` and a documented entry for each non-2xx status
it returns.

## Step 10 — Dockerfile and container smoke test

- Multi-stage build: a build stage that resolves and installs dependencies with the project's
  packaging tool, a slim runtime stage that copies only the installed environment and the
  application code. Run as a non-root user. `CMD` invokes `uvicorn` (or gunicorn with uvicorn
  workers) with an explicit `--host 0.0.0.0` and the readiness endpoint wired to the
  orchestrator's probe, not the liveness one.
- Smoke test: build, run, hit the liveness and readiness endpoints, hit the template route.
  ```bash
  docker build -t svc-smoke .
  docker run -d --rm -p 8000:8000 --name svc-smoke svc-smoke
  curl -fsS http://localhost:8000/healthz && curl -fsS http://localhost:8000/readyz
  docker stop svc-smoke
  ```

## Step 11 — Verify, then report

If `superpowers` is installed, invoke `superpowers:verification-before-completion`. Otherwise
run every command below and read the output — do not infer.

```bash
pytest
mypy --strict app/ 2>/dev/null || pyright app/ 2>/dev/null
alembic upgrade head
```

Write a `review.v1` artifact to `.foundry/blackboard/<wave>/python-service.json` via
`blackboard_write`, listing anything found but not fixed as a `finding.v1` with a
`failureScenario`. Return ≤ 300 tokens to the caller: the artifact path, what was
scaffolded/reviewed, and the exit-criteria status below.

## Exit criteria

- [ ] `pyproject.toml` has no dependency version typed from memory — every pin came from the
      packaging tool's resolver.
- [ ] Settings fail startup on a missing/invalid environment variable (proven by a test).
- [ ] Alembic baseline migration applies cleanly against a real Postgres.
- [ ] The template slice's request schema rejects a client-supplied `id` (proven by a test).
- [ ] No ORM model type appears in a router return signature.
- [ ] At least one non-2xx path is tested and asserts the error body shape.
- [ ] Liveness endpoint does not touch the database; readiness does.
- [ ] `python3 -c "...app.openapi()..."` succeeds.
- [ ] Docker image builds, runs, and both health endpoints respond 200 in the smoke test.
- [ ] `review.v1` written; caller summary ≤ 300 tokens.

## Deliberately not covered

Business logic beyond the one template slice; auth flow **design** (`identity-engineer`);
adversarial security review (`appsec-reviewer`); PostgreSQL schema/index design beyond the
Alembic baseline (`database-architect`); orchestration manifests and CI pipelines (foundry-ops);
data pipelines and ML serving.

## Degradation

No Docker → skip the container smoke test and the Postgres-backed integration test; mark both
**unverified**, do not substitute SQLite for the latter. No `superpowers` → follow the reduced
rules stated inline at Steps 5 and 11. No `foundry` MCP server → write the artifact file
directly and note it was not schema-validated. Existing service with no discoverable packaging
tool (no lockfile, no `[build-system]`) → stop and report before Step 2; do not silently pick
one.
