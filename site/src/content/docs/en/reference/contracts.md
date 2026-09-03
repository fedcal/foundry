---
title: Contracts
description: The ten versioned JSON Schemas agents use to hand work to each other, with required fields and a valid example for each.
sidebar:
  order: 4
---

Agents do not hand each other prose. They hand each other JSON that validates against a schema, and
a `PostToolUse` hook sends anything that does not validate straight back to the agent that wrote
it, with the list of violations.

Schemas live in `plugins/foundry-core/schemas/*.schema.json`, are JSON Schema 2020-12, and are
versioned by filename. **Breaking a schema means adding `*.v2`, never editing `*.v1`.**

Two fields are required on every artifact:

| Field | Meaning |
|---|---|
| `schema` | The contract id. A `const`, so it must match the file exactly, e.g. `"finding.v1"` |
| `producedBy` | The name of the agent that produced the artifact |

`blackboard_write` sets both for you from its `schema` and `agent` arguments. Every schema also
sets `additionalProperties: false`, so an unexpected field is a validation error rather than a
silently ignored one.

Validate anything at any time:

```bash
foundry validate finding.v1 .foundry/blackboard/audit/appsec-reviewer.json
```

## The ten contracts

| Contract | Purpose | Typical producer |
|---|---|---|
| `fact.v1` | One atomic durable project fact, tier T1 | `memory-curator` |
| `finding.v1` | A single defect, gap or risk found by an audit, review or research agent | audit and review agents |
| `review.v1` | The outcome of a review pass, wrapping findings with a verdict | review agents |
| `adr.v1` | A decision, its drivers, the options weighed and the consequences accepted | architecture agents |
| `plan.v1` | A wave-based plan with explicit gates, produced before implementation | planning agents |
| `requirement.v1` | A traceable requirement with acceptance criteria as verifiable behaviour | `requirements-analyst`, `domain-modeler` |
| `risk.v1` | A risk with quantified exposure and an owned mitigation | `risk-manager`, `security-architect`, `iac-engineer` |
| `estimate.v1` | A three-point estimate with assumptions made explicit | economics agents |
| `compliance-check.v1` | One control assessed against one jurisdiction pack | legal agents |
| `handoff.v1` | What one wave passes to the next; enforces the context firewall | every wave boundary |

---

## `fact.v1`

One atomic, durable project fact stored in tier T1. Written through the `memory_write` MCP tool,
never by hand.

**Required:** `schema`, `producedBy`, `id`, `type`, `scope`, `title`, `body`, `confidence`,
`source`, `created`.

`id` must match `^fact-[0-9]{4,}$`. `title` is capped at 80 characters and `body` at 900.
`type` is one of `decision`, `constraint`, `convention`, `domain`, `risk`, `metric`, `glossary`.
Optional: `tags`, `expires` (date or `null`), `supersedes` (string or `null`), `links`.

```json
{
  "schema": "fact.v1",
  "producedBy": "memory-curator",
  "id": "fact-0004",
  "type": "decision",
  "scope": "project",
  "title": "Database migrations use Flyway, not Liquibase",
  "body": "**Why:** the team already reads plain SQL and the XML changelog format was slowing reviews.\n**How to apply:** new migrations go in db/migrations as V<n>__<slug>.sql; never edit an applied file.",
  "tags": ["persistence", "migrations"],
  "confidence": "high",
  "source": "adr-0007",
  "created": "2026-08-14",
  "expires": null,
  "supersedes": null,
  "links": ["fact-0009"]
}
```

## `finding.v1`

A single defect, gap or risk. `failureScenario` is required because a finding without one is
speculation.

**Required:** `schema`, `producedBy`, `id`, `severity`, `title`, `summary`, `failureScenario`,
`confidence`.

`severity` is one of `critical`, `high`, `medium`, `low`, `info`. `title` is capped at 120
characters, `summary` at 600. Optional: `category`, `location` (`file`, `line`, `component`),
`standard`, `remediation`, `effortHours`, `verdict` (`confirmed` \| `plausible` \| `refuted`),
`evidence`.

Each `evidence` entry requires `kind` — one of `file`, `command`, `url`, `standard`,
`measurement` — and `ref`, with an optional `excerpt` capped at 600 characters.

```json
{
  "schema": "finding.v1",
  "producedBy": "appsec-reviewer",
  "id": "F-014",
  "severity": "high",
  "category": "authentication",
  "title": "No rate limiting or lockout on the login endpoint",
  "summary": "POST /api/login accepts unlimited attempts per account and per source address. Neither the controller nor the gateway applies a limit.",
  "failureScenario": "An attacker sends 10k requests/min to /api/login with a common-password list against a known address; no lockout, no delay and no alert occurs.",
  "location": { "file": "src/main/java/app/auth/LoginController.java", "line": 42 },
  "standard": "OWASP ASVS V2.2.1",
  "remediation": "Apply a per-account and per-IP limiter with exponential backoff, and emit an auth.failure metric consumed by the existing alert rule.",
  "effortHours": 6,
  "confidence": "high",
  "verdict": "confirmed",
  "evidence": [
    { "kind": "file", "ref": "src/main/java/app/auth/LoginController.java:42" },
    { "kind": "command", "ref": "grep -r RateLimiter src/main/java", "excerpt": "no matches" }
  ]
}
```

## `review.v1`

The outcome of a review pass, with findings ranked by severity. `findings` items are full
`finding.v1` objects by reference, so everything above applies to each of them.

**Required:** `schema`, `producedBy`, `target`, `dimension`, `verdict`, `findings`, `summary`.

`verdict` is one of `pass`, `pass-with-comments`, `block`. `summary` is capped at 900 characters.
Optional: `metrics`, a free-form object used by agents such as `persistence-engineer` to carry
before/after numbers.

```json
{
  "schema": "review.v1",
  "producedBy": "appsec-reviewer",
  "target": "src/main/java/app/auth",
  "dimension": "application-security",
  "verdict": "block",
  "findings": [
    {
      "schema": "finding.v1",
      "producedBy": "appsec-reviewer",
      "id": "F-014",
      "severity": "high",
      "title": "No rate limiting or lockout on the login endpoint",
      "summary": "POST /api/login accepts unlimited attempts per account and per source address.",
      "failureScenario": "An attacker sends 10k requests/min to /api/login; no lockout occurs.",
      "confidence": "high"
    }
  ],
  "metrics": { "filesReviewed": 23, "asvsControlsChecked": 41 },
  "summary": "One high finding blocks the release: the login endpoint has no throttle. Everything else in the auth package passed."
}
```

## `adr.v1`

A decision with the options weighed. `options` requires **at least two** entries, each with a name,
pros and cons — an ADR presenting one option is a rationalisation, not a decision.

**Required:** `schema`, `producedBy`, `number`, `title`, `status`, `date`, `context`, `options`,
`decision`.

`status` is one of `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`. `number` is an
integer of at least 1. Optional: `deciders`, `drivers`, `consequences` (`positive`, `negative`,
`risks`), `supersedes` (integer or `null`), and `cost` on each option.

```json
{
  "schema": "adr.v1",
  "producedBy": "database-architect",
  "number": 7,
  "title": "Use Flyway for database migrations",
  "status": "accepted",
  "date": "2026-08-14",
  "deciders": ["platform-team"],
  "context": "Migrations were applied by hand against staging and drifted from production twice in six months.",
  "drivers": ["Reviewability by the whole team", "No new build-time dependency", "Works with the existing Spring Boot starter"],
  "options": [
    {
      "name": "Flyway",
      "pros": ["Plain SQL the team already reads", "First-class Spring Boot integration"],
      "cons": ["No native rollback; contract phase must be a separate migration"],
      "cost": "half a day to wire, no licence"
    },
    {
      "name": "Liquibase",
      "pros": ["Database-agnostic changelogs", "Built-in rollback statements"],
      "cons": ["XML/YAML changelogs slowed reviews in the previous project"],
      "cost": "one day to wire, no licence"
    }
  ],
  "decision": "Adopt Flyway with V<n>__<slug>.sql files under db/migrations, applied on startup in non-production and by the pipeline in production.",
  "consequences": {
    "positive": ["Migrations are reviewed as SQL in the same PR as the code"],
    "negative": ["Rollback needs an explicit contract migration"],
    "risks": ["A long-running migration can block startup; the pipeline applies them out-of-band in production"]
  },
  "supersedes": null
}
```

## `plan.v1`

A wave-based plan with machine-checkable gates. At least one wave; each wave needs an `id`, at
least one task, and a `gate`. Each task needs an `id`, a `description` and an `agent`.

**Required:** `schema`, `producedBy`, `goal`, `waves`.

Optional per task: `dependsOn`, `estimateHours`, `isolation` (`none` \| `worktree`).
Optional at the top level: `rollback`, `outOfScope`.

```json
{
  "schema": "plan.v1",
  "producedBy": "roadmap-planner",
  "goal": "Ship self-service password reset behind a feature flag",
  "waves": [
    {
      "id": "analysis",
      "tasks": [
        { "id": "a1", "description": "Write requirements with acceptance criteria", "agent": "requirements-analyst", "estimateHours": 4 },
        { "id": "a2", "description": "Threat model the reset token flow", "agent": "security-architect", "dependsOn": ["a1"], "estimateHours": 6 }
      ],
      "gate": { "requirements_have_acceptance_criteria": true, "every_threat_has_a_mitigation_and_a_test": true }
    },
    {
      "id": "implementation",
      "tasks": [
        { "id": "i1", "description": "Reset endpoint and token store", "agent": "spring-engineer", "isolation": "worktree", "estimateHours": 16 },
        { "id": "i2", "description": "Reset request and confirm screens", "agent": "angular-engineer", "isolation": "worktree", "estimateHours": 12 }
      ],
      "gate": { "project_test_command_passes": true, "no_stubbed_acceptance_criteria": true }
    }
  ],
  "rollback": "Disable the password-reset flag; the endpoint returns 404 and the routes are not registered.",
  "outOfScope": ["Account recovery by support agents", "SMS as a second factor"]
}
```

## `requirement.v1`

A traceable requirement. `acceptanceCriteria` requires at least one Given/When/Then triple, all
three parts mandatory — a requirement with no testable criterion cannot be written.

**Required:** `schema`, `producedBy`, `id`, `kind`, `title`, `acceptanceCriteria`, `priority`.

`kind` is one of `functional`, `non-functional`, `constraint`, `regulatory`. `priority` is MoSCoW:
`must`, `should`, `could`, `wont`. Optional: `userStory`, `tracesTo` (ADR numbers, test ids,
compliance controls), `owner`.

```json
{
  "schema": "requirement.v1",
  "producedBy": "requirements-analyst",
  "id": "REQ-021",
  "kind": "functional",
  "title": "A user can reset their password from the sign-in screen",
  "userStory": "As a returning user who has forgotten my password, I want to set a new one from the sign-in screen so that I do not have to contact support.",
  "acceptanceCriteria": [
    {
      "given": "an account exists for the submitted address",
      "when": "the user submits the reset form",
      "then": "a single-use token valid for 30 minutes is emailed and the response is identical to the unknown-address case"
    },
    {
      "given": "a reset token older than 30 minutes",
      "when": "the user submits a new password with it",
      "then": "the request is rejected with a 400 and the token is deleted"
    }
  ],
  "priority": "must",
  "tracesTo": ["adr-0011", "e2e/password-reset.spec.ts"],
  "owner": "identity-team"
}
```

## `risk.v1`

A risk with quantified exposure and an owned mitigation. An unowned risk cannot be written.

**Required:** `schema`, `producedBy`, `id`, `title`, `category`, `probability`, `impactEur`,
`mitigation`, `owner`, `status`.

`probability` is a number between 0 and 1. `category` is one of `technical`, `schedule`, `cost`,
`security`, `compliance`, `operational`, `vendor`, `people`. `status` is one of `open`,
`mitigating`, `accepted`, `closed`. Optional: `exposureEur` (probability times impact),
`detection`, `contingency`, `reviewBy`.

```json
{
  "schema": "risk.v1",
  "producedBy": "risk-manager",
  "id": "R-006",
  "title": "The single Postgres instance has no tested restore path",
  "category": "operational",
  "probability": 0.15,
  "impactEur": 120000,
  "exposureEur": 18000,
  "detection": "Nightly backup job reports success; no restore has ever been attempted.",
  "mitigation": "Restore the latest backup into a scratch instance monthly and record the wall-clock RTO in the runbook.",
  "contingency": "Rebuild from the read replica, accepting the replication lag as data loss.",
  "owner": "platform-team",
  "reviewBy": "2026-10-01",
  "status": "mitigating"
}
```

## `estimate.v1`

A three-point estimate. At least one item, each with `optimistic`, `likely` and `pessimistic`, and
at least one assumption — an estimate with no stated assumptions is rejected.

**Required:** `schema`, `producedBy`, `scope`, `items`, `assumptions`.

Optional: `currency` (defaults to `EUR`), `expected` (PERT, `(o + 4m + p) / 6`),
`confidenceInterval` (`p50`, `p80`, `p95`), `excluded`. Each item may declare a `role` and a `unit`
of `hours`, `days` or `eur`.

```json
{
  "schema": "estimate.v1",
  "producedBy": "cost-engineer",
  "scope": "Self-service password reset, end to end",
  "currency": "EUR",
  "items": [
    { "label": "Backend endpoint and token store", "role": "backend", "optimistic": 12, "likely": 16, "pessimistic": 30, "unit": "hours" },
    { "label": "Frontend screens and states", "role": "frontend", "optimistic": 8, "likely": 12, "pessimistic": 22, "unit": "hours" },
    { "label": "E2E coverage of both journeys", "role": "qa", "optimistic": 4, "likely": 6, "pessimistic": 12, "unit": "hours" }
  ],
  "expected": 35.7,
  "confidenceInterval": { "p50": 34, "p80": 44, "p95": 56 },
  "assumptions": [
    "The existing transactional email provider is used; no new vendor is onboarded.",
    "Design is reused from the sign-in screens; no new design work is priced."
  ],
  "excluded": ["Support tooling for agent-initiated resets", "Localisation beyond English and Italian"]
}
```

## `compliance-check.v1`

One control assessed against one jurisdiction pack. The `disclaimer` field is a `const`: its only
permitted value is `"Automated technical assessment. Not legal advice."`, which makes the
disclaimer structurally unremovable.

**Required:** `schema`, `producedBy`, `controlId`, `jurisdiction`, `instrument`, `requirement`,
`status`, `rationale`, `assessedOn`, `disclaimer`.

`status` is one of `compliant`, `partial`, `non-compliant`, `not-applicable`, `undetermined`.
Optional: `gap`, `remediation`, `evidence` (same shape as in `finding.v1`).

```json
{
  "schema": "compliance-check.v1",
  "producedBy": "privacy-engineer",
  "controlId": "eu-gdpr-30-ropa",
  "jurisdiction": "eu",
  "instrument": "GDPR (Regulation (EU) 2016/679) Art. 30",
  "requirement": "Maintain a record of processing activities covering purposes, categories of data subjects and data, recipients, transfers, retention and security measures.",
  "status": "partial",
  "rationale": "A register exists at docs/privacy/ropa.md and covers purposes and categories, but lists no recipients and no retention period for the analytics export.",
  "gap": "Recipients and retention are absent for the analytics processing activity.",
  "remediation": "Add the analytics processor, the transfer basis and a stated retention period to the register, and link it to the deletion job.",
  "evidence": [
    { "kind": "file", "ref": "docs/privacy/ropa.md" },
    { "kind": "file", "ref": "src/analytics/export.ts:88", "excerpt": "no retention window applied" }
  ],
  "assessedOn": "2026-08-27",
  "disclaimer": "Automated technical assessment. Not legal advice."
}
```

The `evidence.kind` enum is `file`, `command`, `url`, `standard`, `measurement`.

## `handoff.v1`

What one wave passes to the next. This is the schema that encodes the context firewall: at least
one artifact must be listed, and `summary` is capped at 1200 characters with the note that it is
the **only** narrative crossing into the parent context.

**Required:** `schema`, `producedBy`, `wave`, `status`, `artifacts`, `summary`.

`status` is one of `complete`, `partial`, `blocked`. Each artifact needs a `path` and a `schema`,
optionally `sizeBytes`. Optional at the top level: `openQuestions`, `blockedBy`, `tokensSpent`.

```json
{
  "schema": "handoff.v1",
  "producedBy": "foundry-orchestrator",
  "wave": "analysis",
  "status": "partial",
  "artifacts": [
    { "path": ".foundry/blackboard/analysis/requirements-analyst.json", "schema": "requirement.v1", "sizeBytes": 4821 },
    { "path": ".foundry/blackboard/analysis/security-architect.json", "schema": "risk.v1", "sizeBytes": 3109 }
  ],
  "summary": "Six requirements written, all with acceptance criteria. Threat model produced four risks; three have a mitigation and a test, one does not because the token store has not been chosen yet. Implementation can start on the frontend but not on the token flow.",
  "openQuestions": ["Redis or Postgres for the reset token store?"],
  "blockedBy": ["Decision on the token store"],
  "tokensSpent": 41200
}
```

## Adding a contract

1. Add `<noun>.v<major>.schema.json` to `plugins/foundry-core/schemas/`, JSON Schema 2020-12, with
   `additionalProperties: false` and `schema`/`producedBy` required.
2. Reference it from the agent's `## Output contract` section verbatim.
3. It becomes available to `foundry validate`, `contract_validate`, `blackboard_write` and the
   `PostToolUse` validator automatically — all four enumerate the directory rather than a list.

Never edit a `.v1` file in a way that rejects a previously valid artifact. Add `.v2`.

## Limits

- The validator implements a **subset** of JSON Schema 2020-12 sufficient for these contracts. It
  is not a general-purpose validator; assume support for the keywords actually used here.
- `format: "date"` is documentation, not necessarily enforcement. Do not rely on the schema to
  reject a malformed date.
- `plan.v1.gate` and `review.v1.metrics` are free-form objects. Their contents are conventions
  between agents, not validated structure.
