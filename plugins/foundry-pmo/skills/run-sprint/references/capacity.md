# Capacity — measured, not assumed

Capacity is how much of the next Sprint the team can actually spend on selected work. Most
Planning overcommitment comes from computing it as `people × days` and treating everything else
as an unfortunate surprise that will not recur. It recurs every Sprint.

## The arithmetic

```
gross      = developers × working days in the Sprint
minus      known absence (leave, public holidays, training, hiring loops)
minus      committed non-Sprint duty (on-call rota, support rotation, interview panels)
minus      measured interrupt share
= capacity available for selected work
```

Every subtraction is a number somebody can check. If a subtraction cannot be checked, it is a
guess and must be labelled as one in the Planning output.

## Measuring the interrupt share

This is the term teams skip, and it is usually the largest.

Over the last three Sprints, count the work that arrived after Planning and was done anyway:
production support, urgent requests, unplanned fixes. Express it as a share of completed items or
completed days.

```
interrupt share = unplanned completed work ÷ total completed work
```

Typical range for a team owning a production service is 15–35%. The point is not the benchmark —
it is that the team's own number, measured, replaces an argument with a fact. Recompute it every
few Sprints; it moves when on-call rotas or system stability change.

## First Sprint, no history

Reserve 20% and **say explicitly that 20% is a placeholder to be replaced by measurement after
two Sprints**. A placeholder presented as a measurement is how a made-up number becomes permanent
policy that nobody remembers inventing.

## Converting capacity into a selection

Two defensible routes. Neither requires story points.

- **Item count.** Take the team's throughput over the last 6–12 Sprints (from
  `foundry-pmo:flow-analyst`) and select that many items, adjusted for the capacity delta. Across
  a reasonable sample this predicts as well as points and cannot be inflated.
- **Relative sizing.** If the team already sizes and finds it useful, keep it, but use it for
  the team's own selection only. It is never comparable to another team's sizing and never leaves
  the team.

## Rules that prevent the usual overcommit

- **Select against the low end.** If throughput was `6, 9, 7, 3, 8`, plan against something nearer
  6 than 8. Planning at the maximum means the Sprint fails whenever the team is merely normal.
- **Nothing larger than half the Sprint.** A single item that could consume the Sprint removes all
  ability to respond, and it usually turns out to be larger than believed. Split it, or leave it
  out.
- **Refuse items without acceptance criteria.** They are unestimable by definition and will expand
  during the Sprint.
- **Count in-flight carry-over first.** Work returned from the previous Sprint consumes capacity
  before anything new is selected, at a re-decided size — never at its stale estimate.

## Anti-pattern: capacity as a target

Capacity is a constraint used to decide selection, not a utilisation goal. A team planned to 100%
of capacity has no slack, and slack is what absorbs variability. Boards planned to full
utilisation produce longer cycle times, reliably, for the same reason a motorway at full capacity
moves slower than one at 80%.
