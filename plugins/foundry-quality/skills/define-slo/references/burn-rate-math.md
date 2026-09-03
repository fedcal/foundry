# Burn-rate alerting — the arithmetic, worked

Loaded on demand by the `define-slo` skill. Everything here is derivable; verify it against your
own window rather than copying the tables.

## Definitions

```
error_budget          = 1 - SLO_target                      # as a ratio, e.g. 0.001 for 99.9%
burn_rate             = observed_error_ratio / error_budget
time_to_exhaustion    = window_length / burn_rate
budget_consumed(alert)= burn_rate x (alert_window / SLO_window)
```

A burn rate of 1 exhausts the budget exactly at the end of the window. A burn rate of 14.4
exhausts a 28-day budget in `28 / 14.4 = 1.94` days.

## Why 14.4 and 6

They are chosen so that the alert fires after a **fixed fraction of the budget** has been spent,
independent of the SLO target. With a 28-day window (672 hours):

| Burn rate | Long window | Budget consumed when it fires | Time to exhaustion |
|---|---|---|---|
| 14.4x | 1 h | 14.4 x (1/672) = **2.14%** | 1.9 days |
| 6x | 6 h | 6 x (6/672) = **5.36%** | 4.7 days |
| 3x | 24 h | 3 x (24/672) = **10.7%** | 9.3 days |
| 1x | 72 h | 1 x (72/672) = **10.7%** | 28 days |

2% of the budget is a reasonable price for a page: fast enough to matter, expensive enough to be
believed. If your organisation tolerates less, raise the burn rate and shorten the window — but
recompute, do not guess.

## Why the paired short window matters

Without it, an alert evaluated over a 1-hour window keeps firing for up to an hour after the
incident ends, because the window still contains the bad minutes. On-call learns that the alert
lies about the present tense and starts silencing it.

The standard pairing is **short = long / 12**:

| Long | Short |
|---|---|
| 1 h | 5 m |
| 6 h | 30 m |
| 24 h | 2 h |
| 72 h | 6 h |

Alert condition:

```
burn_rate(long_window) > threshold  AND  burn_rate(short_window) > threshold
```

The short window makes the alert resolve promptly; the long window keeps it from firing on a
30-second blip.

## Worked example: 99.9% availability, 28-day window

```
error_budget = 0.001
budget_minutes = 40320 x 0.001 = 40.32 minutes
```

Fast tier: fires when the error ratio over the last hour exceeds `14.4 x 0.001 = 1.44%` **and**
the error ratio over the last 5 minutes also exceeds 1.44%. At that rate the budget is gone in
about 47 hours, and roughly 0.86 minutes of the 40.32 have been spent when it fires.

Medium tier: fires at `6 x 0.001 = 0.6%` sustained over 6 hours with the last 30 minutes also
above 0.6%. About 2.2 minutes of budget spent.

## Latency SLOs burn the same way

For a latency SLI expressed as a threshold ratio ("99% of requests under 800 ms"), the "error"
is a request **slower than the threshold**. Everything above applies unchanged. This is the main
practical reason to prefer the threshold-ratio form over a percentile: a percentile has no error
budget, so it has no burn rate, so it cannot drive this alerting design at all.

## Multiple SLOs on one journey

If a journey has both an availability and a latency SLO, alert on each separately. Do **not**
combine them into a single composite score — when a composite fires, nobody knows which half
broke, and the runbook cannot branch.

## Choosing the window length

| Window | Suits | Cost |
|---|---|---|
| 7 days | fast-moving products, weekly planning cadence | noisy; one bad hour is a large fraction |
| 28 days | the default; aligns with 4 sprints, avoids variable month lengths | — |
| 30 days / calendar month | matches finance and SLA reporting | month lengths differ, so budgets differ month to month |
| 90 days | very stable infrastructure | too slow to change behaviour |

Rolling windows are preferable to calendar windows: a calendar window resets the budget on the
1st, which invites end-of-month risk-taking and a quiet reset of an unresolved problem.

## Sanity checks before you ship the alerts

1. **Simulate.** Replay the last real incident against the proposed conditions. Does the fast
   tier fire? How long after onset? If it would not have fired, the thresholds are wrong.
2. **Count expected pages.** Replay the last 90 days. More than ~2 pages per 12-hour shift on
   average means the service or the alerting needs work before this goes live.
3. **Check resolution.** Confirm the alert clears within one short-window length of recovery.
4. **Check the composed floor.** If your dependency floor is below your target, the fast tier
   will page for other people's outages. Either the target is wrong or the runbook must say
   "escalate to vendor" as step one.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Alerting on the raw error ratio with a fixed threshold | fires on traffic peaks, silent during quiet-hour outages |
| Omitting the short window | the alert lies about the present, gets silenced |
| Paging on all four tiers | pager fatigue; the slow tiers are tickets by design |
| Copying the windows without recomputing for a non-28-day SLO window | the budget-consumed fractions are wrong |
| Alerting per component instead of per journey | six pages, one incident |
| Excluding "planned maintenance" from valid events without a policy | the SLO stops representing the user experience |
