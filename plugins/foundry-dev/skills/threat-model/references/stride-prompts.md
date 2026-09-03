# STRIDE elicitation prompts

Run all six categories at every trust boundary. A category with no threat gets the sentence
"no credible threat because …" — that justification is part of the artifact.

Defensive framing: name the weakness class and its detection, never the attack procedure.

## S — Spoofing (violates authentication)

Ask: who claims to be whom at this boundary, and what proves the claim? What happens if the
proof is absent, expired, replayed, or issued by a different party?

- Inbound webhook accepted without verifying a signature — CWE-345. Also check the
  verification uses a constant-time comparison and covers the raw body, not a re-serialised
  copy.
- Token accepted without pinning the algorithm, or with `iss`/`aud` unchecked — CWE-347,
  RFC 8725, ASVS 5.0 V9.
- Internal service trusting a caller because of network position alone — NIST SP 800-207.
- Client-supplied header treated as identity (`X-User-Id`, `X-Forwarded-For`) — CWE-807.
- TLS chain verified but peer identity not checked — CWE-295, RFC 9525.
- Email/SMS as the only identity proof in account recovery — CWE-640-class.

## T — Tampering (violates integrity)

Ask: what can be altered between producer and consumer, and what would detect it?

- Request fields bound directly to a domain object, letting a caller set `role`, `price`,
  `tenantId`, `status` — CWE-915, ASVS 5.0 V2/V8.
- Artifacts deployed without verified provenance — CWE-494, SLSA v1.0 Build track.
- Parser disagreement between proxy and origin enabling request smuggling — CWE-444.
- Client-side state (hidden fields, JWT claims set by the client, prices in the cart)
  trusted server-side — CWE-565, CWE-807.
- Mutable container tags, mutable git tags, force-pushable release branches.
- Log records writable or deletable by the same identity that generates them.

## R — Repudiation (violates non-repudiation)

Ask: after a disputed action, what record proves who did what, and can that record be
altered or suppressed?

- Privileged actions (role change, refund, export, impersonation, key rotation) with no
  audit event — ASVS 5.0 V16, NIST SP 800-53 Rev. 5 AU-2.
- Audit events lacking actor id, source, target, timestamp source and outcome.
- Logs stored only in the same blast radius as the system that produces them.
- Shared accounts and shared API keys, which make attribution impossible by design.
- Impersonation that does not record both the operator and the impersonated subject.

## I — Information disclosure (violates confidentiality)

Ask: for each asset crossing this boundary, who can read it, and what enforces that?

- Object identifier from the request used to fetch without an ownership predicate —
  CWE-639, OWASP API1.
- 403 vs 404 distinction leaking existence of another tenant's resource.
- Over-broad response projection (entity serialised wholesale, internal fields included).
- Errors and stack traces returned to the client — CWE-209.
- Secrets and tokens in logs, URLs, referrer headers, browser history, crash reports —
  CWE-532.
- Cache or search index shared across tenants; a cache key missing the tenant discriminator.
- Backups, exports and non-production copies with production data and weaker controls.
- Timing and enumeration differences on login and password reset.

## D — Denial of service (violates availability)

Ask: what finite resource does a single cheap request consume, and what bounds it?

- Unbounded page size, unbounded expansion depth, unbounded batch size — CWE-770.
- Decompression and entity expansion (zip bombs, XML entity expansion) — CWE-776.
- Regex with catastrophic backtracking on untrusted input — CWE-1333.
- Unindexed query reachable from a public filter parameter.
- Per-request work amplified downstream (one call fanning into N third-party calls).
- Account lockout usable to lock out legitimate users.
- No rate limit on authentication, password reset, email sending, or expensive report
  generation.

## E — Elevation of privilege (violates authorisation)

Ask: what is the set of operations this actor may perform, and what enforces the edge of it?

- Route not covered by any authorisation rule where the default is permit — CWE-862.
- Function-level check present, object-level check absent (or the reverse) — OWASP API1 vs
  API5, CWE-863.
- Permission evaluated, then the state it depended on changes before the action — CWE-367.
- Tenant discriminator taken from a request field rather than the verified session —
  CWE-639.
- Privilege granted by a client-controlled value: a `role` claim the client can set, a
  cookie without integrity protection.
- Admin surface reachable on the same host, port and session as the user surface.
- Deserialisation, template injection or dynamic code paths granting arbitrary execution —
  CWE-502, CWE-1336, CWE-94.

## Cross-checks STRIDE does not cover

**Business logic**: workflow run out of order, replayed, or run concurrently with itself;
refunds exceeding the original charge; coupon reuse; quota checked then incremented
non-atomically; invitations accepted after revocation — CWE-362, CWE-367, ASVS 5.0 V2.

**Privacy (LINDDUN)**: linkability across datasets; identifiability from quasi-identifiers;
detectability of a record's existence; unawareness (data collected beyond expectation);
non-compliance (retention beyond purpose).

**Abuse of intended function**: bulk export, search enumeration, invite/notification spam,
password reset used as an email relay, webhook registration used as an outbound proxy,
file preview used to fetch internal URLs.
