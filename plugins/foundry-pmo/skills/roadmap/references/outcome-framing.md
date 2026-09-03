# Outcome framing

How to stop writing feature lists with dates on them.

## The test

A milestone is outcome-framed if a person outside the team could tell you whether it happened,
without looking at the codebase.

- "Payments service deployed" — fails. Deployed is a state of our infrastructure.
- "Merchants can take card payments; checkout success rate ≥ 97%" — passes. A merchant can
  confirm it, and the number is queryable.

## The sentence

```
By <milestone>, <who> can <do what they could not before>,
measured by <metric> moving from <baseline> to <target>.
```

Each slot has a failure mode:

| Slot | Failure mode | Fix |
|---|---|---|
| `<who>` | "users", "the business" | name the segment: "merchants on the standard tier", "support agents in EMEA" |
| `<can>` | describes a component | ask "and then what can someone do?" until the answer is a user action |
| `<metric>` | a vanity count (page views, lines shipped) | pick a metric that moves only if the outcome is real |
| `<baseline>` | unknown | this is the finding — add a measurement task to the previous wave |
| `<target>` | "improved" | a number with a unit; if nobody will commit to one, the milestone is not agreed |

## Output-to-outcome conversions

| Output-framed (reject) | Outcome-framed (accept) |
|---|---|
| Migrate to the new auth provider | Users sign in with SSO; support tickets for password resets drop from 120/mo to < 20/mo |
| Refactor the ingestion pipeline | Data is available to analysts within 15 min of arrival, down from 6 h, at 10× current volume |
| Build the admin dashboard | Support agents resolve a billing dispute without engineering help; escalations drop from 40% to < 10% |
| Add caching | p95 catalogue response ≤ 200 ms at 300 req/s, from 1.4 s today |
| Improve test coverage | A release can be cut without a manual regression pass; release lead time drops from 3 d to < 4 h |

The right-hand column is harder to write. That difficulty *is* the planning work — it is where
you discover that nobody knows the baseline, or that two stakeholders wanted different things.

## When the outcome genuinely is internal

Some milestones serve the team, not a user: a migration that removes an end-of-life dependency,
a build-time reduction, a compliance deadline. These are legitimate. Frame them the same way,
with the team or the auditor as `<who>`:

```
By M3, engineers can deploy without the legacy adapter; deploy failures caused by adapter
timeouts drop from 6/month to 0, and the EOL dependency is removed before its 2027-01 support end.
```

What you may not do is let *every* milestone be internal. If a roadmap horizon contains no
milestone a customer would notice, say that plainly to the sponsor — it may be correct
(a platform quarter), but it must be a decision, not an accident.

## Walking skeleton over vertical completeness

Prefer an early milestone that goes thinly end-to-end over one that completes a single layer.
A completed layer cannot be used, cannot be measured, and produces no evidence about the parts
you have not built yet. See the story map in the `write-requirements` skill.

## Anti-patterns

| Anti-pattern | Symptom | Remedy |
|---|---|---|
| Milestone = team boundary | "Backend M1, Frontend M2" | re-slice vertically; nobody buys a backend |
| Milestone = quarter | "Q4 work" | a container is not a milestone; state the outcome |
| Milestone = a single big feature with 40 tasks | one wave holds half the plan | split by data, path or rules (SPIDR) |
| Metric chosen after the fact | metric added in review to satisfy the template | if the metric is hard to name, the outcome is not agreed — go back to the stakeholder |
| Baseline "we'll measure later" | no denominator ever appears in status reports | add the measurement as a task, with an owner, before the milestone it serves |
