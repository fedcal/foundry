# Definition of Done — every line answerable yes or no

The Definition of Done is the shared meaning of "done" for the Increment. It is a property of the
team (or the organisation), not of an item: individual items add acceptance criteria on top of
it, they never subtract from it.

## The one test

**Could someone who was not in the conversation answer this line yes or no, without asking?**

| Line | Verdict |
|---|---|
| "Code is clean" | Fails. Unanswerable without a judgement call. |
| "Properly tested" | Fails. "Properly" is the whole question. |
| "Reviewed" | Fails. By whom, against what? |
| "Merged to main with at least one approving review from a non-author" | Passes. |
| "Unit tests cover the new branch logic; the suite passes in CI" | Passes. |
| "No new axe-core violations at WCAG 2.2 AA on the changed views" | Passes. |
| "Deployed to staging and exercised against the acceptance criteria" | Passes. |
| "Telemetry emits the documented events; dashboard updated" | Passes. |
| "No new `high` or `critical` findings from the dependency scan" | Passes. |

## Drafting one from scratch

Do not write it in a workshop. Observe what the team already checks before merging, write that
down, and stop. A DoD assembled from aspiration is ignored within two Sprints; a DoD that
describes current practice is followed on day one and can then be raised deliberately.

Raise it one line at a time, and only when the team can meet the new line every Sprint. A DoD
the team cannot meet is worse than a weak one, because it makes "done" negotiable again — and
once negotiable, it never fully recovers.

## The undone-work trap

If an item meets its acceptance criteria but not the DoD, it is **not done**. It does not go in
the Increment, it is not shown at the Review, and it does not count as throughput.

Teams routinely soften this to avoid an uncomfortable Review. The cost is that "done" stops
meaning anything, and every forecast built on completion counts becomes fiction — silently, and
in the optimistic direction.

## Organisational DoD

Where the organisation defines a minimum (security review, accessibility conformance, regulated
change control), the team's DoD is that minimum plus its own additions. It can be stricter, never
weaker. Compliance-driven lines should cite what requires them — a WCAG success criterion, an
ASVS control, a regulation article — so nobody deletes a line without seeing the consequence.

## Where it lives

In the repository, next to the code, reviewed like code. A DoD in a wiki page drifts, and nobody
notices which version was in force when a Sprint closed.
