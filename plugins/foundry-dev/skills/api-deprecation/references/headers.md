# Deprecation and sunset headers

**Read the specifications before finalising syntax.** These are stable identifiers, but the
exact field-value grammar must come from the RFC text, not from memory:

- `Deprecation` — **RFC 9745**, <https://www.rfc-editor.org/rfc/rfc9745.html>
- `Sunset` — **RFC 8594**, <https://www.rfc-editor.org/rfc/rfc8594.html>
- `Link` — **RFC 8288** (Web Linking), <https://www.rfc-editor.org/rfc/rfc8288.html>
- Problem bodies — **RFC 9457**, <https://www.rfc-editor.org/rfc/rfc9457.html>
- Status codes and `Retry-After` — **RFC 9110**

Fetch each one before you ship the implementation and confirm the field value format. If you
cannot fetch them, say so and mark the syntax `confidence: medium`.

## Which header in which phase

| Phase | `Deprecation` | `Sunset` | `Link rel="deprecation"` | `Link rel="successor-version"` | Status |
|---|---|---|---|---|---|
| 1 Mark | yes | **no** | yes → policy page | yes, if the successor exists | normal |
| 2 Announce | yes | yes | yes | yes | normal |
| 3 Measure | yes | yes | yes | yes | normal |
| 4 Sunset | yes | yes | yes | yes | **410** |
| 5 Removed | — | — | — | — | 404 |

Emitting `Sunset` before you have a date you will honour is the most damaging mistake in this
process: consumers plan against it, and moving it teaches them to ignore you.

## Shape of the responses

Phase 2–3, a normal response from a deprecated resource:

```
HTTP/1.1 200 OK
Content-Type: application/json
Deprecation: <per RFC 9745 — the date the resource became deprecated>
Sunset: <an HTTP-date per RFC 8594, e.g. Wed, 31 Mar 2027 23:59:59 GMT>
Link: <https://api.example.test/deprecations/orders-v1>; rel="deprecation"; type="text/html"
Link: <https://api.example.test/v2/orders>; rel="successor-version"
```

Phase 4, after sunset:

```
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Sunset: Wed, 31 Mar 2027 23:59:59 GMT
Link: <https://api.example.test/v2/orders>; rel="successor-version"

{
  "type": "https://errors.example.test/resource-gone",
  "title": "This API version has been withdrawn",
  "status": 410,
  "detail": "GET /v1/orders was withdrawn on 2027-03-31. Use GET /v2/orders.",
  "instance": "/v1/orders",
  "successor": "https://api.example.test/v2/orders",
  "migrationGuide": "https://docs.example.test/migrate/orders-v1-to-v2"
}
```

410, not 404: 410 means "deliberately gone" and is actionable. 404 is indistinguishable from a
typo and generates support tickets instead of migrations.

## Spring implementation

A filter or interceptor keeps this out of every controller and makes it testable in one place.
Drive it from configuration, never from hardcoded dates.

```java
@Component
@ConfigurationProperties(prefix = "api.deprecation")
@Validated
public class DeprecationProperties {
    /** route pattern -> deprecation metadata */
    private Map<String, Entry> routes = Map.of();
    public record Entry(
            @NotNull LocalDate deprecatedOn,
            OffsetDateTime sunsetAt,        // null until phase 2
            @NotBlank String policyUri,
            String successorUri,
            boolean gone) {}
    // getters/setters omitted
}
```

```java
@Component
class DeprecationHeaderFilter extends OncePerRequestFilter {

    private final DeprecationProperties props;
    private final PathPatternParser parser = new PathPatternParser();

    DeprecationHeaderFilter(DeprecationProperties props) { this.props = props; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        props.matching(req.getRequestURI()).ifPresent(entry -> {
            res.setHeader("Deprecation", formatDeprecation(entry.deprecatedOn()));
            if (entry.sunsetAt() != null) {
                res.setHeader("Sunset", DateTimeFormatter.RFC_1123_DATE_TIME
                        .format(entry.sunsetAt().atZoneSameInstant(ZoneOffset.UTC)));
            }
            res.addHeader("Link", "<" + entry.policyUri() + ">; rel=\"deprecation\"; type=\"text/html\"");
            if (entry.successorUri() != null) {
                res.addHeader("Link", "<" + entry.successorUri() + ">; rel=\"successor-version\"");
            }
        });
        chain.doFilter(req, res);
    }
}
```

Notes:
- `formatDeprecation` must produce the field value defined by RFC 9745 — read the RFC and
  implement it there, in one method, with a unit test quoting the specification's example.
- Emit the headers on **every** response from the resource, including error responses. A client
  whose calls are failing is exactly the one who needs to see the successor link.
- The phase-4 "gone" behaviour is a separate concern: a flag-driven short-circuit that returns
  the 410 problem body **before** the controller runs.
- Do not put the sunset date in code. It goes in configuration so phase 4 is a flag flip, not a
  release.

## Tests to write

```java
@Test
void deprecated_endpoint_advertises_its_sunset_and_successor() throws Exception {
    mvc.perform(get("/v1/orders"))
       .andExpect(status().isOk())
       .andExpect(header().exists("Deprecation"))
       .andExpect(header().string("Sunset", "Wed, 31 Mar 2027 23:59:59 GMT"))
       .andExpect(header().stringValues("Link",
               hasItem(containsString("rel=\"successor-version\""))));
}

@Test
void marked_but_not_yet_announced_endpoint_does_not_advertise_a_sunset() throws Exception {
    mvc.perform(get("/v1/legacy"))
       .andExpect(header().exists("Deprecation"))
       .andExpect(header().doesNotExist("Sunset"));   // phase 1 discipline, enforced
}

@Test
void withdrawn_endpoint_returns_410_with_a_problem_body() throws Exception {
    mvc.perform(get("/v1/orders"))
       .andExpect(status().isGone())
       .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
       .andExpect(jsonPath("$.type").value("https://errors.example.test/resource-gone"))
       .andExpect(jsonPath("$.successor").exists());
}
```

Without these tests the headers silently stop being emitted after some future refactor, and
nobody notices until sunset day.

## Caching interaction

If the deprecated resource is cacheable, a cached response carries stale deprecation headers.
Either mark deprecated resources `Cache-Control: no-store` (simplest, and traffic on a
deprecated resource should be falling anyway) or ensure the max-age is much shorter than the
notice period. Add `Vary` correctly if you version by header or media type, or a shared cache
will serve one consumer another's version.

## OpenAPI

```yaml
paths:
  /v1/orders:
    get:
      deprecated: true
      summary: List orders (deprecated)
      description: |
        Deprecated on 2026-09-01. Sunset 2027-03-31.
        Use `GET /v2/orders`. Migration guide: https://docs.example.test/migrate/orders-v1-to-v2
```

`deprecated: true` propagates into every generated SDK and doc site — it is the highest-reach,
lowest-effort artefact in phase 1. Do it first.
