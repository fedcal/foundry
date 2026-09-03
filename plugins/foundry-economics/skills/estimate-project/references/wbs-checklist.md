# Decomposition checklist — the work that ends up in the overrun

Walk this list every time. It is not a template to copy wholesale; it is a set of prompts that
surfaces leaves people forget. Delete what genuinely does not apply, and record the deletion —
"not applicable" is an assumption like any other.

Each item that survives becomes a leaf with `label`, `role`, `unit` and a three-point range.

## A. Discovery and design

- [ ] Requirements clarification with the actual decision-maker (not their proxy)
- [ ] Technical spike for each genuinely unknown component — timeboxed, and the timebox is the estimate
- [ ] Interface/contract design with each system you must integrate with
- [ ] Data model design and review
- [ ] Architecture decision records for the choices that will be re-litigated later
- [ ] Estimation and planning itself, if it is material

## B. Environment and enablement

- [ ] Local development environment for the new component
- [ ] CI pipeline changes: new jobs, new caches, new matrix entries
- [ ] Secrets and credential provisioning — often gated on a team you do not control
- [ ] New infrastructure provisioned in each environment (dev, staging, prod)
- [ ] Access requests, VPN, IAM roles, third-party account creation
- [ ] Test data creation, anonymisation of production-shaped data
- [ ] Feature-flag plumbing

## C. Build

- [ ] The feature itself, split by component
- [ ] Backward compatibility and API versioning
- [ ] Error handling, retries, idempotency, timeouts
- [ ] Input validation at every boundary
- [ ] Instrumentation: logs, metrics, traces, and the dashboard that reads them
- [ ] Configuration surfaces and their defaults
- [ ] Internationalisation, if the product has it
- [ ] Accessibility work, if there is a user interface

## D. Data

- [ ] Schema migration, forward
- [ ] Schema migration, **rollback** — usually harder than forward and usually forgotten
- [ ] Backfill of existing data
- [ ] **The second backfill**, after the first one is found to be wrong. Budget it once; it is
      the most reliably recurring surprise in this list.
- [ ] Reconciliation between old and new representations during the transition
- [ ] Data retention and deletion paths

## E. Quality

- [ ] Unit tests (should be inside the build leaves, not a separate phase — check that it is)
- [ ] Integration tests, including the ones needing a real dependency
- [ ] End-to-end tests for the critical flows
- [ ] Performance/load testing and the environment to run it in
- [ ] Fixing what the performance test finds
- [ ] Code review **and rework loops** — model as an explicit leaf, not a percentage uplift.
      A percentage uplift is invisible and gets cut first; a leaf has to be argued away.
- [ ] Bug fixing found in test, before release

## F. Assurance and compliance

- [ ] Security review, threat modelling, and remediating what it finds
- [ ] Dependency and licence scanning, and resolving findings
- [ ] Accessibility audit against the applicable standard, and remediation
- [ ] Privacy review, data-protection impact assessment where required
- [ ] Compliance evidence collection for whichever regime applies
- [ ] Penetration test scheduling, execution window, and the fix cycle after it

## G. Release

- [ ] Deployment automation changes
- [ ] Rollback plan **and a rehearsal of it**
- [ ] Progressive rollout: canary, percentage ramp, monitoring at each step
- [ ] Cutover window, including out-of-hours premium if applicable
- [ ] Communication: release notes, status page, customer notice
- [ ] Coordination with any external party that must move at the same time

## H. Post-release

- [ ] Stabilisation window — an explicit period of elevated bug-fixing. Naming it prevents the
      team being counted as available for the next project on release day.
- [ ] Hypercare / elevated support rota
- [ ] Monitoring the business metric the change was supposed to move
- [ ] Decommissioning the thing it replaced (see the `tco-model` skill; this is rarely free)
- [ ] Retrospective and updating the runbook

## I. Documentation and handover

- [ ] User-facing documentation
- [ ] Operational runbook for the on-call engineer
- [ ] Internal architecture documentation
- [ ] Training or enablement for support, sales or operations
- [ ] Handover to the team that will own it, if that is not this team

## J. Coordination overhead

Real, and usually 10–30% of a delivery in practice — but **measure it for your team, do not
assume a figure**. Model as leaves where it is lumpy, or as a stated availability factor where
it is continuous:

- [ ] Ceremonies, planning, demos
- [ ] Stakeholder management and status reporting
- [ ] Waiting on external approvals — model the wait, since it consumes calendar time even
      when it consumes no effort. Effort and duration are different quantities; say which
      one you are estimating.
- [ ] Onboarding anyone who joins mid-project

## K. The availability question

Effort is not calendar time. State the conversion explicitly:

```
calendar_days = effort_days / (FTE × availability_factor)
```

`availability_factor` accounts for leave, illness, support duty, other projects and meetings.
It is `[given]` or `[ASSUMPTION — confirm]`. It is never 1.0, and pretending it is 1.0 is one
of the two or three most common causes of schedule failure.

## Deliberate exclusions to write into `excluded[]`

Say what you did **not** cost. The excluded list is the part of an estimate people read most
carefully, and it is your only protection when scope arrives later:

- Work for other teams that this project depends on
- Third-party licence or subscription cost (unless explicitly included)
- Infrastructure run cost beyond the delivery window → `tco-model`
- AI/token spend → `ai-spend-report`
- Anything conditional on an unmade decision — name the decision and its owner
- Rework caused by a requirement change after sign-off
- Contingency, if you are reporting it separately rather than inside the total
