# Per-header reference

Values, syntax traps, and the standard for each. Verify current browser behaviour against
live documentation; support changes and this file does not.

## Strict-Transport-Security (RFC 6797)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- `max-age` is seconds; one year is the common target. Roll up from a short value if the
  site has any HTTP dependency.
- `includeSubDomains` covers every subdomain, including internal tools and vendor-hosted
  ones. Inventory them first — this is the attribute that causes outages.
- `preload` is a submission to a browser-maintained list. Removal takes months to reach
  users. Treat it as irreversible; add it only when every subdomain is HTTPS-only.
- HSTS only applies after a first successful HTTPS response. It is not a substitute for
  redirecting HTTP to HTTPS, and it does not protect the very first visit.
- Do not send it over plaintext HTTP; browsers ignore it there.

## X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```
One value. Prevents MIME sniffing (an uploaded file typed `text/plain` being executed as
script). Matters most on any route serving user-uploaded content and on JSON APIs.

## Referrer-Policy (W3C Referrer Policy)

| Value | Effect |
|---|---|
| `no-referrer` | never send. Safest; breaks referrer-based analytics and some payment returns |
| `strict-origin-when-cross-origin` | full URL same-origin, origin only cross-origin, nothing on downgrade. Good default |
| `same-origin` | referrer only to your own origin |
| `no-referrer-when-downgrade` | legacy; leaks full URLs cross-origin |
| `unsafe-url` | never use — leaks paths, ids and tokens in URLs |

If ids or tokens appear in URLs, the header is a mitigation, not the fix: get them out of
the URL (they also land in logs and browser history — CWE-532).

## Permissions-Policy (W3C Permissions Policy)

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), fullscreen=(self)
```
- `()` denies for everyone including your own document. `(self)` allows your origin only.
- The list of recognised features changes; unrecognised features are ignored, so an
  over-long list is harmless but unmaintainable. Deny what you know you do not use.
- It also constrains iframes you embed, which is its most useful property when you must host
  third-party content.
- The older `Feature-Policy` header is superseded; do not add it to new code.

## Cross-Origin-Opener-Policy (HTML standard)

```
Cross-Origin-Opener-Policy: same-origin
```
Severs `window.opener` between your document and cross-origin documents, closing a class of
cross-window attacks and enabling cross-origin isolation. Breaks OAuth popups and payment
flows that rely on `window.opener` callbacks — check those before enabling, and consider
`same-origin-allow-popups` where a popup flow must keep working.

## Cross-Origin-Embedder-Policy (Fetch standard)

```
Cross-Origin-Embedder-Policy: require-corp
```
Requires every cross-origin subresource to opt in via CORP or CORS. `credentialless` is a
softer variant that loads cross-origin resources without credentials. **This is the header
most likely to break your site.** Enable it only when you need cross-origin isolation
(for example `SharedArrayBuffer`), and roll it out with
`Cross-Origin-Embedder-Policy-Report-Only` first.

## Cross-Origin-Resource-Policy (Fetch standard)

```
Cross-Origin-Resource-Policy: same-origin
```
Declares who may embed *your* resource. Use `same-origin` for private resources and
`cross-origin` for assets a CDN or partner legitimately embeds. `same-site` sits between
them. Cheap and effective on API responses and private media.

## X-Frame-Options (legacy)

`DENY` or `SAMEORIGIN`. Superseded by CSP `frame-ancestors`, which wins where both are
present and supports multiple origins. Keep `X-Frame-Options` only for legacy user agents;
never rely on `ALLOW-FROM`, which was never widely supported.

## Cache-Control (RFC 9111)

```
Cache-Control: no-store
```
on any response containing authenticated or personal data. `no-cache` still permits storage;
`private` still permits browser storage. Getting this wrong puts one user's data in another
user's shared-cache response, which is a confidentiality breach that looks like a caching
bug.

## X-XSS-Protection

Omit, or send `0`. The legacy auditor has been removed from current browsers, and its
filtering behaviour historically introduced vulnerabilities of its own. Its presence in a
policy is a sign the configuration was copied from an old guide.

## Fetch Metadata (W3C Fetch Metadata Request Headers)

`Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`, `Sec-Fetch-User` are *request* headers
set by the browser. Server-side, a resource isolation policy can reject requests where
`Sec-Fetch-Site` is `cross-site` and `Sec-Fetch-Mode` is `navigate` on non-navigable
endpoints. This is a strong, cheap CSRF and cross-origin-leak defence — but only where the
browser sends the headers, so treat it as an additional signal, never the only check.

## Server, X-Powered-By, X-AspNet-Version

Remove them. Version disclosure is low severity on its own but tells a scanner exactly which
advisories to try. Removing them costs one configuration line.
