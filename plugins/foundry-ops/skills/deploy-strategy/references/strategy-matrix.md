# Strategy matrix

Three strategies, their preconditions, their real cost, and the specific way each one fails.
Choose by eliminating, not by preference.

---

## Rolling update

**Mechanism.** The Deployment controller creates pods from the new ReplicaSet and removes pods
from the old one, bounded by `maxSurge` (extra pods allowed above `replicas`) and
`maxUnavailable` (pods allowed below `replicas`).

**Preconditions**
- Both versions can serve simultaneously — for the entire duration of the rollout.
- Readiness genuinely reflects the ability to serve. A readiness probe that returns 200 from a
  broken build promotes the broken build to 100 %.

**Cost.** `maxSurge` extra pods for the duration. Effectively nothing.

**Failure modes**
1. **Mixed-version incompatibility.** This is not an edge case, it is the definition of the
   mechanism. Anything shared between versions must tolerate both: database schema, message
   formats, cache entry shapes, session payloads, published events. A rolling update of a service
   that changed a shared serialisation format is an incident with a slow fuse — it starts failing
   only for the fraction of requests that cross versions.
2. **Stall with no signal.** `maxUnavailable: 0` on a cluster with no spare capacity means new
   pods sit `Pending` forever and the rollout never completes. Without `progressDeadlineSeconds`,
   nothing ever tells you. Set it.
3. **Silent bad-build promotion.** Detection is only as good as the readiness probe. Add
   `minReadySeconds` so a pod that becomes Ready then immediately degrades is caught before the
   next batch starts.
4. **Redeploy 502s.** Endpoint removal and `SIGTERM` happen in parallel; without a `preStop`
   delay covering endpoint propagation, in-flight requests hit a pod that has already stopped
   serving.
5. **Slow rollback.** Rolling back is another rolling update — it takes roughly as long as the
   rollout did. If your rollout takes 12 minutes, so does your recovery.

**Use when** nothing forces you elsewhere. This is the correct default for most services.

---

## Blue-green

**Mechanism.** Two complete Deployments (`blue` = live, `green` = new). Green is deployed,
verified out-of-band, then traffic is switched atomically by changing the Service selector or
the ingress backend. Rollback is the same switch, reversed.

**Preconditions**
- Capacity for two full copies during the overlap window.
- A meaningful pre-switch verification: smoke tests against green through a separate,
  non-production-traffic route.

**Cost**
- **Double the compute** for the overlap window, plus double any per-pod licence footprint and
  double the connection-pool pressure on shared databases — that last one has taken down
  databases that were sized for one copy of the service.

**Failure modes**
1. **The database is not duplicated.** Blue-green gives an instant *application* rollback and no
   *data* rollback at all. A migration green applied is still applied after you switch back to
   blue. Expand/contract is therefore still mandatory, which means blue-green buys considerably
   less than its reputation suggests.
2. **Long-lived connections do not follow the switch.** WebSocket, gRPC streams and HTTP
   keep-alive connections stay on blue until they close. Plan the drain and state how long it
   takes; "instant" applies to new connections only.
3. **Sudden full-traffic exposure.** The new version goes from 0 % to 100 % in one step. A defect
   that only appears under production load appears everywhere at once. Blue-green is fast to
   *revert*, not gentle to *expose*.
4. **Warm-up.** Green has cold caches, cold JIT and empty connection pools at the instant it
   receives all the traffic. Pre-warm it or the switch itself causes a latency spike.
5. **Half-switched state.** If the switch spans several objects (Service, ingress, DNS), an
   error partway leaves traffic split unintentionally. Make the switch a single object change.

**Use when** you need an instant, single-operation reversal, you can pay double capacity, and
your traffic tolerates full exposure.

---

## Canary

**Mechanism.** A small weighted share of traffic goes to the new version. Metrics from the canary
are compared with the stable version's. The weight is increased in steps, or the rollout is
aborted automatically.

**Preconditions — all four, or it is not a canary**
1. A real **traffic splitter**: an ingress with weighted backends, a service mesh, or a
   progressive-delivery controller. Without one, "canary" is one pod in ten, which is a *replica*
   split, not a *traffic* split, and gives no control over exposure.
2. **Enough traffic** to reach a decision in a useful time (see the sample-size note below).
3. **Per-version metrics.** The version label must be on every metric and every log line.
4. **Automated analysis with an automatic abort.** A canary a human eyeballs at 02:00 is a
   rolling update with extra steps and worse ergonomics.

**Cost.** The controller and its operational learning curve, plus a longer rollout — often 30–60
minutes — during which two versions run and the schema must support both. The extra pods are
marginal; the extra *time* is the real cost, and it delays every subsequent release.

**Failure modes**
1. **Not enough traffic to decide.** At 5 % of a low-traffic service, distinguishing a small
   error-rate increase from noise takes hours. Compute this before choosing canary. If the
   analysis window has to exceed the rollout window you are willing to tolerate, canary is
   theatre — use blue-green with synthetic checks.
2. **Biased canary population.** Sticky sessions, client-side caching, CDN behaviour and
   geographic routing all pin subsets of users to one version. The canary group is then not a
   random sample and the comparison is invalid.
3. **Diluted metrics.** If dashboards aggregate across versions, the canary's errors are
   averaged with the stable pods' successes and a bad build looks fine. This is the most common
   reason canaries fail to catch anything.
4. **Wrong metric.** Comparing only HTTP 5xx misses a build that returns 200 with wrong data.
   Include a business signal (conversions, jobs completed) and latency percentiles, not just
   error rate.
5. **Slow-burn defects.** A memory leak or a connection leak does not appear within a 10-minute
   analysis window. Canary catches fast failures; it does not catch slow ones, and believing
   otherwise is how a leak reaches 100 % of traffic with full confidence behind it.
6. **Abort leaves a split.** An abort that fails partway can leave weights in an indeterminate
   state. Verify the post-abort weight explicitly, every time.

**Use when** all four preconditions hold. Otherwise say which one is missing and choose something
else.

---

## Sample-size reality check

Before choosing canary, answer: *at the canary weight and the current request rate, how long must
the analysis window be to distinguish the canary's error rate from the baseline, given the
baseline's variance?*

Inputs you already collected: requests per minute at trough, baseline error rate, and the
variability of that baseline across comparable windows. Compare that window against the rollout
duration the team will accept. If the required window is longer, canary cannot deliver its
promise. Write the number in the ADR — it converts an argument about preference into an argument
about arithmetic.

---

## Forward-only releases

Independent of strategy. A release is **forward-only** when it contains a destructive migration,
an irreversible external call, a consumed one-way event, or a notification already sent to users.

For a forward-only release:
- Redeploying the previous artefact does **not** restore the previous behaviour.
- The mitigation is a kill switch (feature flag) plus a prepared fix-forward patch.
- **If a release is forward-only and has no kill switch, it is not ready to promote.**
- Say so explicitly in the release notes and in the runbook. The worst outcome is an operator
  running the rollback procedure, watching it succeed, and still seeing the fault.

---

## What each strategy does NOT roll back

Identical in all three, and the source of most "we rolled back but it is still broken" incidents:

| Not rolled back | Why | What to do instead |
|---|---|---|
| Database schema and data | Migrations are applied, not versioned with the pod template | Expand/contract; restore from backup as a separate, rehearsed procedure |
| ConfigMaps and Secrets | Not part of the pod template unless hashed into it | Hash config content into a pod-template annotation |
| CRDs, ingress rules, HPA changes | Separate objects with separate lifecycles | Revert them explicitly, in the reverse order they were applied |
| Consumed messages / published events | Already read by consumers | Design consumers to tolerate replay; publish a compensating event |
| External side effects (emails, payments, webhooks) | Already left your system | Compensating action; there is no undo |
| Cache and CDN content | Populated by the bad version | Explicit invalidation, planned in advance |
