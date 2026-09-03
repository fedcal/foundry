# Load profile design

The tool matters far less than three decisions: the **executor model**, the **warm-up
exclusion**, and the **data cardinality**. Get those wrong and the numbers are confidently
false, which is worse than having none.

## Open vs closed model — the decision that invalidates most load tests

- **Closed model** (fixed virtual users looping with think time): each VU waits for its
  response before sending the next request. When the system slows, the VUs send *less* load.
  The system self-throttles and the test **cannot show you the collapse**.
- **Open model** (arrival rate): requests arrive at a defined rate regardless of how the
  system is coping. When the system slows, concurrency rises — exactly what real users do,
  because a real user's browser does not wait politely for your queue to drain.

Use the **open model** for anything user-facing. Use the closed model only when the client
population is genuinely fixed and self-limiting (a known set of batch workers, an internal
job runner with a bounded pool).

Practical consequence: with an arrival-rate executor you must pre-allocate enough virtual
users, and the run must **fail loudly** if the generator itself becomes the bottleneck.
Always check that the achieved rate matches the target rate; a test that quietly delivered
60 RPS instead of 120 measured nothing you can use.

## The four profiles

### Load — "do we meet the budget at expected peak?"
- Ramp to peak over 2 minutes, hold **≥ 15 minutes**. Shorter holds miss cache expiry,
  connection recycling and garbage-collection cycles.
- Peak comes from real traffic data: take the 99th percentile of the per-minute request rate
  from the last 90 days, not the average. Record where the number came from.
- Pass: p95 and p99 within budget, error rate < 0.1%, achieved rate = target rate.

### Stress — "where does it break, and how?"
- Ramp until failure, in steps, holding each step long enough to stabilise (2–3 minutes).
- The purpose is **not** a maximum RPS number for a slide. It is the failure *mode*:
  does the system shed load (429/503 with `Retry-After`) or does it collapse into timeouts
  and take its dependencies with it?
- Pass: graceful degradation, and full recovery within **≤ 5 minutes** after load drops.
  A system that stays broken after the load goes away has a queue or a pool it never drains,
  which is the mechanism behind most long outages.

### Soak — "do we leak?"
- **70% of peak for ≥ 4 hours** (12 hours before a major event). Most leaks are invisible
  below one hour.
- Watch: RSS/heap after warm-up, p99 drift, open file descriptors, connection pool checkouts,
  goroutine/thread count, and database temporary space.
- Pass: memory growth **< 5%** after the first 30 minutes, flat p99, no monotonic resource growth.

### Spike — "do we survive a step change?"
- 1× → 5× within **< 30 seconds**, hold 5 minutes, drop back.
- Watch: autoscaler reaction time against its stated window, queue depth and drain time,
  cold-start latency, circuit breakers, connection storms against the database.
- Pass: no cascading failure, and the queue drains within the SLO window afterwards.

## Warm-up

Always discard the first **2 minutes**: JIT compilation, connection pool fill, cache
population and lazy initialisation make early requests unrepresentative. Report the warm-up
separately when cold-start latency matters (serverless, scale-from-zero) — there it is the
number that matters, not noise to be discarded.

## Data cardinality — the silent invalidator

A load test where 10 000 virtual users request the same product id measures your cache, and
will report a p95 an order of magnitude better than production.

Rules:
- Draw ids from a **realistic distribution**, not uniformly random and not a constant.
  Most real traffic is Zipf-like: a small head of very popular items and a long tail.
- Dataset size must be **production-scale**. Query plans change between 10^3 and 10^7 rows,
  so a plan validated on a small dataset can be the opposite of the one production chooses.
- Include the **write mix**. A read-only load test on a read-write system tells you nothing
  about lock contention, which is where the non-linear collapse usually comes from.
- Vary payload sizes across the real range; the p99 is often driven by the largest 1%.

## Environment fidelity

State the ratio to production and what it invalidates:

- **Valid to extrapolate**: CPU-bound work, roughly linear in instance count.
- **Invalid to extrapolate**: anything crossing a queueing knee, shared dependencies
  (a database sized for production behaves nothing like one sized for staging), cache hit
  ratios, and network topology effects.

If you must test at 1/10 scale, test the *shape* (does latency stay flat as load rises?) and
be explicit that the absolute numbers do not transfer. Writing "measured at 1/10 scale;
absolute values not transferable" next to the result is what keeps someone from quoting it
in a capacity plan six months later.

## Thresholds live in the test

Put pass/fail conditions in the test file so a run is self-judging and exits non-zero on its
own. A run whose interpretation depends on a human reading a chart will be interpreted
optimistically.
