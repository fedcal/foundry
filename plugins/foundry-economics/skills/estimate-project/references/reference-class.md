# Reference-class forecasting from this project's own history

## Why the inside view is not enough

Summing your own decomposition is the *inside view*: it reasons from the specifics of this
plan. Its structural flaw is simple and unfixable — **the decomposition can only contain work
you thought of.** Everything you failed to imagine is missing, and what you failed to imagine
is, by construction, unknown to you.

The *outside view* asks a different question: "when this organisation has done things like
this before, what actually happened relative to what it said would happen?" It captures the
unimagined work statistically, without requiring you to imagine it.

Both views are needed. The inside view tells you the shape of the work; the outside view tells
you how wrong that shape usually is.

## The one rule

**Build the reference class from this project's own data.** Never apply a remembered industry
multiplier. A number recalled from a study you cannot cite, applied to a project it was not
derived from, is fabrication wearing a lab coat — and it is worse than no correction, because
it looks rigorous.

If there is no local data, the correct output is "no reference class available in this
project", plus a cap on the confidence class. That sentence is more valuable than a fake
factor, and it creates the incentive to start recording actuals.

## Building the class

### 1. Find comparable past items

Comparable means: similar size, similar team, similar novelty. A two-day config change is not
in the same class as a payments integration.

Sources, in descending order of quality:

| Source | Command / tool | Gives you |
|---|---|---|
| Past Foundry estimates | `blackboard_read` on prior waves; `.foundry/blackboard/*/cost-engineer.json` | estimated values with their assumptions |
| Recorded metric facts | `memory_search` with `type: metric` | previously banked actual-vs-estimate outcomes |
| Issue tracker | `gh issue list --state closed --json number,title,createdAt,closedAt` | elapsed calendar time per item |
| PR history | `gh pr list --state merged --json number,title,createdAt,mergedAt` | cycle time per change |
| Git tags | `git tag --sort=creatordate --format='%(creatordate:short) %(refname:short)'` | release-to-release intervals |
| Commit history | `git log --format='%ad %s' --date=short` | activity shape when nothing better exists |

Degrade gracefully: if `gh` is not installed, say so and fall back to git. If the repository
has no history, say so and stop — do not substitute.

### 2. Compute uplift per item

```
upliftᵢ = actualᵢ / estimatedᵢ
```

Both values must be in the same unit and cover the same scope. If an item's scope changed
mid-flight, either exclude it or record the scope change as a separate observation — silently
including it measures scope creep, not estimation bias, and conflating the two produces an
uplift factor that punishes good estimators.

### 3. Take the distribution, not the average

```
uplift_p50 = median of {upliftᵢ}
uplift_p80 = 80th percentile of {upliftᵢ}
E_adjusted = E_total × uplift_p80
```

Use the p80, not the mean. The uplift distribution is right-skewed — a project can overrun by
300% but cannot underrun by more than 100% — so the mean is dragged around by single bad
outcomes while the median understates the tail you are trying to protect against.

Percentile in a spreadsheet: `=PERCENTILE.INC(range, 0.8)`.

### 4. Judge the sample honestly

| Comparable items | What you may claim |
|---|---|
| 0 | "No reference class available." Cap confidence class at order-of-magnitude. |
| 1–4 | Directional challenge only. Quote the individual outcomes, not a percentile. |
| 5–14 | A usable p80, stated as indicative with the sample size attached. |
| 15+ | A genuine reference class. Quote it with confidence. |

Always state `n`. "Historical uplift p80 = 1.6 (n = 7 comparable items since 2025-11)" is a
defensible sentence. "Historical uplift 1.6" is not.

### 5. Reconcile — this is the part that adds value

Compare `E_adjusted` against the bottom-up interval:

| Outcome | What it means | What to do |
|---|---|---|
| `E_adjusted` within [p50, p80] | The two views agree | Say so. This is a strong estimate. |
| `E_adjusted > p80` | The bottom-up range is too narrow | Widen it. Then find *which* category the history says you omit — usually assurance, rework or coordination — and add the leaf. |
| `E_adjusted < p50` | Either the team has genuinely improved, or the past items are not comparable | Check comparability first. Genuine improvement is real but rarer than claimed; require a mechanism ("we now have the integration test suite that used to catch this late"). |

Never simply replace one number with the other. The reconciliation narrative — *why* they
differ — is the output. A reviewer who understands the disagreement can act on it; a reviewer
handed a reconciled number cannot.

## Closing the loop

The reference class only exists if someone records actuals. At the end of every costed piece
of work, bank the outcome with `memory_write`:

```
type:  metric
title: "Payments integration: estimated 18d, actual 31d (uplift 1.72)"
body:  what was underestimated and why; which category of work was missing from the WBS
tags:  [estimate-actual, integration]
```

A fact recorded this way costs almost nothing and is the raw material for every future
estimate in this project. Skipping it guarantees that the next estimate repeats the same
omission, and that the same argument is had again with no evidence.

Never write these files by hand — `memory_write` deduplicates, assigns ids and maintains
`supersedes` chains (AUTHORING §3).
