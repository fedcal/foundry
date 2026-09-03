# Threat class to proof test

Rule: **a mitigation whose removal breaks no test is not a mitigation.** For each threat,
name a test that fails when the control is removed, and name the CI job that runs it.

Where the `superpowers` plugin is installed, write these tests through
`superpowers:test-driven-development` — write the failing test first, confirm it fails for
the right reason, then implement the control. Without it, follow the same order manually.

| Threat class | Test shape | Assertion that matters | Lives in |
|---|---|---|---|
| Broken object-level authz (CWE-639, API1) | integration: user A requests user B's resource id | HTTP 404, **not** 403 — 403 confirms existence. Cover GET, PATCH, DELETE, list, search, export | per-resource integration test |
| Missing function-level authz (CWE-862, API5) | parameterised test enumerating the framework's route table | every route matches an explicit rule; test fails when a new route is added without one | one test per service, run on every build |
| Mass assignment (CWE-915) | POST/PATCH with a privileged field in the body | the field is unchanged in the persisted entity; response does not echo it | controller test |
| Tenant isolation (pooled model) | repository-level test issuing a query with no tenant predicate | the call throws; plus cross-tenant 404 matrix per resource type | data-layer test + integration matrix |
| SQL/NoSQL/OS injection (CWE-89, CWE-78) | request containing a metacharacter string | value is stored and returned as literal data; no error, no side effect | integration test per sink |
| SSRF (CWE-918) | request naming an internal, loopback or link-local target, and a target that redirects to one | rejected by the egress allow-list before any connection; redirect re-validated | outbound client unit test |
| Unsafe deserialisation (CWE-502) | payload declaring a type outside the allow-list | resolver rejects it; no instantiation | serializer configuration test |
| XXE (CWE-611) / entity expansion (CWE-776) | XML document with a DTD and with a deep entity chain | parser rejects the DTD; expansion bounded; no outbound resolution attempt | parser factory test |
| Path traversal (CWE-22) / zip-slip | filename with traversal sequences and an archive entry escaping the base | resolved canonical path is inside the base directory or the operation is refused | file-handling unit test |
| Authorisation race (CWE-362/367) | concurrent execution of the same guarded operation | exactly one succeeds; invariant (balance, quota, single-use token) holds | concurrency test with a real datastore |
| Session fixation (CWE-384) | capture session id before and after login | identifiers differ; the pre-login id is invalid afterwards | auth integration test |
| Refresh-token reuse (RFC 9700 s.4.14) | present a rotated refresh token a second time | the whole token family is invalidated and a security event is emitted | auth integration test |
| JWT misuse (CWE-347) | tokens with a wrong algorithm, wrong issuer, wrong audience, expired | each is rejected with the same generic error | token verifier unit test |
| CORS misconfiguration (CWE-942) | preflight from an unlisted origin and from `null` | no `Access-Control-Allow-Origin` echo; `Vary: Origin` present on any variable response | HTTP-level test |
| Security headers | response assertions for CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, cookie flags | exact expected values, not "header present" | HTTP-level test (see `harden-headers`) |
| Secret exposure (CWE-798) | scanner job over the diff, and over history on a schedule | non-zero exit blocks the build | CI job (see `secret-hygiene`) |
| Vulnerable dependency (A06:2021) | scanner with a documented threshold and VEX suppressions | reachable critical/high or KEV-listed blocks the release | CI release gate |
| Availability limits (CWE-770) | request exceeding the configured cap | 429 or 413 returned before work is done, not after | contract test + a load test for the aggregate cap |
| Audit completeness (ASVS 5.0 V16) | perform each privileged action | a matching audit event with actor, target, outcome | audit integration test |

## Where proof tests fail in practice

- **Written but never run.** Name the pipeline job in the checklist, not just the test.
- **Asserting the happy path.** A test proving an authorised user succeeds proves nothing
  about the control. The assertion must be on the *denied* case.
- **Mocked past the control.** A test that mocks the repository does not prove a
  repository-level tenant predicate exists. Use the real datastore for isolation tests.
- **403 instead of 404.** Fine as a deliberate decision, but decide it once and assert it
  consistently; a mixed convention leaks existence at the boundary between the two.
- **Deleted with the flaky-test purge.** Tag these tests (`@Security`) so they are visible
  as a set, and require review to remove one.
