# CSP rollout: report-only to enforced, without breaking production

Standard: W3C Content Security Policy Level 3 · OWASP ASVS 5.0 V3 Web Frontend Security.

The failure mode this document exists to prevent: a team ships an enforced CSP, breaks
checkout, rolls it back, and adds `'unsafe-inline'` "temporarily" — where it stays for
years.

## Phase 0 — Inventory (before writing any policy)

```bash
# Inline scripts and styles
rg -n '<script(?![^>]*\bsrc=)' --glob '*.html' --glob '*.jsp' --glob '*.erb' --glob '*.hbs' --glob '*.ejs'
rg -n '<style|style="' --glob '*.html' --glob '*.jsx' --glob '*.tsx'
# Inline event handlers - these cannot take a nonce
rg -n '\son(click|load|error|submit|change|mouseover|focus|blur)\s*='
# javascript: URLs
rg -n 'href\s*=\s*["'"'"']javascript:'
# eval-family
rg -n '\beval\(|new Function\(|setTimeout\(\s*["'"'"']|setInterval\(\s*["'"'"']'
# DOM sinks that Trusted Types will catch
rg -n 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.src\s*=|createContextualFragment'
# Third-party origins already loaded
rg -n 'https?://[a-z0-9.-]+\.(com|net|io|org)' --glob '*.html' | sort -u | head -50
```

Produce a table: artifact → kind (inline script / handler / style / eval / third party) →
migration (nonce, hash, externalise, sandbox, drop) → owner. This table is the actual work;
the header is one line.

## Phase 1 — Draft the target policy

Start from the strict, nonce-based policy in `SKILL.md`. Do **not** start from the current
behaviour and tighten — you will end up encoding every accident as a rule.

Directive decisions worth making explicitly:

- `connect-src`: list every API, WebSocket and telemetry origin. Forgetting the error
  reporter is the most common enforcement surprise.
- `img-src`: `data:` is usually required (inlined icons); `blob:` if you render generated
  images. `data:` in `script-src` is never acceptable.
- `frame-src` / `child-src`: payment iframes, video embeds, SSO iframes.
- `worker-src`: service workers and web workers, often loaded from `blob:`.
- `manifest-src`, `media-src`: only if used.
- `form-action 'self'`: blocks form-based exfiltration; check federated login flows that
  legitimately POST to an IdP before setting it.
- `frame-ancestors`: `'none'` unless the app is genuinely embedded; if it is, list exact
  origins, never `*`.
- `upgrade-insecure-requests`: useful during an HTTP→HTTPS migration; not a substitute for
  fixing the URLs.

## Phase 2 — Nonce plumbing

The nonce must be generated once per response with a CSPRNG (≥128 bits, base64), placed in
the header **and** on every first-party inline `<script>`, and never reused or cached.

Per stack, the integration point:

| Stack | Where |
|---|---|
| Spring Boot / Thymeleaf | a `OncePerRequestFilter` generating the nonce into a request attribute; template reads it into `th:attr="nonce=..."`; header written by the same filter |
| Express | middleware setting `res.locals.cspNonce` before the view layer; template engine emits it |
| Next.js / SSR React | middleware or the document renderer; propagate to `<Script nonce>` and to any injected style tag |
| Angular universal / SSR | server transform injecting the nonce into the generated `<script>` tags; Angular reads a `ngCspNonce` attribute for its inline styles |
| Django | a context processor plus middleware, or a maintained CSP middleware package |
| Rails | the framework's `content_security_policy_nonce` helpers |
| Static hosting | no per-request work possible → use hashes generated in the build |

Cache interaction is the trap: **any layer that caches the HTML must not cache the nonce.**
If a CDN caches the page, either mark the HTML `no-store`, or switch that page to hashes.
A cached nonce silently makes the policy inert.

## Phase 3 — Report-only

Ship `Content-Security-Policy-Report-Only: <target policy>; report-uri /csp-report;
report-to csp-endpoint`, plus a `Reporting-Endpoints` header naming the endpoint.

Change nothing else in this phase. If you fix violations and adjust the policy in the same
deploy you cannot tell which change moved the numbers.

Duration: at least one full business cycle. One week minimum. If the application has
monthly billing pages, quarterly reports or seasonal flows, cover them or accept that you
will enforce blind on those paths.

Coverage: report-only must be on **every** route, including admin, error pages and the
authenticated area. Most teams enable it on the marketing page and learn nothing.

## Phase 4 — Triage

See `reading-csp-reports.md`. Exit condition for this phase: first-party violation rate
stable and near zero for several consecutive days, with every remaining first-party report
explained.

## Phase 5 — Enforce and ratchet

1. Move the tested policy into `Content-Security-Policy`.
2. Keep the report endpoint live — enforcement without reporting means you find out about
   breakage from customers.
3. Add a *stricter* candidate policy in `Content-Security-Policy-Report-Only` at the same
   time (for example adding `require-trusted-types-for 'script'`, or removing the last
   `style-src 'unsafe-inline'`). Both headers can be sent simultaneously. This is the
   ratchet: every enforced policy has a stricter one in report-only behind it.
4. Add the exact-string header test to CI.
5. Set a review date for the remaining exceptions, with an owner.

## The third-party-tag decision

A tag manager whose purpose is injecting arbitrary inline script is structurally
incompatible with a strict CSP. Pretending otherwise produces a policy with
`'unsafe-inline'` and a security review that says "CSP present". Choose one, in writing:

1. **Nonce propagation** — only if the vendor documents support for it and you can verify it.
2. **Isolation** — load the tag inside a sandboxed iframe served from a separate origin, so
   its compromise does not reach your DOM or cookies. Highest effort, correct result.
3. **Hash-pin a fixed snippet** — works when the third party ships a stable loader that does
   not inject further inline code. Verify after every vendor update; the hash breaking is
   the signal that they changed the code.
4. **Remove it** — frequently the right answer, and the one nobody proposes.

Record the choice, the owner and the review date. A third party you allow in `script-src`
runs with the full privileges of your application; its compromise is your breach
(CWE-829, OWASP A08:2021).

## Rollback plan

Before enforcing, define: the metric that indicates breakage (JS error rate, conversion
rate, a specific funnel step), who watches it, for how long, and the exact one-line change
that reverts to report-only. Rolling back to report-only is safe and instant; rolling back
to `'unsafe-inline'` is what you are trying to avoid forever.
