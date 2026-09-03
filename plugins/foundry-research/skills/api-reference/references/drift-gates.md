# Drift gates A, B and C

Three gates. Each catches a different failure, and none substitutes for another. A project with
only gate A has documentation that matches its annotations and may still describe a system it
does not have.

| Gate | Catches | Blocking |
|---|---|---|
| A — Regeneration diff | code changed, docs did not | every pull request |
| B — Contract conformance | contract describes behaviour the implementation does not have | every pull request |
| C — Breaking-change detection | a breaking change shipped without a major version | on release |

---

## Gate A — Regeneration diff

**Question it answers:** does the committed reference match what the current code produces?

```
1. run the generation command into a temporary directory
2. diff it against the committed reference output
3. non-empty diff -> exit non-zero, print the diff and the fix command
```

Preconditions that make this gate meaningful:

- **Deterministic generation.** No timestamps, no absolute paths, no unstable ordering, no
  hostnames, no generator version strings in the output. Non-deterministic output means the
  diff is always non-empty, the gate is disabled within a week, and the drift returns.
- **Pinned generator.** In the project's lockfile. An unpinned generator turns an upstream
  release into a red build on an unrelated pull request.
- **The fix command in the failure message.** Literally:
  `Reference is out of date. Run: <exact command>. Then commit the result.`
  A gate whose message does not say how to satisfy it will be worked around.

Where the reference output is gitignored rather than committed, gate A instead asserts that
generation **succeeds** and that no hand-written file exists in the output path:

```bash
git ls-files docs/reference/ | grep -v '\.gitignore$' && {
  echo "Hand-written files found under generated reference path"; exit 1; }
```

---

## Gate B — Contract conformance

**Question it answers:** does the running implementation actually behave the way the contract
says?

Three layers, in increasing strength. Implement at least the first two.

### B1 — Response validation in integration tests
Every integration test that receives a response validates it against the declared schema for
that operation and status code. Cheap, and it catches the majority of real drift: a field that
became nullable, a type that widened, an enum that grew a value.

Failure mode this catches: the schema says `id: string`, the service started returning an
integer for legacy records, and every generated client crashes on those records.

### B2 — Contract-driven exercise
Drive the API **from** the contract rather than from hand-written tests: for each declared
operation, generate requests from the schema (including boundary and invalid inputs) and assert
that the responses conform to a declared status and schema. Property-based and fuzz-style
contract testing tools exist for most ecosystems; pick one via `tech-scout` and pin it.

Failure modes this catches: an endpoint declared in the contract that returns 404 because the
route was renamed; an undeclared 500 on a boundary input; a required parameter that is actually
optional, or the reverse.

### B3 — Consumer-driven contracts
Consumers publish the subset of the contract they depend on; the provider's CI verifies against
that set. Worth the ceremony only when there are several independent consumer teams. Below that
threshold it is process for its own sake — say so rather than recommending it by default.

### The coverage number that matters
Report **verified surface**: operations exercised by B1 or B2, divided by operations declared.
It is normally far lower than "documented surface", and it is the only one of the four coverage
numbers that measures truth rather than intent.

---

## Gate C — Breaking-change detection

**Question it answers:** did this release break a consumer without changing the major version?

```
1. fetch the contract from the previous released version
2. diff it structurally (not textually) against the current contract
3. classify each change
4. any breaking change without a major version bump -> fail
```

### Classification

| Change | Class | Why |
|---|---|---|
| Endpoint or operation removed | **breaking** | consumers 404 |
| Path or method changed | **breaking** | same as removal, with a worse error |
| Response field removed | **breaking** | consumers dereference nothing |
| Response field type narrowed or changed | **breaking** | deserialisation fails |
| Response field became nullable | **breaking** | consumers that assumed presence crash |
| Enum value removed from a response | **breaking** | exhaustive matches fail |
| New **required** request parameter or body field | **breaking** | existing calls are rejected |
| Request parameter type narrowed | **breaking** | previously valid calls are rejected |
| Validation tightened (shorter max length, stricter pattern) | **breaking** | silently rejects previously accepted data |
| Success status code changed (200 → 204) | **breaking** | strict clients treat it as an error |
| Default value changed | **breaking** | behaviour changes for callers who omitted it |
| Authentication or scope requirement added | **breaking** | existing credentials stop working |
| Rate limit lowered | **breaking** in practice | treat it as such |
| New optional request parameter | additive | |
| New response field | additive **if** consumers tolerate unknown fields — state that expectation in the contract, or treat it as breaking | |
| New endpoint | additive | |
| New enum value in a **request** | additive | |
| New enum value in a **response** | **breaking** for exhaustive consumers; declare the policy explicitly | |
| Description or example changed | non-functional | |
| Deprecation marker added | additive, and required before any removal | |

The two rows requiring a declared policy — unknown-field tolerance and response enum growth —
are where most real-world API arguments happen. Decide once, write it into the contract's
top-level description, and let the gate enforce that decision.

### Deprecation before removal

A removal is only permitted if, in a prior release, the symbol was:

1. marked with the format's machine-readable deprecation marker,
2. annotated with its replacement, and
3. annotated with the **version** in which it will be removed — a version, never "soon".

Gate C fails a removal that has no prior deprecation in the previous released contract. This is
the mechanism that turns a deprecation policy from a paragraph into a guarantee.

---

## Wiring notes

- All three gates run against a **built artifact**, not a developer machine. Gate B needs the
  service running: use the same container image the release will ship.
- Gate C needs the previous contract. Publish the contract file as a release artifact at a
  stable per-version URL; then gate C is a fetch and a diff rather than an archaeology exercise.
- Keep gates fast enough to run on every pull request. Gate B2 across a large API can be sharded
  by tag; a gate that adds ten minutes to every pull request will be marked "allowed to fail",
  which is the same as deleting it.
- Report all three results in one status check with a single summary line, so a contributor sees
  what to fix without opening three logs.

## The failure message contract

Every gate failure prints exactly three things:

1. **What is wrong**, specifically: the operation, the field, the file and line.
2. **How to reproduce locally**: one command.
3. **How to fix it**, or the sentence explaining why a human must decide.

Example:

```
GATE C FAILED — breaking change without a major version bump

  POST /v1/orders : request body field `currency` became required
  previous contract: releases/v2.4.0/openapi.yaml
  current contract:  build/openapi.yaml

  Reproduce: make contract-diff BASE=v2.4.0
  Fix:       make `currency` optional with a documented default,
             or bump to v3.0.0 and add a migration note in docs/migration/v3.md
```

A gate that says "contract check failed" trains contributors to ignore it, and an ignored gate
is worse than no gate: it produces the appearance of enforcement while the drift continues.
