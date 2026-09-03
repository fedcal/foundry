# Reading CSP violation reports

Standard: W3C Content Security Policy Level 3 (`report-uri`, deprecated but widely
honoured) and the W3C Reporting API (`report-to` / `Reporting-Endpoints`). Send both during
the transition and verify which one your browser population actually delivers, rather than
assuming.

## The payload

`report-uri` delivers a POST with `Content-Type: application/csp-report` and a
`csp-report` object. The Reporting API delivers a batched array with
`Content-Type: application/reports+json`. Your endpoint must accept both shapes.

Fields that carry the signal:

| Field | Use |
|---|---|
| `document-uri` / `url` | which page. Group by route pattern, not by full URL, or query strings shred your grouping |
| `violated-directive` / `effective-directive` | which rule fired |
| `blocked-uri` | what was blocked. The most informative and the most noisy field |
| `source-file`, `line-number`, `column-number` | where in your code — absent for many extension-generated reports |
| `script-sample` | a short prefix of the offending code, when the browser provides it |
| `disposition` | `report` vs `enforce` — confirms which policy fired |
| `original-policy` | which policy version produced it; essential when running two policies |

Never render report fields into an admin UI without escaping. The report body is
attacker-influenced input (`document-uri` and `blocked-uri` in particular): the endpoint is
an untrusted source like any other, and it is unauthenticated by design. Also bound its
size and rate — an open report endpoint is a free write amplifier (CWE-770).

## Filtering the noise

On a consumer-facing site the majority of raw CSP reports are not your code. Filter, then
triage:

**Almost always noise**
- `blocked-uri` of `chrome-extension:`, `moz-extension:`, `safari-extension:`,
  `safari-web-extension:` — browser extensions injecting into your page.
- Reports with no `source-file` and a `script-sample` matching known extension or
  antivirus injectors.
- `blocked-uri: "inline"` on pages you know contain no inline script, arriving from a small
  number of user agents — usually an injecting proxy or a locale-specific ISP script.
- Mobile in-app browsers injecting their own scripts.
- Duplicated reports from a single client in a burst.

**Always investigate**
- `blocked-uri` that is a first-party path.
- `violated-directive: connect-src` — a real API or telemetry origin you forgot.
- `violated-directive: script-src` with a `source-file` inside your own bundle.
- `blocked-uri: "eval"` — a dependency using `eval`/`new Function`. Identify the library
  before deciding; `'unsafe-eval'` is a significant concession.
- Anything on a payment, login or account page. Break these and the cost is immediate.

**Cardinality control.** Aggregate on
`(effective-directive, normalised blocked-uri, route pattern)` and count unique clients.
A violation seen by one client 4 000 times is one broken browser; a violation seen by 4 000
clients once is a broken page. The unique-client count is the number that matters.

## Triage rules

1. If it is first party → fix the code, not the policy.
2. If it is a third party you intend to keep → add the specific origin to the specific
   directive. Never widen `default-src`, never add a wildcard, never add a host to
   `script-src` when the resource is an image.
3. If it is a third party you did not know was there → that is a supply-chain finding
   before it is a CSP finding. Route to `supply-chain-guardian`.
4. If it is extension noise → filter it at the collector, permanently, with a documented
   rule. Do not weaken the policy for it: you cannot secure the user's extensions and you
   should not try.
5. If you cannot classify it after a genuine attempt → keep report-only on that route and
   enforce elsewhere. Per-route enforcement is legitimate and better than blanket delay.

## When to enforce

All of these:

- Unique-client first-party violation rate stable and near zero for several consecutive days.
- Every remaining first-party report has a written explanation.
- Report-only has covered the authenticated area, admin, error pages and any seasonal flow.
- A rollback plan exists with a named metric and a named watcher.

## After enforcement

- Keep collecting. A spike in enforced-disposition reports after a deploy is the earliest
  signal that a release broke the front end.
- Alert on: a new `effective-directive` appearing, a first-party `blocked-uri` appearing, or
  the unique-client rate crossing a threshold you set now.
- A sudden `script-src` violation from an unrecognised origin on a page you did not change
  is a possible third-party compromise. Treat it as an incident signal, not a policy bug.
