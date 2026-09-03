---
title: Contracts
description: The ten versioned schemas agents hand each other, how a validation failure reaches the agent that caused it, how to read a JSON-pointer error, and why a published version is never edited.
sidebar:
  order: 4
---

When one agent hands another a paragraph of prose, the receiver has to interpret it, and any
misreading surfaces three steps later as a confident wrong answer. When it hands over JSON that
must satisfy a schema, a misreading is a validation error at the moment it happens, addressed to
the agent that made it.

That is the whole argument. A contract is not bureaucracy; it is the difference between a failure
that is caught in one second by a regular expression and a failure that is caught in an hour by a
human.

## What a contract forces

Take `finding.v1`. It requires `failureScenario`: "Concrete inputs/state leading to the wrong
outcome." An agent that wants to report a problem must state how the problem actually occurs.

```json
{
  "schema": "finding.v1",
  "producedBy": "appsec-reviewer",
  "id": "F-014",
  "severity": "high",
  "title": "No rate limit on the login endpoint",
  "summary": "POST /api/login accepts unlimited attempts per account and per source address.",
  "failureScenario": "An attacker sends 10k requests/min to /api/login with one username and a password list; no lockout, no delay, no CAPTCHA is triggered.",
  "standard": "OWASP ASVS V2.2.1",
  "confidence": "high"
}
```

Remove `failureScenario` and the artifact is rejected. A finding without one is speculation, and
the schema refuses it — with no human in the loop, because the rejection goes straight back to the
agent that wrote it.

Every one of the ten schemas requires `schema` and `producedBy`, and every one sets
`additionalProperties: false`. An unexpected field is an error rather than a silently ignored one,
so a typo in a property name is caught instead of dropped.

## The ten contracts

They live in `plugins/foundry-core/schemas/` as JSON Schema 2020-12, named
`<noun>.v<major>.schema.json`.

| Contract | Carries | Required beyond `schema` and `producedBy` |
|---|---|---|
| `adr.v1` | A decision, its drivers, the options weighed and the consequences accepted | `number`, `title`, `status`, `date`, `context`, `options` (**at least 2**), `decision` |
| `compliance-check.v1` | One control assessed against one jurisdiction pack | `controlId`, `jurisdiction`, `instrument`, `requirement`, `status`, `rationale`, `assessedOn`, `disclaimer` |
| `estimate.v1` | A three-point estimate with its assumptions made explicit | `scope`, `items`, `assumptions` |
| `fact.v1` | One atomic durable project fact, as a blackboard artifact | `id` (`^fact-[0-9]{4,}$`), `type`, `scope`, `title` (≤80), `body` (≤900), `confidence`, `source`, `created` |
| `finding.v1` | A defect, gap or risk found by an audit, review or research agent | `id`, `severity`, `title` (≤120), `summary` (≤600), `failureScenario`, `confidence` |
| `handoff.v1` | What one wave passes to the next | `wave`, `status`, `artifacts` (**at least 1**), `summary` (≤1200 characters) |
| `plan.v1` | A wave-based plan with explicit gates, produced before implementation | `goal`, `waves` |
| `requirement.v1` | A traceable requirement with acceptance criteria as verifiable behaviour | `id`, `kind`, `title`, `acceptanceCriteria`, `priority` |
| `review.v1` | The outcome of a review pass, findings ranked by severity | `target`, `dimension`, `verdict`, `findings`, `summary` |
| `risk.v1` | A risk with quantified exposure and an owned mitigation | `id`, `title`, `category`, `probability`, `impactEur`, `mitigation`, `owner`, `status` |

Two of these encode a rule rather than a shape. `adr.v1` requires at least two options, because a
decision record with one option is a justification written after the fact. `compliance-check.v1`
requires a `disclaimer`, because a compliance output that does not say it is not legal advice is a
liability.

Every agent declares which it consumes and which it produces, verbatim in its body:

```markdown
## Input contract
`plan.v1` — the wave definitions and their gates

## Output contract
`finding.v1` — written to `.foundry/blackboard/audit/appsec-reviewer.json`
```

## How a validation failure reaches the agent

Four paths, three of them automatic.

**1. `blackboard_write` refuses before writing.** This is the normal path. The MCP tool validates
the artifact, and on failure writes nothing and returns an error:

```
Rejected: artifact does not satisfy finding.v1.
- #: missing required property "failureScenario"
- #/severity: must be one of ["critical","high","medium","low","info"]
Fix and call again.
```

The agent has the errors in its own context and corrects itself.

**2. The `validate-contract` hook catches direct writes.** If an agent uses Write or Edit on a
`.json` file under `.foundry/blackboard/`, the `PostToolUse` hook validates it and returns the
violations as additional context:

```
Foundry: appsec-reviewer.json violates finding.v1. Fix it before continuing:
- #/evidence/0: missing required property "ref"
```

This path is **non-blocking**: the file has already been written when the message arrives. It also
catches the two cases before validation — a file that is not parseable JSON, and one with no
`schema` field at all — and reports the list of available contracts when the id is unknown.

**3. `foundry doctor` sweeps everything.** Every artifact under `.foundry/blackboard/` is parsed
and validated; the check fails with a count per file. This is the one that catches artifacts
written before a schema was tightened.

**4. On demand.** From the shell:

```bash
foundry validate finding.v1 .foundry/blackboard/audit/appsec-reviewer.json
```

```
INVALID against finding.v1:
  - #: missing required property "failureScenario"
```

Exit code `1`. In-session, the `contract_validate` tool does the same for either an inline object
or a file path.

## Reading a JSON-pointer error

Every error is `<pointer>: <problem>`. The pointer starts at `#` for the document root and gains one
segment per level: `/<property>` for an object key, `/<index>` for an array position.

| Error | Where to look | What it means |
|---|---|---|
| `#: missing required property "failureScenario"` | The top level of the document | A required field was never set |
| `#: unexpected property "notes"` | The top level | `additionalProperties: false` — the field is not in the schema. Usually a typo or a field that belongs in `summary` |
| `#/severity: must be one of ["critical","high","medium","low","info"]` | The `severity` field | An enum value outside the allowed set. Case matters |
| `#/title: longer than 120 characters` | The `title` field | A `maxLength` breach |
| `#/options: needs at least 2 items` | The `options` array | A `minItems` breach — for `adr.v1` this is the two-options rule |
| `#/evidence/0: missing required property "ref"` | The **first** element of `evidence` | Array indices are zero-based |
| `#/evidence/2/kind: must be one of ["file","command","url","standard","measurement"]` | The `kind` of the third evidence item | Nested objects nest the pointer |
| `#/date: is not a valid date` | The `date` field | `format: date` wants `YYYY-MM-DD` |
| `#/probability: above maximum 1` | The `probability` field | A numeric bound |
| `#/schema: must equal "finding.v1"` | The `schema` field | The artifact declares a different contract from the one it is being checked against |

The validator covers the keyword subset the ten contracts use: `const`, `enum`, `type`, `required`,
`properties`, `additionalProperties: false`, `minLength`/`maxLength`/`pattern`/`format`
(`date`, `date-time`, `uri`), `minimum`/`maximum`, `minItems`/`maxItems`/`items`, and `$ref`
resolved by filename within the same schema directory.

Keywords outside that subset — `oneOf`, `anyOf`, `allOf`, `if`/`then`, `patternProperties`,
`uniqueItems`, `dependentRequired` — are **ignored, not rejected**. A schema that relies on them
will appear to validate anything. Do not author one; every Foundry schema is written against the
supported subset on purpose.

One more consequence of the subset: when a `type` check fails, validation of that subtree stops.
Passing a string where an object is expected produces one error, not a list of every field the
string is missing.

## A published version is never edited

`finding.v1` today means exactly what it meant the day it shipped. Breaking a schema means adding
`finding.v2` beside it, not changing `finding.v1`.

The reason is that validation results are already on disk and in git. Artifacts under
`.foundry/blackboard/` were accepted against a specific version; agent bodies name a specific
version as their output contract; runs are rerun months later and expected to behave the same. Edit
`v1` and every one of those becomes a claim about a document that no longer exists.

The practical rules:

- **Additive and non-breaking** — a new optional property, a widened `maxLength`, a new enum value
  that nothing rejects — may go into `v1`.
- **Anything that could invalidate an existing artifact** — a new `required` field, a narrowed enum,
  a tightened `pattern`, a removed property — is `v2`.
- Version lives in the filename, so `v1` and `v2` coexist in the schema directory and both resolve.
- Migrating means updating each agent's declared output contract to `v2`, in a change you can
  review, and leaving old artifacts valid against `v1`.

`foundry-core` records the family it ships in `plugin.json` as `metadata.foundry.contracts: "v1"`,
so a vertical can tell which contract generation the installed kernel provides.
