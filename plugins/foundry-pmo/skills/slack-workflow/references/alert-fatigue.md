# Alert fatigue — measure it, then cut in order

Nobody wins the argument "this channel is too noisy" by asserting it. Measure three rates, then
cut in an order that removes volume before it touches thresholds.

## The three measurements

Over the last 30 days, with `channels:history` granted for this audit only.

**Action rate** — the headline number.

```
(messages with a reply) + (messages with a reaction) + (messages with a thread)
--------------------------------------------------------------------------- 
                          total messages
```

Below roughly 10%, the channel is being scrolled past rather than read. At that point the alerts
are not informing anyone; they are producing an audit trail with a notification cost.

**Duplication rate** — messages whose text differs only by an identifier, a count or a timestamp.
High duplication means an alert fires per item where it should batch. This is almost always the
largest single source of volume, and the cheapest to fix.

**Out-of-hours rate** — non-incident messages outside the team's working hours. Every one spent
attention at a moment when nothing could be done about it. A high rate here is what converts
notification fatigue into people muting the workspace, after which nothing reaches them.

Report each with its raw counts, not just the percentage. "11 of 940" and "11 of 14" are very
different problems wearing the same rate.

## Cut in this order

The order matters: each step removes volume without needing agreement about what is important,
which is the argument that stalls threshold tuning.

1. **Suppress recoveries of self-healing alerts.** If the system fixed itself and nobody acted,
   both the alert and its recovery were noise. Typically removes 20–40% of volume with no
   information loss.
2. **Batch per-item notifications into a digest.** Forty build results become one message with
   the three failures listed. Requires no judgement about severity.
3. **Delete alerts whose runbook says "no action".** If the documented response is to observe,
   it belongs in a dashboard. If there is no runbook at all, that is the finding — an alert
   nobody knows how to act on is noise wearing a severity label.
4. **Split alerts from discussion** if they still share a channel.
5. **Only now, tune thresholds.** Doing this first treats the symptom, takes the longest, and
   requires the most argument per unit of volume removed.

## What to check before adding any new alert

Three questions, all of which must pass:

- **Can a human act on it?** If the action is "nothing", it is a dashboard entry.
- **Will the right human see it?** Posting into a channel the owner does not watch is theatre.
- **Is it derivable from the previous message?** A recovery following a self-healing alert is
  derivable. An unexpected state change is not.

## Severity that means something

Three levels, distinguished by what they interrupt:

| Level | Interrupts | Channel |
|---|---|---|
| page | a person, including at night | paging system, not Slack |
| alert | the working day | `#alerts-<service>` |
| record | nothing; read when looking | dashboard or digest |

Slack is the middle tier. Using it as a paging system means relying on notification settings
nobody has verified, and it fails exactly during an incident, when the person is already
overwhelmed by the channel.

## Reporting the result

Emit each surviving problem as `finding.v1` with the measured rate as evidence, and hand
threshold work to `foundry-quality:sre-planner` — this skill decides how an alert reaches a
human, not when it should fire.

## The failure to avoid

Do not fix alert fatigue by muting the channel or lowering severity across the board. Both make
the volume invisible rather than lower, and the next real alert arrives into a channel everyone
has already learned to ignore.
