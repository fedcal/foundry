---
name: security-review
description: Adversarial application-security review pass over a diff, a module or a whole service, producing a review.v1 artifact with finding.v1 entries mapped to OWASP ASVS 5.0 and CWE. Includes the mandatory verification gate that kills speculative findings before they reach the user. Use before merging a change that touches authentication, authorisation, data access, file handling, deserialisation, outbound requests or secrets; before a release; or when auditing an unfamiliar service.
allowed-tools: Read Grep Glob Bash Write TodoWrite
context: fork
agent: foundry-dev:appsec-reviewer
user-invocable: true
argument-hint: "<path|--diff> [--base origin/main] [--wave w4] [--asvs 1|2|3]"
metadata:
  foundry.vertical: dev
  foundry.io: "code + scope -> review.v1"
license: Apache-2.0
---

# Security review pass

Output discipline first: **a review is judged by its confirmed-finding precision, not by its
finding count.** Every speculative finding you emit costs the team more than the bug you
missed, because it teaches them to stop reading.

Defensive only. Describe the weakness class, the affected code path, the standard and the
fix. Never produce exploit code, payloads or attack tooling. `failureScenario` describes the
shape of the abuse, not a runnable procedure.

## Scope selection

| Mode | Command | When |
|---|---|---|
| diff | `--diff --base origin/main` | pre-merge; review only what changed plus what the change reaches |
| module | `<path>` | a bounded context before release |
| service | repo root | audit, onboarding, post-incident |

In diff mode, the changed lines are the *starting point*, not the scope: a change that
removes an authorisation annotation shows up as one deleted line and affects every route
under it. Always read the surrounding filter chain, guard, base class and configuration.

Default ASVS level: **L2**. Use L1 only for a system with no sensitive data; L3 for systems
where compromise is catastrophic.

## Procedure

### 1 — Enumerate untrusted sources (10 min)

Body, query, path variables, headers (`Host`, `X-Forwarded-*`, `Origin`, `Referer`,
`Content-Type`, `Range`), cookies, uploaded filenames and contents, archive entry names,
webhook bodies, queue payloads, third-party API responses (OWASP API10), database rows
written by an earlier untrusted flow (second-order injection), and config in multi-tenant
control planes.

Write them down. A source not on the list will not be traced.

### 2 — Trace to sinks, class by class (the bulk of the work)

Work the checklist below. For each class: locate the sinks, walk backwards to a source,
and record a result — a finding, or "none found; patterns searched: …". A silently skipped
class reads identically to a clean one.

| # | Class | Standard | Look for |
|---|---|---|---|
| 1 | Injection (SQL/NoSQL/OS/LDAP/XPath/template) | ASVS 5.0 V1, V2; CWE-89/78/90/643/943; A03:2021 | string-built queries, dynamic identifiers and `ORDER BY`, `exec`, template rendering of user data |
| 2 | Broken object-level authz / IDOR | ASVS 5.0 V8; CWE-639; API1 | `findById(requestId)` with no ownership predicate; 403 leaking existence |
| 3 | Mass assignment | ASVS 5.0 V2, V8; CWE-915; API3 | body bound to entity; privileged fields `role`, `tenantId`, `price`, `status`, `emailVerified` |
| 4 | Function-level authz | ASVS 5.0 V8; CWE-862/863; API5 | routes not covered by an explicit rule; default-permit |
| 5 | Multi-tenant isolation | ASVS 5.0 V8; CWE-639 | tenant id read from body/query/header; cache and index keys without tenant |
| 6 | SSRF | ASVS 5.0 V2, V12; CWE-918; A10:2021 | input-influenced outbound URLs; blocklists; validation before redirect; DNS rebinding |
| 7 | Unsafe deserialisation | ASVS 5.0 V15; CWE-502; A08:2021 | `readObject`, polymorphic typing, `pickle`, `yaml.load`, `unserialize`, `BinaryFormatter` |
| 8 | XXE / entity expansion | ASVS 5.0 V1, V5; CWE-611/776 | XML, XSLT, SVG, SAML, Office document parsing without secure-processing features |
| 9 | Path traversal / file handling | ASVS 5.0 V5; CWE-22/434/732 | request filenames joined into paths; zip-slip; client `Content-Type` trusted |
| 10 | Authorisation races | ASVS 5.0 V2; CWE-362/367 | check-then-act across I/O; quota, balance, single-use token, idempotency |
| 11 | JWT / token misuse | ASVS 5.0 V9; CWE-347/345; RFC 8725, RFC 9068 | algorithm not pinned, `iss`/`aud`/`exp` unchecked, `kid` used to load a key, token in query string |
| 12 | Session lifecycle | ASVS 5.0 V7; CWE-384/613 | id not regenerated at login; no absolute timeout; weak randomness |
| 13 | CORS / browser boundary | ASVS 5.0 V3; CWE-942/346; RFC 6454 | reflected `Origin` with credentials, `null` accepted, unanchored regex, missing `Vary: Origin`, WebSocket `Origin` unchecked (CWE-1385) |
| 14 | Secret handling | ASVS 5.0 V13, V14; CWE-798/522/312/532 | literals in source, secrets in logs/URLs/images/front-end bundles, weak password KDF (CWE-916) |
| 15 | Cross-cutting | ASVS 5.0 V16; CWE-209/601/770/295/338 | stack traces to clients, open redirects, missing rate limits, TLS verification disabled, non-CSPRNG tokens |

Depth per class — indicators, the fixes that do not work, and the fix that does — is in
`references/vulnerability-classes.md`. Do not paste that file into context wholesale; open
the sections for the classes the code actually contains.

### 3 — The verification gate (mandatory)

**No finding is written before it passes this gate.** Full protocol, including how to
falsify each class and how to record the result, is in `references/verification-gate.md`.

The five checks:

1. **Reachability** — trace upward from the sink to a real entry point. Dead code, fixtures,
   examples, unregistered handlers and flag-disabled routes are not reachable. Record the
   reaching entry point as evidence.
2. **Attacker control** — follow the value backwards to its assignment. Constants,
   enum-constrained values, server-side lookups and ids already re-resolved through an
   ownership-scoped query are not controlled. Quote the assignment line.
3. **Existing control** — look for the protection before concluding it is absent:
   parameterised builders, template auto-escaping, a global authorisation filter, an
   argument resolver that overwrites the tenant id, validation annotations, a middleware
   registered *before* the handler. Read the filter chain order.
4. **Consequence** — does exploitation cross a trust boundary or cause real loss? Name the
   boundary. If you cannot, the severity is `info`.
5. **Falsification attempt** — spend one honest attempt proving yourself wrong. If the guard
   exists, mark the finding `refuted`, keep it in the artifact with the neutralising
   `path:line`, and move on.

Verdict mapping:

| All five pass | Reachability or control unproven | A check failed |
|---|---|---|
| `verdict: confirmed` | `verdict: plausible`, severity capped at `medium`, state exactly what is missing | `verdict: refuted`, `severity: info`, name the control |

Severity comes from the confirmed consequence, never from the class name. An
unauthenticated cross-tenant read is `critical` whether the mechanism is injection or a
missing predicate; a theoretical injection in an admin-only debug tool is not.

**Static analysis is a lead generator, not a finding source.** Every `semgrep`/CodeQL hit
passes the same gate. Forwarding raw tool output is the single largest source of security
review noise and is a defect in this skill's output.

**Never claim runtime behaviour you did not observe.** Attach command output as `evidence`
of `kind: "command"` when you ran something; otherwise cap confidence at `medium`. Run only
read-only, non-intrusive commands, and never against a system you were not asked to review.

### 4 — Write `review.v1`

Path: `.foundry/blackboard/<wave>/appsec-reviewer.json`. Skeleton in
`references/review-template.json`.

```json
{
  "schema": "review.v1",
  "producedBy": "appsec-reviewer",
  "target": "services/orders",
  "dimension": "security",
  "verdict": "block",
  "findings": [
    {
      "schema": "finding.v1",
      "producedBy": "appsec-reviewer",
      "id": "SEC-003",
      "severity": "critical",
      "category": "broken-access-control",
      "title": "Order lookup resolves by id without an ownership predicate",
      "summary": "OrderController#get passes the path id straight to OrderRepository.findById with no tenant or owner filter, and the global filter chain only enforces authentication.",
      "failureScenario": "An authenticated user of tenant A requests GET /api/orders/{id} with an order id belonging to tenant B and receives the full order, including customer name, address and total.",
      "location": { "file": "src/main/java/com/acme/orders/OrderController.java", "line": 64, "component": "orders-api" },
      "standard": "OWASP ASVS 5.0 V8 Authorization; CWE-639",
      "remediation": "Replace findById(id) with findByIdAndTenantId(id, session.tenantId()) in OrderRepository, and add a repository-layer predicate that throws when no tenant filter is present. Return 404 for a miss, not 403.",
      "effortHours": 4,
      "confidence": "high",
      "verdict": "confirmed",
      "evidence": [
        { "kind": "file", "ref": "src/main/java/com/acme/orders/OrderController.java:64", "excerpt": "return service.get(id);" },
        { "kind": "file", "ref": "src/main/java/com/acme/config/SecurityConfig.java:41", "excerpt": "anyRequest().authenticated()" },
        { "kind": "standard", "ref": "OWASP ASVS 5.0 V8 Authorization" }
      ]
    }
  ],
  "metrics": { "filesReviewed": 38, "sinksTraced": 61, "refuted": 5, "asvsLevel": 2 },
  "summary": "One confirmed cross-tenant read in the orders API; five candidate findings refuted by the global argument resolver."
}
```

Schema constraints that break writes: `additionalProperties: false` everywhere;
`title` ≤ 120 chars; `summary` ≤ 600 chars on a finding, ≤ 900 on the review;
`evidence[].excerpt` ≤ 600 chars; `failureScenario` and `confidence` are required on every
finding; `location` accepts only `file`, `line`, `component`.

Verdict: `block` if any `confirmed` finding is `critical` or `high`; `pass-with-comments`
if only `medium`/`low`/`info` remain; `pass` only with an empty `findings` array.

Deduplicate: one weakness across N handlers is one finding with N evidence entries — unless
the fixes differ.

### 5 — Report

Return only: artifact path, verdict, counts by severity, top three confirmed findings as one
line each, and the refutation rate. Never return the findings array (AUTHORING §2 context
firewall).

## Exit criteria

- [ ] Every source from step 1 traced or explicitly deferred with a reason.
- [ ] All 15 classes have a recorded result, including "none found; patterns searched: …".
- [ ] 100% of findings have a concrete `failureScenario` naming actor, input and wrong
      outcome.
- [ ] 100% of `confirmed` findings passed all five gate checks with `path:line` evidence.
- [ ] `standard` on every finding contains an ASVS 5.0 reference **and** a CWE id.
- [ ] `refuted` findings retained with the neutralising control named.
- [ ] `metrics.refuted` present; refutation rate stated in the summary.
- [ ] Artifact validates against `review.v1`.
- [ ] If zero confirmed findings: say so plainly. Do not inflate `plausible` entries to
      justify the review.

## Handoffs

| Situation | Route to |
|---|---|
| Boundary-level gaps, not code-level bugs | `threat-model` skill / `security-architect` |
| Flow, token lifetime, tenancy or authorisation-model decisions | `identity-engineer` |
| Missing or wrong HTTP headers and cookie flags | `harden-headers` skill |
| A real secret found in code or history | `secret-hygiene` skill — immediately, rotation first |
| Vulnerable dependency, unpinned action, CI secret exposure | `supply-chain-guardian` |

## What this skill deliberately does not cover

- **Exploitation, penetration testing, fuzzing, DAST.** Static tracing only.
- **Dependency vulnerabilities and build integrity.** `supply-chain-guardian`.
- **Infrastructure, cloud IAM, container runtime and network posture.** Ops vertical.
- **Cryptographic primitive analysis.** Flag non-standard primitives; do not evaluate them.
- **Correctness, performance, readability.** Delegate to the general code reviewer; mixing
  them dilutes the security signal.
- **Compliance attestation.** ASVS ids give traceability, not conformance.
- **Front-end-only DOM XSS analysis at depth** and framework-specific sanitiser bypasses —
  covered only at the sink level here.

## Degradation

- `superpowers` present: deliver through `superpowers:requesting-code-review` conventions
  and run `superpowers:verification-before-completion` before reporting. Absent: the gate
  and exit criteria above are the substitute; nothing is skipped.
- No `rg`: `grep -rn`; state reduced coverage in `summary`.
- No `semgrep`/CodeQL: proceed manually. Their absence lowers recall, not precision.
- `--diff` with no `--base`: fall back to `git diff HEAD~1` and say so in `summary`.
- Dependency source unavailable: cap confidence at `medium` and state the assumed behaviour.
- No blackboard directory: create `.foundry/blackboard/<wave>/`; if the path is not
  writable, report findings inline in the same structure and say the artifact was not
  persisted.

## References

- `references/vulnerability-classes.md` — per-class indicators, ineffective fixes, correct
  fix, and the test that proves it.
- `references/verification-gate.md` — the falsification protocol per class, with the
  framework-level controls that most often refute a finding.
- `references/review-template.json` — copyable `review.v1` / `finding.v1` skeleton.
- `references/severity-rubric.md` — mapping confirmed consequence to severity, with worked
  examples.
