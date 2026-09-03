# Post-release verification

Deployment finished is not release succeeded. This is the window in which you find out.

**Define the window, the metrics and the abort thresholds *before* promoting.** Deciding what
"normal" looks like while staring at a spiking graph is how bad releases stay in production.

---

## The window

| Workload | Window | Why |
|---|---|---|
| Web service, steady traffic | **30 min** | Covers at least one full traffic cycle for the affected path |
| Low-traffic service | until `<N>` requests have exercised the changed path | Time is the wrong unit when volume is the constraint |
| Nightly batch | one full run | Nothing is proven until it has run once |
| Event consumer | until the backlog has drained and one steady-state period has passed | Backlog masks throughput regressions |
| Anything with a cache warm-up | window + warm-up period | Early numbers reflect cold caches, not the release |

Do not shorten the window because the release looks fine. Slow-burn failures — memory leaks,
connection-pool exhaustion, unbounded queues — appear after the window most teams choose.

---

## What to measure

Compare against the **pre-release baseline for the same window length**, not against an absolute
threshold. An absolute "error rate below 1 %" hides a jump from 0.02 % to 0.9 %, which is a
45-fold regression.

| Signal | Query shape | Abort when |
|---|---|---|
| Error rate | `sum(rate(http_requests_total{status=~"5.."}[<W>])) / sum(rate(http_requests_total[<W>]))` | above `<BASELINE> + <MARGIN>` |
| p95 / p99 latency | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[<W>])) by (le))` | ratio to baseline above `<MAX-RATIO>` |
| Saturation | CPU throttling, memory working set, connection pool in use, queue depth | trending toward a limit |
| **Business signal** | `<CHECKOUTS \| SIGNUPS \| JOBS-COMPLETED>` | below `<FLOOR>` |
| New error signatures | count of log signatures not seen in the previous `<PERIOD>` | any novel signature above `<N>` occurrences |
| Client-side errors | 4xx rate, JS error rate | above baseline |
| Dependency health | error rate and latency of downstream calls | your release may be hurting someone else |

**The business signal is the one that catches the failures the technical metrics miss.** A build
returning HTTP 200 with wrong data has a perfect error rate. If the funnel stopped, the release
failed, whatever the dashboards say.

**Novel error signatures matter even at a low rate.** A brand-new stack trace occurring five times
is more informative than a familiar one occurring five hundred times.

---

## Smoke tests

Automated, run immediately after promotion, hitting **real user paths** end to end — not `/health`,
which proves only that the process started.

```bash
set -euo pipefail
for i in $(seq 1 <ATTEMPTS>); do
  if curl -fsS --max-time 10 "<CRITICAL-PATH-URL>" | grep -q '<EXPECTED-MARKER>'; then
    echo "smoke ok on attempt $i"; exit 0
  fi
  sleep <INTERVAL>
done
echo "smoke failed"; exit 1
```

Include at least one path that exercises a write, a read-after-write, and an authenticated
request. A read-only smoke test passes happily while every write fails.

---

## The decision

**If any threshold breaches, roll back. Do not debate, do not debug in front of users.**

- The rollback command and its measured duration are already in the release notes.
- The person on call has authority to trigger it without escalation. A rollback delayed by an
  approval chain is the expensive kind.
- Diagnose after service is restored. The evidence — logs, metrics, traces, the bad digest — is
  still there afterwards.

The one exception: if the release is **forward-only**, the rollback does nothing. Use the kill
switch and the prepared fix-forward patch. This is exactly why the classification is mandatory
before promotion.

---

## After the window

- [ ] Record the actual numbers in the release notes, not "looked fine".
- [ ] Compare with the previous release's numbers — a slow drift across releases is invisible in
      any single window.
- [ ] Close or extend the feature flags introduced by this release.
- [ ] Update `.foundry/runbooks/release-train.md` with anything that surprised you.
- [ ] Set the `handoff.v1` `status` from the **verification result**, not from optimism:
      `complete` only if every threshold held.

---

## Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Absolute thresholds with no baseline | A 45× regression that is still "under 1 %" passes |
| Watching only error rate | A build returning 200 with wrong data passes |
| Window shorter than the traffic cycle | The peak that breaks it happens after you stopped looking |
| `/health` as the smoke test | Proves the process started, nothing more |
| Read-only smoke tests | Every write can be failing |
| Verification by human eyeball with no thresholds | Nobody agrees afterwards on whether it was fine |
| Debugging before rolling back | Users pay for the diagnosis |
| Declaring success while the flag is still off | Nothing was actually released |
