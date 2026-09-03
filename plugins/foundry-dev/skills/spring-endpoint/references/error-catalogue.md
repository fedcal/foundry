# Error catalogue — RFC 9457 problem types

RFC 9457 (*Problem Details for HTTP APIs*) obsoletes RFC 7807. Read the current text at
`https://www.rfc-editor.org/rfc/rfc9457.html` before quoting a clause.

## The `type` URI is the contract

`type` is the **machine-readable error code**. Consumers branch on it. Therefore:

- It is a URI you own and can dereference to documentation. Pattern:
  `https://errors.<your-domain>/<area>/<slug>`.
- It is **stable forever**. Changing a `type` is a breaking API change and must go through
  `api-deprecation`.
- `about:blank` is only correct when the status code alone fully describes the problem — that
  is, essentially never for a domain error.
- `title` is stable per `type` and human-readable but not localised by default.
- `detail` explains *this occurrence*. It may vary. It is **not** a place for exception text.
- `instance` identifies the occurrence — use the request path or a correlation id URI.

## Standard mappings

| Situation | Status | Suggested `type` slug | Notes |
|---|---|---|---|
| Bean Validation failure on the body | 400 | `validation-failed` | Field errors in an `errors` array extension. |
| Malformed JSON / unreadable body | 400 | `malformed-request` | From `HttpMessageNotReadableException`. Never echo the parse error. |
| Missing or invalid credentials | 401 | `unauthenticated` | Include `WWW-Authenticate`. No detail about which part was wrong. |
| Authenticated but not permitted | 403 | `forbidden` | If existence itself is confidential, return 404 instead. |
| Resource does not exist | 404 | `resource-not-found` | Same body whether it never existed or the caller may not see it. |
| Method not allowed on the route | 405 | `method-not-allowed` | Set `Allow`. |
| Unsupported `Accept` | 406 | `not-acceptable` | |
| Domain invariant violated | 409 | `<area>/<invariant-slug>` e.g. `orders/already-shipped` | One `type` per invariant, not one generic conflict. |
| Optimistic lock / stale `If-Match` | 409 or 412 | `concurrent-modification` | Pick one policy product-wide and document it. |
| Unique constraint violation | 409 | `<area>/duplicate-<field>` | Map the constraint name; never leak the SQL. |
| Unsupported media type | 415 | `unsupported-media-type` | |
| Missing `If-Match` on an unsafe method | 428 | `precondition-required` | RFC 6585 status; still an RFC 9457 body. |
| Rate limit exceeded | 429 | `rate-limit-exceeded` | Set `Retry-After`. |
| Unhandled failure | 500 | `internal-error` | `detail` is a fixed string plus a correlation id. Nothing else. |
| Downstream dependency unavailable | 503 | `dependency-unavailable` | Set `Retry-After` when you know it. Name the *capability*, not the internal hostname. |
| Deprecated resource, past sunset | 410 | `resource-gone` | With a `Link rel="successor-version"`. See `api-deprecation`. |

## Extension members

Extensions are allowed by RFC 9457 and are how you carry structure. Keep them documented in
OpenAPI.

```json
{
  "type": "https://errors.example.test/validation-failed",
  "title": "Request validation failed",
  "status": 400,
  "detail": "The request body did not satisfy the schema.",
  "instance": "/v1/orders",
  "correlationId": "01J8Z9K3QW7M2N4P6R8T0V2X4Y",
  "errors": [
    { "field": "reference", "code": "NotBlank", "message": "must not be blank" },
    { "field": "lines",     "code": "Size",     "message": "must contain at least 1 item" }
  ]
}
```

- `code` is the constraint identifier, so a client can localise without parsing English.
- `field` uses a stable JSON pointer or dotted path — decide one and never mix.
- `correlationId` is the only bridge between the response and your logs. Emit it on **every**
  error, log it on **every** exception, and put it in the support template.

## Never in a response body

Exception class names or messages, stack frames, SQL text or constraint DDL, internal
hostnames, IPs, ports or queue names, file paths, another user's data, the existence of a
resource the caller may not see, or a token/secret echoed back from the request.

Log them, tagged with the correlation id. The response gets the id.

## Wiring

One `@RestControllerAdvice` per application, extending `ResponseEntityExceptionHandler` so
Spring's own exceptions (`MethodArgumentNotValidException`, `HttpMessageNotReadableException`,
`HttpRequestMethodNotSupportedException`, `NoResourceFoundException`) render in the same
format. Domain exceptions get their own `@ExceptionHandler` methods.

Prefer building `ProblemDetail` through a small factory so the correlation id, the `type` base
URI and the logging are applied in one place and cannot be forgotten per handler.

## Test assertions

For every declared status:

```
status  == expected
Content-Type startsWith "application/problem+json"
$.type   == the exact documented URI
$.status == the HTTP status
```

A test asserting only the status code lets a completely wrong body ship.
