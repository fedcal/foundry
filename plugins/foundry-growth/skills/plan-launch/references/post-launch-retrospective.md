# Post-launch retrospective — day 14

A flat launch has four common causes and they are routinely collapsed into one: "we should have
posted somewhere else". They have different remedies, and three of the four remedies are wasted
effort if the diagnosis is wrong. This procedure separates them from evidence, and is willing to
end in `inconclusive`.

Run it at the day-14 checkpoint, with the 24 h and 72 h readings already recorded.

## Precondition — the thresholds are the original ones

Read the primary number, its baseline and its three thresholds from `docs/growth/launch-plan.md`
as they were written **before** the launch date. If any of them was edited after the announcement
went out, the retrospective is void as an experiment: record the original number, the revised
number and both dates, in that order, judge the result against the original, and note that the
next launch loses this comparison. Do not quietly read the result against the new number.

## Step 1 — the funnel, with a named mechanism per stage

The stage at which people stop is the discriminator. Measure each stage separately; a single
aggregate number cannot diagnose anything.

| Stage | What it counts | Mechanism |
|---|---|---|
| S1 arrivals | people who reached the destination | `gh api repos/{owner}/{repo}/traffic/views`, `traffic/popular/referrers`, or the host's analytics read by hand |
| S2 engaged | people who went past the first screen — clones, docs pages beyond the landing page, the demo command run | `gh api repos/{owner}/{repo}/traffic/clones`, per-page analytics, package registry downloads |
| S3 activated | people who reached a first working result | issues and questions that show real use, registry install counts, telemetry only if it already existed and was disclosed |
| S4 returned | people still present at day 7 and day 14 | repeat clones, second-week downloads, a second interaction from the same person |

Record the count, the mechanism and the date for each stage. Any stage with no mechanism is
written as `not measurable` — not estimated. An estimated funnel stage is the single most common
way a retrospective reaches a confident wrong diagnosis.

**Minimum-evidence rule.** Fix the minimum arrival count in advance, in the plan. Absent an
explicit figure, treat a diagnosis drawn from fewer than 30 arrivals as **inconclusive by
construction**: at that size the difference between the diagnoses below is noise, and the correct
output is "the launch did not produce enough data to diagnose", plus what to do differently to
get more next time.

## Step 2 — read every comment and classify it

Read them all, yourself, before summarising anything. The classification is a count, not an
impression:

| Class | Marker |
|---|---|
| `restates-correctly` | the commenter describes back what the project is, and is right |
| `restates-wrongly` | the commenter describes it back, and is wrong, or asks "how is this different from X" where X is not a real alternative |
| `wrong-room` | "not for me", "why is this posted here", off-topic complaints about the channel |
| `blocked` | tried it and hit an error, a missing step, an unclear instruction |
| `used-it` | reports actual use, however small |
| `applause-only` | approval with no evidence of use |
| `hostile` | no diagnostic content |

`applause-only` is not a success signal. A launch can be full of it and still be a no-demand
result; treating it as demand is exactly the self-flattery this file exists to block.

## Step 3 — the four diagnoses and their discriminating evidence

Each diagnosis needs **at least two independent signals**. One signal is a hypothesis, and the
verdict in that case is `inconclusive`, not the most comfortable of the four.

### A — Broken first-run path (check this first)

The readiness gate said green and was wrong, or something regressed between the gate and the day.

*Signals:* high `blocked` count; issues filed about install or the first command; S2 healthy but
S3 near zero; the errors cluster on one step.

*Why first:* it counterfeits every other diagnosis. People who cannot run it do not come back,
which reads exactly like no demand, and they say little, which reads exactly like wrong channel.

*Remedy:* fix the step, re-run `references/readiness-checklist.md` on a pristine tree, and answer
the original question again in the fixed state before drawing any conclusion about demand.

### B — Wrong channel

The right people were never in the room.

*Signals:* S1 low against **your own** prior posts (never against a remembered industry figure);
`wrong-room` comments present; conversion from S1 to S3 normal or good for the few who arrived;
the referrer data shows arrivals from a channel you did not choose outperforming the ones you did.

*Remedy:* keep the claim and the copy, change the room. Re-run `references/channel-selection.md`
with the new evidence — a launch that produced any arrivals produced referrer data, and that data
is better than everything available before the launch. Do not rewrite the pitch; you have no
evidence against it yet.

### C — Wrong positioning

They arrived, and did not understand what it was for or why it beats what they do today.

*Signals:* S1 healthy, drop between S1 and S2; `restates-wrongly` outnumbers `restates-correctly`;
recurring questions of the form "what would I use this for" or "how is this different from X";
people comparing you to something you are not.

*Remedy:* `position-project`, then a new claim, then a new launch. Re-posting the same copy in a
different channel is the classic wasted second attempt — the copy is the thing that failed.

### D — No demand at this scope

They arrived, understood, tried it, and did not come back.

*Signals:* S1 and S2 healthy; `restates-correctly` dominant; `used-it` present but S4 near zero;
`applause-only` high with no issues filed by anyone who is not an author.

*Remedy:* this is a product-and-scope decision, not a growth one. It goes to `foundry-dev` for
what the project should be, and to `foundry-economics:business-case-analyst` if the question is
whether it is worth continuing to fund. More launching is the wrong response.

**The honest floor.** If the plan's stated no-demand condition was met, publish that conclusion as
written, on the schedule the plan committed to. Retro-fitting a kinder story is the failure this
whole skill was built against, and it costs the next decision far more than the launch cost.

## Step 4 — record it

Append to `docs/growth/launch-plan.md`: the funnel table with mechanisms and dates; the comment
classification counts; the verdict (`A`, `B`, `C`, `D` or `inconclusive`) with the two or more
signals that support it; the signals that pointed elsewhere and were outweighed; and the single
next action with an owner and a date.

Write the durable parts back through the `foundry` MCP tool `memory_write`: a `fact.v1` of type
`metric` for each measured stage with its mechanism, and one of type `risk` for whatever nearly
went wrong. Never edit `.foundry/memory/facts/` by hand.

## Step 5 — one improvement to the next gate

Every retrospective ends by changing one thing upstream, so the same failure cannot recur silently:
a new blocking check in `references/readiness-checklist.md`, a scoring dimension in
`references/channel-selection.md` that would have caught the bad channel, or a claim-ledger rule
that would have cut the sentence that misled people. A retrospective producing no upstream change
produced a feeling, not a finding.

## Degradation

- **No analytics and no `gh`** → S1 and S2 are `not measurable`. Diagnose from the comment
  classification and the issue log alone, and state plainly that only diagnoses A and C are
  reachable that way: B and D both require arrival counts.
- **Fewer than 30 arrivals** (or below the minimum fixed in the plan) → verdict `inconclusive by
  construction`, plus the change to the next attempt. This is a legitimate and complete output.
- **`superpowers` installed** → use `superpowers:systematic-debugging` to work the diagnoses one
  hypothesis at a time, each falsified against a count before moving on. If it is not installed,
  apply the same discipline by hand and record the falsified hypotheses in the plan; the record of
  what was ruled out is what makes the next retrospective faster.
