---
name: api-reference
description: Generate reference documentation from the source of truth — OpenAPI, protobuf, JSON Schema, Javadoc, TypeDoc, docstrings or CLI help — and keep it verified against the code with CI gates. Use when reference material is hand-written, drifting, incomplete, or when a public API has no machine-readable contract. Enforces the rule that reference is generated and never hand-maintained. Not for tutorials, how-to guides or explanation pages.
user-invocable: true
argument-hint: "[--audit | --generate] [--source openapi|javadoc|typedoc|cli]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: research
  foundry.io: "source of truth -> generated reference + review.v1"
license: Apache-2.0
---

# Generate and verify API reference

Reference documentation has exactly one correctness property: **it says what the code does.**
Prose quality is secondary; a beautifully written wrong signature is worse than a terse right
one, because it is trusted.

Therefore: reference is **generated** from a source of truth and **verified** against the
running system by CI. Hand-maintained reference is a defect with a known expiry date, and this
skill treats it as one.

## When not to use this

- The page teaches, instructs or explains → those are the other three Diátaxis quadrants;
  `technical-writer` owns them.
- The API is private, unstable and has one consumer inside the same repository. Types and tests
  are the reference. Say so and stop.
- The task is designing the API rather than documenting it → that is an API design decision and
  belongs upstream.

## Step 1 — Find the source of truth, and rank it

Only one artifact may be authoritative. Rank candidates with the ladder in
`references/source-of-truth.md`; the short version:

| Rank | Artifact | Why |
|---|---|---|
| 1 | The code itself, plus its type signatures | cannot drift from itself |
| 2 | In-source annotations: Javadoc, TSDoc/JSDoc, docstrings, Rust doc comments, protobuf comments | live next to the code, reviewed with it |
| 3 | A machine-readable contract generated **from** code: OpenAPI emitted by the framework, `.proto` compiled descriptors, JSON Schema exported from the model | one generation step from truth |
| 4 | A hand-maintained contract file (`openapi.yaml` written by a human) | authoritative only if contract tests enforce it against the implementation |
| 5 | Prose in a wiki or markdown table | not a source of truth; it is the thing being replaced |

Two valid architectures, and you must name which one the project uses:

- **Code-first** — annotations produce the contract. Risk: the published contract can describe
  a route that was deleted. Mitigation: regenerate in CI and diff.
- **Spec-first** — the contract produces server stubs and clients. Risk: the implementation
  diverges from the spec it was scaffolded from. Mitigation: contract tests that run the real
  implementation against the spec.

A project with a hand-written `openapi.yaml` and no contract test has **neither**. That is the
most common finding this skill produces, and its severity is `critical`, because every consumer
is building against a document nobody checks.

## Step 2 — Measure coverage before generating

```bash
# HTTP surface actually served vs. documented
grep -rnoE '@(Get|Post|Put|Patch|Delete)Mapping|@(GET|POST|PUT|PATCH|DELETE)\b' src/ | wc -l
grep -rnoE 'app\.(get|post|put|patch|delete)\(' src/ | wc -l
grep -cE '^\s{2}/' openapi.yaml 2>/dev/null            # paths declared

# exported symbols vs. documented symbols (TypeScript)
grep -rnoE '^export (class|function|const|interface|type|enum) [A-Za-z0-9_]+' src/ | wc -l
grep -rc '/\*\*' src/ --include='*.ts' | awk -F: '{s+=$2} END {print s" doc comments"}'

# CLI surface
<binary> --help | grep -cE '^\s+-'
```

Report four numbers and their ratios: public surface, documented surface, generated surface,
verified surface. "Verified" means an automated check compares the documentation to real
behaviour — it is almost always the smallest number and the one worth improving first.

## Step 3 — Generate into a gitignored directory

Non-negotiable mechanics:

1. Generation writes to a **gitignored** output directory. Committed generated output invites
   hand edits, and a hand edit to generated output is silently destroyed at the next build,
   which teaches contributors that the docs pipeline is hostile.
2. If the site build requires committed output, commit it but add the drift gate from step 4 and
   a header banner in every generated file:
   `<!-- GENERATED FROM <source> BY <command>. DO NOT EDIT. -->`
3. The generation command is a single documented command, runnable locally with the same result
   as in CI. Pin the generator version in the project's lockfile.
4. Generation is deterministic: no timestamps, no absolute paths, no random ordering in the
   output. Non-determinism makes the drift gate useless because everything always differs.

## Step 4 — Wire the drift gates

Three gates, described in full in `references/drift-gates.md`.

**Gate A — Regeneration diff (blocking).** Regenerate, diff against committed output, fail on
any difference. This catches code changes that were not reflected in docs. The failure message
must print the exact command that fixes it.

**Gate B — Contract conformance (blocking).** Run the real implementation against the contract:
validate live responses against the declared schemas in the integration test suite, and drive
the API from the contract with property-based or fuzz-style contract testing where the ecosystem
offers it. This catches a spec that describes a system nobody built.

**Gate C — Breaking-change detection (blocking on release).** Diff the contract against the
previous released version and classify changes as breaking or additive. A removed field, a
narrowed type, a new required parameter or a changed status code is breaking and requires a
major version and a migration note. Automating this is what makes a versioning policy real
rather than aspirational.

## Step 5 — Fill the fields generation cannot invent

A generator emits structure. These fields must be written into the source annotations — never
into the generated output:

| Field | Rule |
|---|---|
| Summary | one line, what the operation does, imperative |
| Parameter description | what it means and what constrains it, not a restatement of its name |
| Required vs. optional | must match the implementation, not the intention |
| Default values | read from the code, never remembered |
| Error responses | **every** status the endpoint can return, with the error body schema and what causes it |
| Authentication | which scheme and which scope or permission |
| Rate limits and quotas | if enforced, the actual limit and the response when exceeded |
| Idempotency | whether a retry is safe, and how idempotency keys behave |
| Pagination | the mechanism, the limits, and what a stable ordering guarantees |
| Deprecation | machine-readable deprecation marker, the replacement, and the removal version — never "soon" |
| Example request/response | captured from a real call, with secrets redacted |

The error-response row is the one that is always missing, and it is the row consumers need
most: a client is written against the failure modes, not the happy path.

Write descriptions in the code, review them in code review, and let them flow to the docs. A
docs-only edit is an edit that will be lost.

## Step 6 — Verify examples against real responses

Every example in the reference is captured from a real call against the version being
documented, then normalised:

- Replace volatile values — ids, timestamps, durations, tokens — via a documented substitution
  list, not by hand-editing, so re-capture is repeatable.
- Redact secrets and real identifiers, including in error bodies. State that redaction occurred.
- Include at least one **error** example per endpoint group, with its real body.
- Re-capture on every release, in CI, and diff. A stale example is a support ticket with a delay
  fuse.

Never write an example by hand from the schema. A schema-derived example is a guess with
syntax highlighting, and it will be wrong about exactly the fields that matter.

## Step 7 — Publish with the code

- Reference ships from the same commit as the release it describes. Documentation released
  separately is documentation that is wrong at every release.
- One reference set per supported version, with a version selector and a canonical link tag
  pointing at the current version.
- The contract file itself is published as a downloadable artifact at a stable URL per version —
  consumers generate clients from it, and a contract that is only viewable in a rendered page is
  half a deliverable.
- Deprecated symbols stay visible, marked, with their removal version and replacement. Deleting
  a deprecated symbol from the docs before removing it from the code breaks the people who are
  trying to migrate.

## Exit criteria

- [ ] Exactly one source of truth named and ranked; the architecture is declared as code-first
      or spec-first.
- [ ] Coverage reported as four numbers: public, documented, generated, verified.
- [ ] 100% of reference content is generated; every hand-maintained reference page is a
      `finding.v1` of severity `high` or above.
- [ ] Generation is a single documented command, deterministic, generator pinned.
- [ ] Gate A (regeneration diff) present and blocking; its failure message prints the fix command.
- [ ] Gate B (contract conformance) present and blocking; it exercises the real implementation.
- [ ] Gate C (breaking-change detection) present and blocking on release.
- [ ] Every operation documents **every** status code it can return, with the error schema.
- [ ] Every example captured from a real call, normalised by a documented substitution list, and
      re-captured in CI.
- [ ] ≥ 1 error example per endpoint group.
- [ ] Deprecations carry a machine-readable marker, a replacement and a removal version.
- [ ] The contract file is published per version at a stable URL.
- [ ] `review.v1` emitted with every unresolved finding; validated via
      `mcp__plugin_foundry-core_foundry__contract_validate`.

## Interop and degradation

- Structure, navigation, versioning policy and ownership: `docs-architect`.
- Narrative pages that link into the reference: `technical-writer`.
- Choosing a generator or a contract-testing tool when it is contested: `tech-scout`, with an
  `adr.v1`. Do not choose on familiarity.
- A claimed behaviour you cannot confirm from code or from a real call: `evidence-verifier`
  rather than a hedged sentence.
- If `superpowers` is installed, invoke `superpowers:test-driven-development` when adding
  contract tests — the tests are the gate, and writing them after the fact reproduces the
  drift you are removing. If it is absent, write the failing conformance test first anyway and
  record that the discipline was unassisted.
- If no generator exists for the language or the ecosystem, do **not** fall back to
  hand-writing reference. Fall back to publishing the type definitions or the `--help` output
  verbatim as generated artifacts, and record the gap as a finding with a remediation.
- If the `foundry` MCP server is unavailable, keep the audit in `.foundry/scratch/<session>/`
  and report the blocker.

## Deliberately not covered

- API design: resource modelling, naming, versioning strategy, pagination design. Documenting a
  bad API faithfully is this skill's job; fixing it is not.
- Tutorials, how-to guides and explanation pages.
- SDK and client-library authoring, beyond publishing the contract they are generated from.
- Interactive API consoles, sandbox environments and key management — those are product
  surfaces.
- Performance characteristics and SLAs, unless they are already declared in the contract.
- Authentication implementation. It documents which scheme applies; it does not build it.

## References

- `references/source-of-truth.md` — the ladder, code-first vs. spec-first, and how to pick when
  a project has three competing artifacts.
- `references/drift-gates.md` — gates A, B and C with wiring, failure messages and the
  breaking-change classification table.
