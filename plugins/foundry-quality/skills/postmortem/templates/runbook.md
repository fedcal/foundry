---
slug: <kebab-case-symptom>
title: <symptom as an on-call engineer sees it, not as a cause>
severity: SEV1 | SEV2 | SEV3
owner: <person>
alert: <alert name that links here>
lastVerified: YYYY-MM-DD
lastIncident: <INC-ID>
---

# <Symptom>

## What this means

<One paragraph. What the alert is telling you about the user experience — not about a
metric. Include what is NOT wrong, so time is not spent ruling it out.>

## First three commands

Run these before doing anything else. They are ordered so that the cheapest,
highest-information check is first.

```bash
1. <command>   # what it tells you
2. <command>   # what it tells you
3. <command>   # what it tells you
```

## Mitigate first, understand later

The user comes back before you know why. Options, in order of preference and with the
measured time each takes:

| Option | Command | Time to effect | Side effects |
|---|---|---|---|
| Roll back | | | |
| Fail over | | | |
| Shed load / rate limit | | | |
| Disable feature flag | | | |

State the decision rule: <when to choose which>.

## Common causes and their fixes

| Signature | Cause | Fix |
|---|---|---|
| | | |

## Escalation

| When | Who | How |
|---|---|---|
| Not mitigated within <N> minutes | <role/person> | <channel> |
| Data loss suspected | <role/person> | <channel> |
| Vendor involved | <vendor + support tier + ticket URL> | |

## Verify recovery

```bash
<command that proves the user-visible symptom is gone — not that the process restarted>
```

Do not close the incident until this returns the expected result twice, <N> minutes apart.

## Known false positives

<Conditions under which this alert fires without user impact. If this list is not empty,
the alert needs work — file it.>

## What this runbook does NOT cover

<Explicit boundary, so the reader escalates instead of improvising.>
