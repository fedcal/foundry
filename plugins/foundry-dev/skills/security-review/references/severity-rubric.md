# Severity rubric

Severity is a function of the **confirmed consequence** and **who can reach it**, never of
the vulnerability class name.

| Severity | Definition | Examples |
|---|---|---|
| `critical` | Unauthenticated or any-user access leads to crown-jewel compromise, cross-tenant breach, remote code execution, or unbounded money movement | missing tenant predicate on a public API; deserialisation of a client-supplied object graph; authentication bypass |
| `high` | Authenticated access leads to significant unauthorised data access or integrity loss, or a control protecting a critical asset is absent | IDOR on another user's records; privileged field settable via mass assignment; SSRF reaching an internal service |
| `medium` | Requires a specific role, a race window, user interaction, or yields limited data; or a defence-in-depth control is missing where a primary control holds | authorisation race with a narrow window; missing rate limit on login; reflected `Origin` without credentials |
| `low` | Hardening gap with no direct path to loss | missing `Referrer-Policy`; verbose version banner; missing `Vary: Origin` on a non-varying response |
| `info` | Refuted findings, observations, and issues with no security consequence in this context | traversal confined to a directory the caller may read entirely; a "vulnerability" in unreachable example code |

## Modifiers

Raise one band when: the asset is the declared crown jewel; the flow is internet-facing and
unauthenticated; the same weakness class has caused a past incident in this system; the data
is special-category personal data; the affected path is the release or signing pipeline.

Lower one band when: exploitation requires an already-privileged insider; the control is
defence in depth and a primary control is confirmed present; the data is already public;
the code is not deployed in any environment.

Never lower a band for "we plan to fix it" or "the customer accepted it" — that is `status`
on a risk, not severity on a finding.

## Worked examples

**A.** `findById(pathId)` with no ownership filter, internet-facing API, returns customer
name and address, any authenticated user can request any id.
→ consequence: cross-tenant personal data disclosure; reach: any authenticated user.
→ `critical`. Standard: `OWASP ASVS 5.0 V8 Authorization; CWE-639`.

**B.** Same pattern, but the endpoint is behind an internal-only ingress and requires an
`admin` role, and admins already have a bulk export of the same data.
→ consequence: none beyond existing rights.
→ `info`, with the reason recorded.

**C.** `yaml.load` without a safe loader, on a configuration file read from disk at startup,
where the file is only writable by the deployment pipeline.
→ attacker control fails check 2 unless the pipeline is compromised.
→ `low` as a hardening item; note that it becomes `critical` if that file ever accepts user
upload, and say so in `remediation`.

**D.** Refresh tokens rotated but no family invalidation on reuse.
→ consequence: a stolen refresh token remains usable indefinitely and its theft is
undetectable; reach: requires prior token theft.
→ `high`. Standard: `RFC 9700 s.4.14; OWASP ASVS 5.0 V7 Session Management; CWE-294`.

**E.** CSP present but contains `unsafe-inline` for scripts, on an application with a
confirmed reflected-input sink.
→ the primary control (output encoding) status decides: if encoding is confirmed correct,
`medium` (defence in depth weakened); if a sink is confirmed unescaped, the XSS finding is
`high` and the CSP gap is cited in its `remediation`.

## Effort estimate

`effortHours` is engineering time to implement *and test* the fix, not to triage it. Use
whole hours; a fix estimated at 0.5 h that requires a data migration is mis-estimated.
Where the fix is structural (a repository-layer predicate across 40 call sites), estimate
the structural change, not the first call site, and say so in `remediation`.
