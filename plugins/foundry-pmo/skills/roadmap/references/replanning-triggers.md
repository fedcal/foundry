# Re-planning triggers

A roadmap without triggers gets revised when someone feels uncomfortable. A roadmap with
triggers gets revised when a measurement crosses a line that was agreed in advance, by people
who were not yet under pressure.

## Rules for a good trigger

1. **Observable** — a query, a metric, an event someone will notice without looking for it.
2. **Thresholded** — a number, or a binary event. "Significant slippage" is not a trigger.
3. **Owned** — someone is responsible for noticing. Preferably an automated check.
4. **Paired with a response** — what happens next, and who decides.
5. **Agreed before it fires** — thresholds set with the sponsor, recorded as a `fact.v1` of
   type `decision`. Setting them after the fact is negotiating, not planning.

## Default catalogue

Tune the numbers with the sponsor; do not ship the defaults unexamined.

### Schedule

| Trigger | Threshold | Detection | Response |
|---|---|---|---|
| Milestone demand exceeds capacity | remaining work > remaining capacity by 20%, two consecutive periods | burn-up scope vs. done lines | re-sequence; move lowest value-density scope to `outOfScope` |
| Critical path grows | expected critical path +15% vs. baseline | recompute at each review | re-plan the affected milestones; report the new range |
| Completion rate collapses | 3-period mean rate below 50% of the baseline rate | `status-report` burn-up | investigate cause before re-planning — a rate drop is a symptom |
| Committed external date at risk | p80 forecast exceeds the committed date | forecast in every status report | escalate immediately; do not wait for certainty |

### Scope

| Trigger | Threshold | Detection | Response |
|---|---|---|---|
| Scope creep | cumulative added scope > 10% of the milestone's baseline expected hours | issues added to the milestone after baseline | full roadmap revision, new `plan.v1` |
| Requirement churn | > 20% of a milestone's requirements changed after acceptance | `requirement.v1` diffs | pause the milestone; the requirements are not stable enough to build against |
| A gate criterion becomes unachievable as scoped | binary | gate check fails structurally, not transiently | descope or move the gate — never delete the criterion silently |

### Dependency

| Trigger | Threshold | Detection | Response |
|---|---|---|---|
| External dependency slips | any slip against a committed date | counterparty communication, tracked date | recompute critical path; escalate if a milestone date moves |
| Blocked-item WIP breach | 3rd concurrent blocked item | `gh issue list --label blocked --state open` | stop starting; escalate to sponsor |
| Blocker ageing | any blocker > 10 days | blocker table in the status report | headline it; named escalation with a date |

### Risk

| Trigger | Threshold | Detection | Response |
|---|---|---|---|
| Risk crosses escalation threshold | `exposureEur` ≥ agreed threshold | `risk-review` | pull mitigation into the current wave |
| Total open exposure grows | > 25% between two reviews | risk register trend | sponsor review of the whole plan, not just the top risk |
| A risk materialises on the critical path | binary | detection signal fires | activate contingency; re-plan from the new state |

### Evidence

| Trigger | Threshold | Detection | Response |
|---|---|---|---|
| Outcome metric moves the wrong way after release | any sustained adverse move over 2 observation windows | the milestone's own metric | stop the next milestone; review the hypothesis before continuing |
| Adoption below the threshold in the milestone definition | below target after the stated window | product analytics | the bet failed — that is a valid, cheap outcome; re-plan rather than double down by default |

### People and capacity

| Trigger | Threshold | Detection | Response |
|---|---|---|---|
| Bus factor 1 on the critical path | binary | skills map vs. critical path | pair or document before proceeding; this is a `people` risk |
| Loss of a role with no second holder | binary | departure, extended leave | re-plan capacity; not absorbable by working harder |
| Sustained overtime | > 10% above normal hours for 2 periods | timekeeping, or ask | re-plan. Overtime borrows from next quarter at a bad interest rate |

## When a trigger fires

1. **Record the measurement** that fired it, with its date. Not "we felt behind" — the number.
2. **Do not immediately re-plan.** First establish whether the trigger is a signal or noise:
   is it one bad week, or a changed system?
3. **Re-plan in revise mode.** Preserve milestone ids, record the diff, write the decision fact
   with `supersedes`.
4. **Report the revision** in the next status report §5, including what was moved to
   `outOfScope` and what it cost.
5. **Review the trigger itself.** A trigger that fires constantly is set too tight; one that has
   never fired while the plan drifted is set too loose. Both are worth fixing.

## Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Trigger with no threshold | never fires, or fires by politics |
| Threshold agreed after the trigger condition already exists | it will be set just above current reality |
| Re-planning silently to match reality | the plan becomes unfalsifiable and the report becomes fiction |
| Raising a threshold instead of re-planning | one decision, taken twice, with no record |
| Triggers only for schedule | scope and evidence triggers are the ones that catch building the wrong thing |
