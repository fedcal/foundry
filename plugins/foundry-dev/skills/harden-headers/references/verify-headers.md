# Verifying headers, and keeping them verified

Setting the header is the easy half. The half that matters is a test that fails when
somebody changes the middleware order six months from now.

## Manual checks

```bash
BASE=https://app.example.com

# Anonymous page
curl -sSI "$BASE/" 
# API route - middleware often differs
curl -sSI "$BASE/api/v1/ping"
# Error responses - the most commonly missed
curl -sSI "$BASE/definitely-not-a-real-path"
# Redirect - headers must survive the 30x
curl -sSI "$BASE/old-path"
# Authenticated page
curl -sSI -H "Cookie: __Host-session=<value>" "$BASE/account"

# Duplicate enforced CSP (must be exactly 1)
curl -sSI "$BASE/" | grep -ci '^content-security-policy:'

# Cookie flags
curl -sSI "$BASE/login" | grep -i '^set-cookie:'

# HSTS must never appear on plaintext, and HTTP must redirect
curl -sSI http://app.example.com/
```

What to look for beyond presence:

- exact directive content, not just the header name;
- the same policy on the API, error and redirect responses;
- `Set-Cookie` carrying `Secure`, `HttpOnly`, `SameSite` and a `__Host-` prefix on the
  session cookie;
- no `Server`/`X-Powered-By` version strings;
- no second `Content-Security-Policy` added by a proxy.

## Automated assertions

Assert **equality with the expected string**, not presence. A presence assertion passes
against `Content-Security-Policy: default-src *`.

Cover five response classes: anonymous page, authenticated page, API route, 404, 500.

Skeletons:

```javascript
// Node - node:test + fetch, zero dependencies
import { test } from 'node:test'
import assert from 'node:assert/strict'

const EXPECTED = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
}

for (const path of ['/', '/api/v1/ping', '/nope']) {
  test(`security headers on ${path}`, async () => {
    const res = await fetch(new URL(path, process.env.BASE_URL))
    for (const [h, v] of Object.entries(EXPECTED)) {
      assert.equal(res.headers.get(h), v, `${h} on ${path}`)
    }
    const csp = res.headers.get('content-security-policy')
    assert.ok(csp, `CSP missing on ${path}`)
    assert.ok(!/unsafe-inline/.test(csp.split('script-src')[1] ?? ''), 'unsafe-inline in script-src')
    assert.match(csp, /object-src 'none'/)
    assert.match(csp, /base-uri 'none'/)
  })
}
```

```java
// Spring Boot - MockMvc
@Test
void securityHeadersArePresentOnErrorResponses() throws Exception {
    mockMvc.perform(get("/definitely-not-a-real-path"))
        .andExpect(header().string("X-Content-Type-Options", "nosniff"))
        .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
        .andExpect(header().exists("Content-Security-Policy"));
}

@Test
void sessionCookieIsHostPrefixedAndFlagged() throws Exception {
    var setCookie = mockMvc.perform(post("/login").with(validCredentials()))
        .andReturn().getResponse().getHeader("Set-Cookie");
    assertThat(setCookie).startsWith("__Host-");
    assertThat(setCookie).contains("Secure").contains("HttpOnly").contains("SameSite=Lax");
}
```

## Nonce-specific assertions

- Two requests to the same page return **different** nonce values.
- The nonce in the header equals the nonce on every first-party inline `<script>`.
- The nonce value decodes to at least 16 bytes.
- The HTML response carrying a nonce is not cacheable by a shared cache
  (`Cache-Control: no-store` or equivalent).

## CI wiring

Run the header tests against a running instance in the pipeline, not only in unit tests —
the proxy and CDN layers are exactly where the regression happens, and a unit test cannot
see them. If the pipeline has no environment with the real proxy in front, say so and add a
post-deploy smoke check instead. An untested header is a header that will be removed.

## Third-party evaluation

Use an external policy evaluator on the CSP and record the residual weaknesses in the
artifact with an owner and a date. A CSP that an evaluator calls bypassable is a finding,
even if it contains no `unsafe-inline`: host allow-lists containing an origin that serves
user content or a JSONP endpoint are the usual cause.
