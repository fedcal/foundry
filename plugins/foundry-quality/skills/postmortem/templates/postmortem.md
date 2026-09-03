# Postmortem — <INC-ID> <short title>

| Field | Value |
|---|---|
| Severity | SEV<1\|2\|3> |
| Impact window (UTC) | <start> → <end> |
| Users affected | <number or share, and how it was counted> |
| Journeys affected | <journey names from docs/slo/> |
| Error budget consumed | <minutes> of <budget minutes> (<percent>%) |
| Author | <name> |
| Reviewers | <names, including one from outside the team> |
| Published | <date> |
| Status | draft \| reviewed \| actions-tracked \| closed |

## 1. What happened (5 sentences, for someone who was not there)

<Plain narrative. What broke, for whom, for how long, how it was stopped. No jargon,
no blame, no speculation.>

## 2. Customer impact

- What could users not do:
- How many, and how that number was obtained:
- Was data lost or corrupted? Is it recoverable? Has it been recovered?
- Was anyone notified externally? When?

## 3. Timeline (UTC, ISO 8601, facts only)

| Time | Event | Source |
|---|---|---|
| | | |

Mark reconstructed rows `source: recollection`.

## 4. Detection and response metrics

| Metric | Value | Target | Gap owner |
|---|---|---|---|
| Time to detect | | ≤ 5 m | |
| Time to acknowledge | | ≤ 5 m | |
| Time to mitigate | | ≤ 15 m | |
| Time to resolve | | | |
| Pages generated | | ≤ 3 | |

## 5. Contributing factors

At least three, across at least three categories. Each must pass the counterfactual test:
*if this had been different, would the incident have been prevented or materially shorter?*

### 5.1 Trigger
### 5.2 Latent condition
### 5.3 Detection
### 5.4 Diagnosis
### 5.5 Mitigation
### 5.6 Blast radius
### 5.7 Process / organisational

## 6. What went well

Name it explicitly — these are the practices to protect when budgets get cut.

## 7. Where we got lucky

The near-misses inside the incident. These become the highest-priority actions, because next
time the luck is not there.

## 8. Actions

| # | Action | Class | Owner (person) | Due date | Tracker | Status |
|---|---|---|---|---|---|---|
| 1 | | prevention | | | | open |
| 2 | | detection | | | | open |
| 3 | | mitigation | | | | open |

Classes: `prevention`, `detection`, `mitigation`, `blast-radius`, `process`.
At least one `prevention` and one `detection`. SEV1 also requires one `mitigation`.

## 9. Runbook

Created/updated: `.foundry/runbooks/<slug>.md`
Linked from alert: `<alert name>`

## 10. Related

- Previous postmortems for the same class: <ids, or "none">
- SLO document: `docs/slo/<journey>.md`
- Findings filed: <finding ids>
