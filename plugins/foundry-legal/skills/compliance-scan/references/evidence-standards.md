# Evidence standards and the status ladder

> **Automated technical assessment. Not legal advice.**

This file defines what each `compliance-check.v1.status` value costs in evidence. It exists because
the failure mode of every automated compliance tool is the same: a plausible-looking `compliant` that
nobody can defend.

## The one rule

**Absence of evidence is never evidence of compliance.** If you did not find the mechanism, the
status is `undetermined`. Not `non-compliant` (you have not proved a contradiction) and certainly not
`compliant`.

## The ladder

| Status | Requires | Evidence kinds accepted |
|---|---|---|
| `compliant` | You read an implementation, or ran a command whose output demonstrates the requirement is met, for **every element** of the requirement | ≥ 1 of `file`, `command`, `measurement`. `doc` and `url` may accompany but never suffice. |
| `partial` | Some elements evidenced, at least one absent or contradicted. `gap` names precisely which. | as above, plus the gap statement |
| `non-compliant` | You found an artefact that **contradicts** the requirement | the contradicting artefact, cited |
| `not-applicable` | The `appliesWhen` predicate is decidably false | `standard` evidence naming the deciding profile fact |
| `undetermined` | Everything else | whatever you have, plus the question that would resolve it |

`undetermined` is the default. Every other status is an upgrade you must pay for.

## Decomposing "every element"

Requirements are compound. `compliant` requires all elements, so decompose before you assess.

Example — a retention requirement decomposes into:

1. a period is defined per data category
2. the period is configured in a mechanism
3. the mechanism executes on a schedule
4. execution is observable
5. it reaches every store holding the category
6. the position on backups is stated

Evidence for (1) and (2) only is `partial`, with `gap: "no evidence the lifecycle rule executes;
no coverage of the search index or the warehouse"`. It is not `compliant`.

Write the decomposition into `rationale`. A reader must be able to see which elements you checked.

## Evidence kinds

| Kind | Use for | `ref` format |
|---|---|---|
| `file` | source, config, IaC, schema, a document | `path/to/file.ts:142` — always with a line where one exists |
| `command` | a command you actually ran | the exact command, with the relevant output in `excerpt` |
| `url` | a public page whose content is the evidence | full URL plus the date you read it |
| `standard` | a clause of a standard, or a recorded profile fact | the clause id or the fact name |
| `measurement` | a number with a unit and a date | `"p99 export latency 4.2s, measured 2026-08-27"` |

`excerpt` is capped at 600 characters by the schema. Quote the deciding lines, not the file.

## Three traps that manufacture false `compliant`

### 1. Documentation-only evidence

A policy is a claim about intent. This engine assesses implementation.

| Control area | Document (not evidence) | Mechanism (evidence) |
|---|---|---|
| Retention | a retention schedule in `docs/` | a lifecycle rule, TTL, cron job, partition drop |
| Erasure | "we delete on request" in the privacy notice | the delete handler, plus the propagation to every store |
| Access control | an access control policy | the authorisation predicate in the route handler |
| Incident response | an IR plan | the plan **plus** a dated exercise record |
| Consent | a cookie policy | the consent read that gates SDK initialisation |
| Encryption | a security page claiming AES-256 | the KMS configuration and the TLS policy |
| Training | a training policy | completion records with dates |

Where only the document exists, the status is `undetermined` and the `gap` says "documented, not
evidenced in the running system".

### 2. The happy path

Checking the main flow and generalising. Always ask "and everywhere else?":

- Deletion from the primary database → what about caches, search indexes, event streams, the
  warehouse, backups, processors, client local storage?
- Authorisation on the REST route → what about the GraphQL resolver, the gRPC method, the admin
  panel, the batch job, the CSV export?
- Redaction in the application logger → what about the error reporter, the APM agent, the access log,
  the LLM prompt log?
- Consent gating on the marketing tag → what about the session replay SDK and the feature-flag client?

If you did not check the "everywhere else", the honest verdict is `partial`.

### 3. Test-passes-therefore-compliant

A green test proves the test passed. Read the assertion. Common patterns that prove nothing:

- a test asserting HTTP 200 from a delete endpoint without asserting the record is gone
- a test with a mocked store, which asserts the mock was called
- a snapshot test of a consent banner, which asserts the markup did not change
- an accessibility test running only the automated rule set, which covers a minority of criteria

Cite the assertion line, not the test name.

## Confidence and adversarial checking

Before writing any `compliant`, run one adversarial pass: *what would have to be true for this
verdict to be wrong?* Then spend one tool call trying to make it wrong. If you find nothing, keep
`compliant` and record the check. If the check is too expensive, downgrade to `partial` and say why.

For a `critical`-severity control, that adversarial pass is mandatory, not optional.

## Remediation quality

`remediation` is an engineering instruction. It must name:

1. the file or component to change,
2. the mechanism to add,
3. how the fix would then be **evidenced** on a subsequent scan.

| Bad | Good |
|---|---|
| "Implement GDPR compliance" | "Add an S3 lifecycle rule on `events/` expiring at 90 days to match `docs/privacy/retention.md`, and assert it in `infra/test/lifecycle.test.ts`" |
| "Improve logging" | "Route all logger calls through `lib/log/redact.ts` with an allow-list of fields, and add a CI grep asserting no `logger.*(req.body)` call sites remain" |
| "Get consent" | "Move the `analytics.init()` call in `app/layout.tsx:31` behind the `consent.analytics` read, and add a Playwright test asserting no request to the analytics host on a clean profile" |

For an `undetermined` caused by an `ask:` hint, remediation is the question and who must answer it.

## Dates

`assessedOn` is obtained with `date -I` (or
`powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"`). A date typed from memory invalidates
the artifact, because the whole value of a compliance record is knowing when it was true.
