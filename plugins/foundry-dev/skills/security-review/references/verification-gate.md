# The verification gate

Purpose: a security review is only useful if the team believes it. Precision beats recall.
This protocol is mandatory before any finding is written.

## Why speculative findings are expensive

A refuted finding costs an engineer 20–60 minutes to disprove, and costs the review channel
far more: after two or three, the next report is skimmed. The precision of your first ten
findings determines whether findings eleven onward are read at all.

## Check 1 — Reachability

**Question.** Is there a path from a real entry point to this sink?

**Method.** Walk the call graph upward. Stop only at an HTTP route, message listener,
scheduled job, CLI entry, or an exported library API that a consumer calls.

Not reachable: code in `test/`, `spec/`, `fixtures/`, `examples/`, `benchmarks/`; a
controller not registered with the framework; a route behind a flag that is off in every
environment (verify the default, and verify the production value if you can); a function
with no callers (`rg -n "functionName"` returns only the definition); a package excluded
from the build; a branch guarded by a condition that is constant in production.

**Record.** `evidence[] { kind: "file", ref: "<entry point path:line>" }`.

**If unresolved** → `verdict: plausible`, and say "no caller found for X; reachable only if
Y registers it".

## Check 2 — Attacker control

**Question.** Is the value at the sink actually controlled by an untrusted party?

**Method.** Follow the variable backwards to its assignment, through every reassignment.

Not controlled: literals and constants; enum-constrained values; values from a server-side
lookup keyed by something already authorised; identifiers already re-resolved through an
ownership-scoped query; values overwritten by a framework argument resolver or interceptor
after binding (read the resolver — this refutes many tenant-id findings); values from an
internal service that itself validates.

**Record.** Quote the assignment line in `evidence`.

**Partial control still counts** — a filename fragment concatenated into a path is control.
Say precisely which part is controlled.

## Check 3 — Existing control

**Question.** Is there already something on the path that neutralises this?

**Search before concluding absence:**

```bash
rg -n '@PreAuthorize|@Secured|hasRole|hasAuthority|authorizeHttpRequests|SecurityFilterChain'
rg -n 'CanActivate|@UseGuards|passport\.authenticate|requireAuth|middleware\('
rg -n 'tenantId|organizationId|CurrentUser|@AuthenticationPrincipal|argument.?resolver'
rg -n 'HandlerInterceptor|OncePerRequestFilter|addFilterBefore|app\.use\('
rg -n '@Valid|@Validated|zod|joi|pydantic|class-validator'
```

Framework-level controls that most often refute a finding:

| Suspected | Frequently already handled by |
|---|---|
| SQL injection | the ORM binding parameters even in a string-looking API — read the method contract |
| XSS | template engine auto-escaping; framework sanitiser; a CSP that blocks inline execution |
| CSRF | framework CSRF filter enabled by default, plus `SameSite` cookies |
| Mass assignment | a DTO layer, or "fail on unknown properties" enabled globally |
| Missing authz | a global deny-by-default rule in one config file far from the controller |
| Tenant id from request | an argument resolver or interceptor overwriting it from the session |
| Path traversal | the framework normalising and rejecting traversal before the handler |

**Order matters.** A filter registered *after* the handler does not protect it. A guard on an
interface is not applied if the concrete class is invoked directly. Read the registration.

**Record.** If the control exists → `verdict: refuted`, keep the finding at `severity: info`
with the control's `path:line`. Retaining refuted findings prevents the next reviewer from
re-raising them.

## Check 4 — Consequence

**Question.** Does exploitation cross a trust boundary or produce real loss? Name it.

If the answer is "an authenticated admin could read data they can already read", the
severity is `info`, whatever the class name. Severity comes from the consequence, never
from the vulnerability category.

**Record.** The crossed boundary goes in `failureScenario`.

## Check 5 — Falsification attempt

Spend one honest attempt at proving yourself wrong. Concretely:

- Read the base class, the parent controller and the interface's other implementations.
- Read the security configuration end to end, not just the matching line.
- Check whether a test already asserts the behaviour you claim is broken — if a passing test
  asserts a 404 for another tenant, your finding is refuted by evidence.
- Check the git log on the file: a recent commit titled "fix: enforce tenant filter" is a
  strong signal.
- Look for the same pattern elsewhere in the codebase handled correctly, and compare.

If after this you still cannot refute it, the finding stands.

## Verdict and confidence

| | `confirmed` | `plausible` | `refuted` |
|---|---|---|---|
| Checks | all five pass | 1 or 2 unresolved | any check failed |
| Severity | from consequence | capped at `medium` | `info` |
| Confidence | `high` if evidence includes source line, sink line and standard; `medium` if any inference remains | `low` or `medium` | n/a |
| Required text | full `failureScenario` | `failureScenario` plus "unverified because …" | the neutralising control with `path:line` |

## Tool output is not a finding

Every `semgrep`, CodeQL, linter or scanner hit enters at check 1 like any other lead.
Typical refutation rate for raw SAST output on a mature codebase is high; passing them
through unfiltered is the largest single source of noise in security review, and is a defect
in this skill's output.

## Runtime claims

Only claim behaviour you observed. If you ran a command, attach its output as
`evidence { kind: "command" }`. If you did not, cap confidence at `medium` and phrase the
finding as a static trace. Run only read-only, non-intrusive commands, only against systems
in scope. Never attempt to exploit a finding to confirm it.

## Report the refutation rate

`metrics.refuted` and the rate `refuted / (confirmed + plausible + refuted)` go into the
artifact. A review with a high refutation rate and few confirmed findings is a *good* review
honestly reported. Zero confirmed findings is a legitimate result; say so plainly rather
than promoting speculation to fill the report.
