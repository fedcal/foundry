# Retrospective formats — and when each one fits

Four formats, each with a facilitation script. Rotating for novelty is acceptable; choosing for
the situation is better.

## Timeline

**When:** something went visibly wrong, or trust is low and interpretation would turn into blame.

1. Draw the cycle on a line. Everyone adds events they remember, facts only — a deploy, a
   handover, an outage, a person away. No opinions in this pass.
2. Add the data from the board underneath: cycle-time outliers, blocked spans, scope added.
3. Only now, mark the surprises: where did reality diverge from what people expected at the time?
4. Pick the largest surprise and ask what made it invisible until it happened.

The facts-first pass is what makes this safe. People argue about interpretations; they rarely
argue about whether a deploy happened on Tuesday.

## Starfish

**When:** an ordinary cycle with no crisis. Fast, low ceremony.

Five columns: **start**, **stop**, **continue**, **more of**, **less of**. The middle three are
where the useful material sits — teams over-invest in "start", which is how a retrospective
generates five new actions and completes none.

Timebox generation to 10 minutes, cluster, dot-vote, converge.

## Five whys

**When:** the same problem has appeared twice or more. Stop generating breadth; go down.

Ask "why" until the answer is a system property rather than a person's choice. Stop when the next
"why" would leave the team's sphere of influence — that boundary is the finding, and the action
becomes escalation with a named recipient.

Guard against the single-cause illusion: real failures usually have several contributing factors.
If two branches both look load-bearing, follow both and say so.

## Sailboat

**When:** the team is disengaged, or the meeting has gone stale and needs a different frame.

Wind (what pushes us), anchors (what slows us), rocks (risks ahead), destination (what we are
heading for). The metaphor lowers the social cost of naming an anchor, which is why it works with
teams that have gone quiet.

Convert anchors into system statements before voting, or the output stays impressionistic.

## Choosing under constraint

| Constraint | Format |
|---|---|
| 30 minutes only | starfish, generation pre-collected in writing |
| Remote and asynchronous | written input first, live session for convergence only |
| Low trust, or a manager present | timeline, facts only |
| Recurring known problem | five whys on that one thing |
| Post-incident | none of these — route to `foundry-quality:sre-planner` |

## Facilitation rules that apply to all four

- Collect input in writing before discussion, so the loudest voice does not set the frame.
- Timebox generation. Convergence, not generation, is where the value is.
- One action out, owned and dated. Record the rest as explicitly uncommitted observations.
- End by reading the action aloud with its owner's name. Ambiguity dies there or never.
