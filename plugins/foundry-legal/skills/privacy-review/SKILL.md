---
name: privacy-review
description: Code-level data protection review. Traces where personal data enters the system, how it flows, where it is stored and replicated, where it is logged, and whether it is actually deleted — then checks that retention, erasure and subject-rights endpoints exist as mechanisms rather than as documentation. Use before launching a feature that touches personal data, when writing or updating a DPIA, when a data subject request cannot be fulfilled, or when preparing a record of processing activities. Not legal advice.
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
argument-hint: "[path] [--flow entry|storage|logs|deletion|rights|transfers] [--store-inventory-only]"
context: fork
agent: foundry-legal:privacy-engineer
model: opus
effort: high
metadata:
  foundry.vertical: compliance
  foundry.io: "codebase -> store inventory + data flow map + compliance-check.v1[]"
license: Apache-2.0
---

# Privacy review

> **Automated technical assessment. Not legal advice.** This skill reads code. It cannot tell you
> whether a lawful basis is valid, whether a retention period is defensible, or whether a transfer
> mechanism is adequate. Have a qualified data protection officer or lawyer confirm anything
> consequential.

The output that matters is a single table: **every store that holds personal data, what is in it,
how long it stays, and whether the erasure path reaches it.** Everything else in this skill exists
to make that table true.

## When to use this

- A feature that touches personal data is about to ship.
- A DPIA or a record of processing activities needs facts rather than assumptions.
- A subject access or erasure request could not be completed, or took a person days of manual work.
- A vendor was added, a region was added, or an AI feature started receiving user content.
- Before a customer's privacy due diligence.

## When NOT to use this

- You need a privacy notice drafted for publication. This produces the facts a notice must be
  accurate about; a professional writes the notice.
- You need to know whether your legal basis holds. That is legal analysis.
- You are looking for security vulnerabilities. Use the security reviewer; this skill reports
  leakage and missing authorisation as findings and hands them over.
- The system provably holds no personal data — but verify that claim first, because free-text fields
  and telemetry usually falsify it.

## Procedure

### Phase 1 — Entry points

Start at the boundary, never at the data model: the model shows only what someone remembered to
model. Enumerate request bodies and query parameters, forms and client-side storage, third-party
callbacks, file uploads (EXIF, faces, free text inside documents), free-text fields, telemetry and
analytics payloads, error reporter context, inferred and derived data, and batch or CRM imports.

For each: field, is it personal data, could it reach a special category, what purpose it serves,
where it goes next. **A field with no identified purpose is a minimisation finding.**

Detail and search patterns: `references/data-flow-tracing.md`.

### Phase 2 — Purpose to lawful basis

Build `purpose → categories → basis → where the basis is evidenced`. Then run the six checks in
`references/lawful-basis-checks.md`: consent recorded, consent gating enforced in code, withdrawal
symmetry, legitimate interests assessment present, basis laundering in git history, contract basis
stretched over analytics or training.

### Phase 3 — Store inventory

The deliverable. Enumerate exhaustively; the last rows are where requests quietly fail:

primary database · read replicas · caches · object storage · search indexes · queues and event
streams · warehouse and analytics · application and access logs · error reports · session replay ·
CRM, support desk, billing · email and notification providers · backups and snapshots · client-side
storage · LLM providers and prompt logs · third-party SDK telemetry.

| Store | Personal data held | How it arrives | Who can read | Retention (config ref) | In erasure path |
|---|---|---|---|---|---|

`--store-inventory-only` stops here. That is a legitimate cheap run; it is the input to a DPIA and to
a record of processing activities.

### Phase 4 — Retention and deletion

Per store, answer with a file path or `undetermined`: where the period is configured, whether the
mechanism runs (schedule definition **and** evidence of execution), hard or soft delete, cascade
behaviour for denormalised copies and audit tables, and the stated position on backups.

A retention policy in `docs/` with no mechanism is `undetermined`, never `compliant`. See
`references/retention-mechanisms.md` for what counts as a mechanism per storage technology.

### Phase 5 — Subject rights

Trace access, erasure, portability, rectification, restriction and objection against the Phase 3
inventory. Report coverage as an explicit fraction per right: *stores covered / stores in inventory*.

Check identity verification on the request path. An access endpoint that returns anyone's data to
whoever asks is a `critical` finding — a breach with a compliance label on it.

Check the automated-decision path: is there a human with authority to override, an explanation, and a
recorded contest route?

### Phase 6 — Logging leakage

Read the logging boundary, not individual statements. Is redaction allow-list (safe) or deny-list
(fails open)? Search for whole-object logging, unscrubbed error reporter context, identifiers and
tokens in URLs, and LLM prompt logs. Check log retention and who can read production logs.

Then prove it: grep a sample of real log output for email patterns, bearer tokens, long digit runs
and national identifier formats. Record the command and result as `command` evidence. A leakage
claim without an executed grep is an opinion.

### Phase 7 — Transfers and vendors

Enumerate every third party from **configuration**: CSP `connect-src`, SDK imports, webhook targets,
SMTP relays, CDN and analytics hostnames, LLM endpoints, `.env.example`. Record data, basis,
contract, hosting region. Diff against the published subprocessor list — the diff is a finding, both
contractual and about transparency. Include support and engineering access, and the countries it
comes from.

### Phase 8 — DPIA triggers

Flag, never decide. List each trigger observed with its evidence and leave the DPIA control
`undetermined` unless a dated assessment predates the launch. Trigger list in
`references/lawful-basis-checks.md`.

## Output

```
.foundry/blackboard/<wave>/privacy-engineer.json    compliance-check.v1[] + finding.v1[]
.foundry/scratch/<session>/store-inventory.md       the Phase 3 table
.foundry/scratch/<session>/data-flow.md             entry points and flows
```

To the caller: artifact path, `stores holding personal data / stores in the erasure path`, the three
worst gaps, the disclaimer.

## Exit criteria

- [ ] The store inventory lists every store with retention and erasure coverage. No row says "various".
- [ ] Every purpose has a basis, or an `undetermined` naming who must decide.
- [ ] Coverage stated as a fraction per right, for access, erasure and portability.
- [ ] Every retention claim references a mechanism, or is `undetermined`.
- [ ] The log-leak grep was executed; command and result recorded.
- [ ] Deployed vendor list diffed against the documented one; diff included.
- [ ] Every DPIA trigger observed is listed; none silently resolved.
- [ ] No `compliant` verdict rests on documentation alone.
- [ ] Artifacts pass `mcp__plugin_foundry-core_foundry__contract_validate`.

## Degradation

| Missing | Behaviour |
|---|---|
| Database access | work from migrations and ORM models; mark row-level claims `undetermined` |
| Production log sample | state that leakage could not be empirically verified; do not assert redaction works |
| Vendor contracts | assess technical flow only; contract adequacy stays `undetermined` |
| `foundry` MCP server | write artifacts directly and validate against `foundry-core/schemas/` |
| `superpowers` | run exit criteria manually instead of `verification-before-completion` |

## Deliberately not covered

Validity of a lawful basis · drafting notices, DPIAs or DPAs · setting retention periods ·
adequacy of a transfer mechanism · whether claimed anonymisation is legally anonymisation (always
`undetermined` here) · security control design · employment law aspects of worker monitoring ·
any assessment requiring a legal threshold.

## References

- `references/data-flow-tracing.md` — entry point taxonomy and per-language search patterns
- `references/lawful-basis-checks.md` — the six basis checks and the DPIA trigger list
- `references/retention-mechanisms.md` — what counts as a retention mechanism per technology
