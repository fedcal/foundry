# Measurement pitfalls that make performance numbers wrong

Loaded on demand by the `perf-budget` skill. Each of these produces a number that looks
authoritative and is not. Check them before quoting anything.

## 1. Coordinated omission

A closed-model generator sends the next request only after the previous response arrives. When
the system slows down, the generator slows down with it — so the requests that would have queued
during the slowdown are never sent, and the recorded latency is far better than what a real user
population would experience. The error is largest exactly when the system is worst.

**Symptom.** Your p99 looks fine while users complain. Throughput drops but latency barely moves.

**Fix.** Use an open model: a fixed arrival rate independent of response times. If your tool only
offers a closed model, say so in the finding and treat the p99 as a lower bound, not a value.

## 2. Averaging percentiles

`p99` is not a quantity you can average. Taking the mean of per-instance p99s, or of per-minute
p99s, produces a number with no statistical meaning — usually optimistic.

**Fix.** Merge histograms and compute the quantile once over the merged distribution. If your
backend cannot merge, report the **maximum** of the per-shard p99s as a conservative bound and
label it as such.

## 3. Histogram buckets that do not bracket the threshold

Percentiles from a histogram are interpolated within a bucket. If your SLO threshold is 300 ms
and the buckets jump from 250 ms to 500 ms, your "p99 = 300 ms" is an artefact of interpolation.

**Fix.** Place an explicit bucket boundary at every threshold you will ever gate on. Do this
before you need the number; changing buckets later invalidates the history.

## 4. Warm-up counted as steady state

JIT compilation, connection pool fill, cache population, lazy class loading and autoscaler
reaction all happen in the first seconds. Including them makes an improvement look like a
regression and vice versa.

**Fix.** Discard a stated warm-up window (60 s is a reasonable default; verify by plotting the
first two minutes and finding where it flattens). Record the discarded length with the result.

## 5. Unrepresentative data volume

A query against 10 000 rows and the same query against 10 000 000 rows are different queries: one
uses an index scan, the other may not, and the planner switches strategy at thresholds you did
not choose. This is the most common escape from load testing.

**Fix.** Match production **cardinality**, not just row count — the distribution matters as much
as the size. A table with 10M rows all belonging to one tenant behaves nothing like 10M rows
across 10k tenants.

## 6. The environment ratio fallacy

A quarter-sized environment extrapolates reasonably for throughput and badly for latency tails,
and not at all when a shared database is involved. "We ran at 25% scale and multiplied by four"
is not a capacity model.

**Fix.** State the ratio in every finding. Use the quarter-size result for throughput shape and
saturation ordering; refuse to quote a production p99 from it.

## 7. Little's Law violation

`concurrency = throughput x latency`. If your tool reports 100 concurrent users, 50 rps and
200 ms latency, then 50 x 0.2 = 10, not 100 — the numbers are inconsistent and at least one is
measuring something other than what you think (often the generator is the bottleneck).

**Fix.** Apply the check to every load result before quoting it. When it fails, suspect the
generator first: a saturated load generator reports its own queueing as your latency.

## 8. Missing the error path

All-dependencies-healthy load tests say little about an incident. Retries against a slow
dependency amplify load exactly when the system can least afford it, turning a degradation into
an outage.

**Fix.** Run at least one scenario with an injected +500 ms dependency latency and one with a
dependency returning errors. Record whether retry amplification appears; if it does, that is a
`critical` finding independent of your headroom.

## 9. Comparing against a single previous run

Single-run comparison in CI is dominated by runner variance. It produces false alarms, the team
starts re-running, and the gate dies.

**Fix.** Compare against the median of the last 7 runs, with a tolerance derived from the
measured noise floor.

## 10. Amdahl's ceiling ignored

Optimising a component responsible for 20% of the time caps the total improvement at 20%, no
matter how good the optimisation. Effort estimates that ignore this promise improvements that are
arithmetically impossible.

**Fix.** Compute the ceiling before estimating effort:
`max_speedup = 1 / (1 - fraction_optimised)`. Refuse work whose ceiling is below the budget gap
and say why.

## Reporting template

Every performance number you publish carries all of this, or it is not admissible:

```
metric      : p99 latency
value       : 1840 ms
workload    : 300 rps open model, 70/30 read/write, 5M rows, warm cache
window      : 30 min steady state, first 60 s discarded
point       : application server-side, excluding client network
environment : staging, 4 instances (production has 16) — ratio 1:4
build       : a1b2c3d
run         : 2026-08-27T09:12Z, run 3 of 5, median reported
percentile  : merged histogram, bucket boundary present at 300 ms and 2000 ms
```
