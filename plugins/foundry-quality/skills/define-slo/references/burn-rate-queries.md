# Burn-rate recording and alerting rules

Shapes for a Prometheus-compatible backend. Adapt the metric names to whatever
`observability-engineer` actually instrumented — and **verify the attribute names against the
OpenTelemetry semantic convention version vendored in your repository**, because HTTP
attribute names have changed across versions.

## Step 1 — recording rules for the SLI ratio

Computing a 72-hour ratio at query time on raw counters is expensive and makes the alert
evaluation slow enough to miss its own deadline. Precompute one ratio per window.

```yaml
groups:
  - name: slo:checkout:recording
    interval: 30s
    rules:
      # good = served AND under the latency threshold. Availability and latency are one SLI:
      # a 30-second response is an outage to the user, not a slow success.
      - record: slo:checkout:good_ratio_rate5m
        expr: |
          (
            sum(rate(http_server_request_duration_seconds_bucket{
                  job="billing-api", http_route="/checkout", le="0.5",
                  http_response_status_code!~"5.."}[5m]))
          )
          /
          sum(rate(http_server_request_duration_seconds_count{
                job="billing-api", http_route="/checkout"}[5m]))

      - record: slo:checkout:bad_ratio_rate5m
        expr: 1 - slo:checkout:good_ratio_rate5m

      # one recording rule per window used by the alerts
      - record: slo:checkout:bad_ratio_rate1h
        expr: 1 - ( ... same expression with [1h] ... )
      - record: slo:checkout:bad_ratio_rate6h
        expr: 1 - ( ... [6h] ... )
      - record: slo:checkout:bad_ratio_rate24h
        expr: 1 - ( ... [24h] ... )
      - record: slo:checkout:bad_ratio_rate72h
        expr: 1 - ( ... [72h] ... )
      # volume guard: never alert on a window with too few events
      - record: slo:checkout:events_rate5m
        expr: sum(rate(http_server_request_duration_seconds_count{job="billing-api", http_route="/checkout"}[5m])) * 300
```

Note the histogram bucket boundary: `le="0.5"` only works if **0.5 s is an actual bucket
boundary**. Default histogram buckets frequently have nothing between 0.1 s and 1 s — exactly
where most latency thresholds live. Set explicit buckets covering your threshold, or the SLI
silently measures the wrong number.

## Step 2 — alerting rules

`0.001` below is `1 - 0.999`, the error budget ratio for a 99.9% SLO. Keep it in one place;
a hardcoded threshold copied into four rules will drift.

```yaml
groups:
  - name: slo:checkout:alerts
    rules:
      - alert: CheckoutErrorBudgetBurnFast
        expr: |
          (
            slo:checkout:bad_ratio_rate1h  > (14.4 * 0.001)
            and
            slo:checkout:bad_ratio_rate5m  > (14.4 * 0.001)
          )
          and slo:checkout:events_rate5m >= 100
        for: 2m
        labels:
          severity: page
          slo: checkout-availability
        annotations:
          summary: "Checkout is burning the error budget 14.4x — 2% of the 28-day budget per hour"
          detection: "worst case 1h; a 10x burn is caught in ~6m"
          runbook: ".foundry/runbooks/checkout-availability.md"
          dashboard: "<url>"

      - alert: CheckoutErrorBudgetBurnMedium
        expr: |
          (
            slo:checkout:bad_ratio_rate6h  > (6 * 0.001)
            and
            slo:checkout:bad_ratio_rate30m > (6 * 0.001)
          )
          and slo:checkout:events_rate5m >= 100
        for: 5m
        labels: { severity: page, slo: checkout-availability }
        annotations:
          runbook: ".foundry/runbooks/checkout-availability.md"

      - alert: CheckoutErrorBudgetBurnSlow
        expr: |
          slo:checkout:bad_ratio_rate24h > (3 * 0.001)
          and slo:checkout:bad_ratio_rate2h > (3 * 0.001)
        for: 15m
        labels: { severity: ticket, slo: checkout-availability }
        annotations:
          runbook: ".foundry/runbooks/checkout-availability.md"
```

## Pitfalls that make burn-rate alerting fail in practice

1. **Keeping the old raw-threshold alerts.** The single most common failure. Two alerts for
   one symptom double the noise; the rotation mutes both. Delete them in the same change.
2. **A `for:` duration that fights the short window.** The short window already suppresses
   transient burns. A long `for:` on top adds latency to the page for no benefit — keep it at
   2–5 minutes.
3. **Missing volume guard.** Without `events_rate5m >= 100`, a quiet night pages you on one
   failed request.
4. **Wrong histogram buckets**, so the latency part of the SLI is measured against a boundary
   that does not exist. Verify the bucket list before trusting the ratio.
5. **`rate()` over a window shorter than 4 scrape intervals.** With a 30 s scrape,
   `rate(...[5m])` is fine; `rate(...[1m])` is noise.
6. **Counter resets on deploy** handled incorrectly. `rate()` handles resets; `increase()` over
   long windows across restarts is less forgiving. Prefer `rate()` × window length.
7. **Alerting on the SLI of a service instead of a journey.** A per-pod alert pages for a
   condition the load balancer already routed around.
8. **No runbook link in the annotation.** Enforce it: an alert without a `runbook` annotation
   fails the config lint. Check `runbook_list` before writing a new one.
9. **Never testing the alert.** Inject a failure in a staging environment quarterly and
   confirm the page arrives at the right rotation. An untested alert is assumed broken.

## Multi-service journeys

When a journey spans several services, define the SLI **once at the journey boundary**
(the ingress the user actually hits) rather than combining per-service SLIs. Combining them
produces a number nobody can act on, because a burn cannot be attributed to a service.
Per-service SLOs are useful as internal contracts *between teams*; they are not the journey SLO.
