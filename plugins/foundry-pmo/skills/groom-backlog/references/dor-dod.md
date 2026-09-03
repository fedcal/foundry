# Definition of Ready and Definition of Done

## Why both exist

- **DoR** protects the team from starting work that cannot be finished. Its cost is paid before
  the sprint; skipping it moves the cost into the sprint, where it is 5–10× more disruptive
  because it arrives as an interruption rather than as a question.
- **DoD** protects the *next* person from work that looks finished but is not. Its cost is paid
  before "done" is claimed; skipping it moves the cost to whoever discovers the gap, usually a
  customer.

Both are binary. "Ready except the criteria" is not ready. "Done except the tests" is in progress.

## Definition of Ready — the seven checks

### 1. Acceptance criteria exist

At least one, in Given/When/Then form or an equivalently verifiable checklist. Each criterion
must be falsifiable by someone who did not write it.

Not ready: "Improve the search experience."
Ready: "Given a catalogue of 10 000 products, when a user searches an exact SKU, then that
product is the first result and the page renders in ≤ 500 ms at p95."

### 2. Value stated

Who benefits and what changes for them. "The team needs it" is only acceptable when the team is
genuinely the user — a build-time reduction, a migration off an end-of-life dependency — and
then the benefit is still quantified.

### 3. Size under the ceiling

Expected effort ≤ **one third of the iteration length**. The ceiling exists so that at least
three items can complete inside one iteration, which is what makes throughput measurable at all.
An item at 80% of the iteration produces one data point per iteration and no forecast.

### 4. Dependencies identified and unblocked

Either nothing blocks it, or the blocker is itself ready and ordered ahead of it. Record
blockers with a convention the tracker can query (`Blocked by #N` plus the `blocked` label);
GitHub has no hard dependency edge, so consistency is the only thing making it queryable.

### 5. No open clarifying question

An open question means the estimate is a guess and the implementer will make the decision at
2pm on a Thursday under time pressure. Convert the question into a `needs:decision` label with a
named decider and a date.

### 6. Testable

Someone can name how it will be verified: a test id, a manual script, a metric with a threshold.
"We'll know it works" is not a verification method.

### 7. Owned

A person or role accountable for the **outcome**, not just for writing the code. The owner is
who answers "did this achieve what it was for?" three weeks later.

## Negotiating DoR without breaking it

Pressure to skip DoR is constant and sometimes legitimate. Two safe valves:

- **Timeboxed spike.** An item may be pulled without criteria *if* it is explicitly a spike with
  a timebox and a deliverable that is knowledge, not code in production. Label `type:spike`.
- **Expedite lane.** One item at a time, for genuine incidents (`sev:1`). It bypasses ordering,
  never DoD. Track how often it is used: more than ~1 per iteration means the system is unstable
  and that is the real finding.

Everything else is not a valve, it is an exception, and exceptions become the process.

## Definition of Done — baseline

If the repository already publishes one (`CONTRIBUTING.md`, `docs/definition-of-done.md`,
`.github/PULL_REQUEST_TEMPLATE.md`), enforce that one. Do not substitute your own. If none
exists, propose this and get it written down:

- [ ] All acceptance criteria demonstrably pass, each mapped to a test or a recorded check.
- [ ] Automated tests added for the new behaviour; suite green on CI.
- [ ] Code reviewed and approved; comments resolved, not merely acknowledged.
- [ ] No new lint, type or security-scan findings above the agreed severity floor.
- [ ] User-facing changes documented (README, changelog, or in-product copy).
- [ ] Observability: the new behaviour is visible in logs or metrics **when it fails**.
- [ ] Feature flag state and rollback path stated for anything user-visible.
- [ ] Merged to the default branch and deployed to at least pre-production.

Make it mechanical where possible: put it in `.github/PULL_REQUEST_TEMPLATE.md` as a checklist,
and turn the items that can be automated into required status checks so the DoD is enforced by
CI rather than by memory.

## Levels of done

Three levels prevent the most common argument:

| Level | Meaning |
|---|---|
| Done | Meets the DoD above; merged and deployed to pre-production |
| Done-done | Released to production users, behind the intended flag state |
| Value-done | The outcome metric has moved, or has been observed not to |

Roadmap milestones are passed at **value-done** where an outcome metric exists. A milestone
declared complete at "done" is a milestone that shipped output and measured nothing.

## Enforcement without becoming a bureaucracy

- Check DoR at the moment of pulling, not in a meeting a week earlier — readiness decays.
- Report DoR failures as counts by reason label, not as a list of people.
- Review the DoD quarterly. A checklist item that has never once caught anything is ceremony;
  remove it. A recurring escape that the DoD did not catch is a missing item; add it.
- Never allow a partial tick. Half a checkbox is an unticked checkbox.
