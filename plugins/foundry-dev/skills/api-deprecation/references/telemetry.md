# Usage telemetry for a deprecation

The measurement is what makes a deprecation a process instead of a gamble. You cannot remove
what you cannot prove is unused, and "we announced it" is not proof.

## The three questions

For every deprecated resource you must be able to answer, at any moment:

1. **Who** is still calling it — by identity, not by IP.
2. **How much** — requests over the last 1, 7 and 30 days.
3. **Which way is it going** — falling, flat, or rising.

Flat traffic near the sunset date means the announcement did not reach anyone. Rising traffic
means someone is *still building new integrations* against it, and the discovery path (docs,
SDK, developer portal) is the actual defect.

## Identity, not IP

Tag by something that maps to a human you can contact, in this order of preference:

1. OAuth 2 client id / API key id — authoritative, already authenticated.
2. A mandated `User-Agent` with a product token (`acme-billing/3.4`) — document it as required.
3. A registered `X-Client-Id`-style header — weakest; unauthenticated callers can lie.

**An unidentified caller counts as in use.** If a meaningful share of traffic is unattributable,
the first deliverable is identification (require a client id), not removal. Removing while
blind is how you discover a consumer during an incident.

Cardinality warning: never tag a metric with a raw user id, a tenant id in a large fleet, or a
full `User-Agent` string. That is an unbounded label set and it will take down your metrics
backend. Map to a bounded set of registered client ids and bucket the rest as `unknown`.

## Spring implementation

Micrometer, one counter, incremented from the same filter that emits the headers.

```java
@Component
class DeprecationUsageFilter extends OncePerRequestFilter {

    private final MeterRegistry meters;
    private final DeprecationProperties props;
    private final ClientIdentityResolver identity;   // bounded set + "unknown"

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        props.matching(req.getRequestURI()).ifPresent(entry ->
            Counter.builder("api.deprecated.requests")
                   .tag("route", entry.routeId())          // bounded: the pattern, not the URI
                   .tag("api_version", entry.apiVersion())
                   .tag("client", identity.resolve(req))   // bounded registry, else "unknown"
                   .register(meters)
                   .increment());
        chain.doFilter(req, res);
    }
}
```

Tag with the **route pattern** (`/v1/orders/{id}`), never the raw URI — raw URIs are unbounded
cardinality.

Deprecated **fields** are harder: the request does not tell you which response fields the
consumer reads. Options, in order of reliability:
- If the API supports sparse fieldsets (`?fields=`), count field requests directly.
- Count usage of the *input* that only exists to feed the deprecated field.
- Otherwise, telemetry cannot answer it. Fall back on contract tests (which record exactly what
  each consumer reads) and, for the rest, an announced brownout.

## Queries

```bash
# is anything still calling it right now?
curl -s 'localhost:8080/actuator/metrics/api.deprecated.requests?tag=route:/v1/orders'

# per-client breakdown, Prometheus
# sum by (client) (increase(api_deprecated_requests_total{route="/v1/orders"}[30d]))

# last seen per client
# max by (client) (timestamp(api_deprecated_requests_total{route="/v1/orders"} > 0))
```

Retention matters: if your metrics backend keeps 15 days and your window is two quarters, you
cannot answer the 30-day question at the gate. Check retention **in phase 1**, and if it is too
short, also write a daily rollup to a table you control.

Access-log fallback, when no metrics backend exists:

```bash
# per-day request count for the deprecated route
zcat access-*.log.gz | grep ' /v1/orders' | awk '{print $4}' | cut -d: -f1 | sort | uniq -c
```

Crude, but it is real data and it beats an opinion.

## The gate

Removal is permitted only when, for a full 30 days:

- total requests == 0, **and**
- unidentified-client requests == 0, **and**
- every consumer that ever appeared has confirmed migration in writing or has an agreed
  extension with a new date.

"Low" is not "zero". A resource at 0.01 % of traffic is still one customer's production system.

## The consumer-facing dashboard

Give each consumer a view of **their own** usage of deprecated resources. This is the single
highest-leverage artefact in the whole cycle: it turns "we never got the email" into a shared,
checkable fact, and it lets a consumer verify their own migration is complete without asking
you.

## Brownouts

For public APIs with a long tail of unreachable consumers, a **brownout** — returning 410 for a
short, pre-announced window (start with minutes, repeat with longer windows) some weeks before
sunset — surfaces the consumers who read nothing. It works because it produces a support
ticket, which is a contact.

Rules: announce every brownout in advance with exact times; never brownout a payment, safety or
regulatory path; never brownout without the ability to abort within minutes; publish the result.

## Record the outcome

When the cycle finishes, write a `metric` fact via `memory_write`: the window length, the
number of consumers at announcement, the number still calling at each gate, and how long the
tail actually took. The next deprecation window is planned from that number rather than from a
policy someone guessed. Most organisations discover their real tail is longer than their policy.
