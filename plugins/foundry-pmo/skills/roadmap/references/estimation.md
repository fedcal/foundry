# Estimation: ranges, never numbers

Every estimate produced anywhere in `foundry-pmo` is a range with stated assumptions. A single
number presented as fact is a defect, regardless of who asked for one.

## Three-point estimates

| Point | Definition — say this out loud when eliciting |
|---|---|
| Optimistic `o` | Everything an experienced person could reasonably expect to go right, does. No blockers, no rework. Roughly 1 run in 10. |
| Likely `m` | The single most probable duration. **Not** the average, and not the midpoint of `o` and `p`. |
| Pessimistic `p` | Realistic bad case: the known things go wrong. Excludes catastrophes (they are risks, not estimates). Roughly 1 run in 10. |

PERT expected value and its spread:

```
E     = (o + 4m + p) / 6
sd    = (p − o) / 6
p50  ≈ E
p80  ≈ E + 0.84 × sd
p95  ≈ E + 1.65 × sd
```

For a sum of N independent tasks: `E_total = Σ E_i`, `sd_total = sqrt(Σ sd_i²)`. Note that
`sd_total` is much smaller than `Σ sd_i` — this is why padding every task individually
over-buffers a plan while leaving it unable to absorb a single genuinely bad task.

Independence is an assumption and it is often wrong: a team that is slow this month is slow on
everything. When tasks are correlated, the aggregate spread is wider than the formula suggests.
Say so rather than quietly publishing a tighter interval than the evidence supports.

## The ratio check

```
ratio = p / o
```

| Ratio | Meaning | Action |
|---|---|---|
| ≤ 2 | Understood work | estimate is usable |
| 2–3 | Some unknowns | usable, but keep it off the critical path if possible |
| 3–5 | Substantially unknown | insert a timeboxed spike; re-estimate afterwards |
| > 5 | Not an estimate, a guess | **do not schedule it** — schedule the spike only |

A wide ratio is information, not a failure. Narrowing it by fiat ("let's say two weeks") deletes
the information and keeps the uncertainty.

## Focus factor

```
available_hours = headcount × period_hours × focus_factor
```

Focus factor accounts for meetings, support, interrupts, review, onboarding, and the fact that
nobody does project work for eight hours. Use measured history when you have it:

```bash
# rough throughput signal: merged PRs per week over the last quarter
gh pr list --state merged --limit 300 --json mergedAt --jq '.[].mergedAt[0:10]' \
  | cut -c1-7 | sort | uniq -c
```

When you have no history, use **0.60** and label it an assumption. Never use 1.0. Never let a
schedule be built on 100% allocation of every named person — that plan fails on its first sick day.

Additional deductions that must be explicit, not absorbed into the focus factor:
- Public holidays and known leave in the window, by person.
- Onboarding cost for anyone joining mid-plan: assume they are net-negative for their first
  period, not neutral.
- On-call rotation, if the same people carry it.

## What an estimate must carry

Every `estimate.v1` states:

1. **Scope** — what is being estimated, and at what boundary.
2. **Items** — each with `o`, `m`, `p` and a unit. Hours or days; be consistent.
3. **Assumptions** — minimum three, each one a thing that, if false, changes the number.
4. **Excluded** — what is *not* in the number. This prevents the most common estimate dispute,
   which is about scope rather than about speed.

```json
{
  "assumptions": [
    "Focus factor 0.60 — assumed, not measured from this team's history",
    "Provider sandbox available from week 1; unavailability is RISK-014",
    "No change to the data model agreed in adr-0007",
    "Team of 3 unchanged; no leave modelled beyond public holidays"
  ],
  "excluded": ["Data migration of historical orders", "Load testing beyond the smoke profile", "Localisation"]
}
```

## Communicating an estimate

- Publish **p80** externally. p50 is a coin flip and will be missed half the time, which destroys
  credibility faster than a later date would have.
- Publish p95 only where a contractual commitment is being made.
- Always publish the range beside the point: `"18–34 days (p80: 30)"`.
- When the recipient asks for a single date, give the p80 date and say which percentile it is.
  Never strip the label — the label is the whole message.
- Re-estimate when the ratio narrows, and publish the narrowing. A forecast that never moves is
  not being updated with evidence.

## Reference-class forecasting beats introspection

When comparable past work exists, start from what it actually took, not from decomposition. The
decomposed estimate is systematically optimistic because it omits the work nobody listed.

```bash
# how long did comparable issues actually take, from open to close?
gh issue list --state closed --label 'type:feat' --limit 100 \
  --json number,createdAt,closedAt \
  --jq '.[] | {n:.number, days: (((.closedAt|fromdate) - (.createdAt|fromdate))/86400 | floor)}'
```

Use the observed distribution as the prior; use decomposition to explain deviation from it.
If the decomposed estimate is far below the reference class, the decomposition is wrong, not
the history.

## Estimation anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Single-number estimate | mistaken for a commitment within one meeting |
| Estimating on behalf of the people doing the work | they own delivery but not the number, so they own neither |
| Negotiating the estimate down | changes the number, not the work |
| Padding each task quietly | buffer becomes invisible and gets spent by accident |
| Story points converted to days in the same breath | destroys the purpose of an abstract unit |
| Re-using an estimate after the scope changed | the most common cause of an "unexplained" slip |
| Treating `m` as the midpoint of `o` and `p` | that is the definition of a symmetric distribution; software work is right-skewed |
