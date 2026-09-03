---
name: status-report
description: Generate a status report from real repository and plan data — burn-up against plan.v1, gate progress with the actual check output, blockers with owners and measured age, and a forecast expressed as a range. Use for a periodic report, a milestone checkpoint, or a stakeholder update. Never assembled from narrative memory.
argument-hint: "[--milestone \"M2\"] [--since 2026-08-13] [--plan .foundry/blackboard/<wave>/roadmap-planner.json]"
user-invocable: true
context: fork
agent: foundry-pmo:delivery-reporter
background: false
model: sonnet
effort: medium
metadata:
  foundry.vertical: management
  foundry.io: "plan.v1 + live repository data -> docs/status/YYYY-MM-DD-status.md + handoff.v1"
license: Apache-2.0
---

# Status report

Every number in the output comes from a command run during this session. Nothing comes from the
conversation, from a standup, or from what was true last week. Where data cannot be read, the
report says **unavailable** — it never says "on track" by default.

## Step 1 — Establish the baseline

```bash
ls -1 .foundry/blackboard/*/roadmap-planner.json 2>/dev/null
ls -1 docs/status/*.md 2>/dev/null | tail -3        # the previous report, for the diff in §5
```

No `plan.v1` means there is no "against plan". Say so and label the output an **activity
summary**, not a status report. Do not reconstruct a baseline from the current state — that
produces a plan that is always met, which is worse than no plan.

Record the baseline scope figure for the milestone. This is the denominator for everything that
follows, and it is what makes scope growth visible.

## Step 2 — Collect signals

```bash
gh --version >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && echo GH_OK || echo GH_UNAVAILABLE

M="M2 — Merchants can take card payments"
SINCE="2026-08-13"

gh issue list --milestone "$M" --state all --limit 500 \
  --json number,title,state,closedAt,createdAt,updatedAt,labels,assignees \
  > .foundry/scratch/milestone-issues.json

gh api repos/{owner}/{repo}/milestones --paginate \
  --jq '.[] | {title, open_issues, closed_issues, due_on}' \
  > .foundry/scratch/milestones.json

gh pr list --state merged --limit 200 --json number,createdAt,mergedAt,labels \
  > .foundry/scratch/prs-merged.json
gh pr list --state open --json number,createdAt,isDraft,reviewDecision,title \
  > .foundry/scratch/prs-open.json

gh issue list --label blocked --state open \
  --json number,title,updatedAt,createdAt,assignees > .foundry/scratch/blocked.json
gh issue list --label "sev:1" --state open --json number,createdAt,title > .foundry/scratch/sev1.json

gh run list --limit 100 --json workflowName,conclusion,createdAt > .foundry/scratch/runs.json
gh release list --limit 10 --json tagName,publishedAt

git log --since="$SINCE" --pretty=format:'%h %ad %s' --date=short | head -100
```

If `gh` fails, say so in the **first line** of the report, fall back to `git` only, and mark
every issue-derived metric unavailable. Never substitute an estimate for a measurement.

Record the window used for every metric. A number without its window cannot be compared to the
next report, which is the only comparison that matters.

## Step 3 — Headline

One line: the judgement, the cause, and the decision requested.

```
M2 will miss its 30 Nov date. Forecast 11–22 Dec (p80: 18 Dec). Cause: 3-D Secure integration
blocked 9 days awaiting vendor sandbox access. Decision needed by 29 Aug: descope step-up auth
to M3, or accept the slip.
```

"No change since 20 Aug; next report 3 Sep" is a legitimate and welcome headline. Do not
manufacture news.

Traffic lights only with the rule stated in the report:

| Status | Rule |
|---|---|
| Green | forecast p80 ≤ committed date **and** no open blocker older than 5 days |
| Amber | p80 exceeds the committed date by ≤ 10% of remaining duration, or a blocker is 5–10 days old |
| Red | p80 exceeds by > 10%, a blocker is > 10 days old, or a gate criterion is unachievable as scoped |

Never move to green because a mitigation is *planned*. Colour reflects today's measurement; the
plan goes in the Asks.

## Step 4 — Burn-up

Burn-down hides scope change; the added and the completed cancel and the line looks healthy
while the project drifts. Plot **two** lines. Method and worked example:
`references/burnup.md`.

```
M2 burn-up (unit: acceptance criteria met | window 2026-07-01 → 2026-08-27)

  scope   ─── 41 ─── 41 ─── 44 ─── 44 ─── 44 ─── 52 ─── 52   ← +8 added 18 Aug
  done    ───  6 ─── 13 ─── 19 ─── 24 ─── 28 ─── 31 ─── 33
              w1     w2     w3     w4     w5     w6     w7

  completed 33/52 (63%)     scope growth vs. baseline 41 → 52 (+27%)
  rate last 3 weeks: 2.7/wk (observed range over 7 weeks: 2–7/wk)
```

Rules: one unit, chosen once and kept forever (acceptance criteria are best — they resist both
scope inflation and estimate drift); always draw the scope line; always report scope growth as a
percentage against the baseline; always carry the denominator (`33/52`, never "63% done").

## Step 5 — Gate progress

Straight from `plan.v1.waves[].gate`. Run each check and paste the real result.

```
M2 gate:
  [x] REQ-0041 acceptance criteria met (4/4)
  [ ] REQ-0042 acceptance criteria met (2/5)                    blocked, see Blockers
  [x] e2e payments   npm run test:e2e -- --grep @payments        27 Aug — 34 passed, 0 failed
  [ ] zero open sev:1  gh issue list --label sev:1 --state open --json number --jq 'length'  → 2  (#412, #418)
  [ ] sign-off: product-owner                                    not requested yet
```

A criterion whose check was **not run** is reported as `unverified`, never as met. Running the
check is cheaper than the meeting caused by reporting it wrong.

## Step 6 — Blockers

```bash
jq -r --arg now "$(date -u +%s)" '.[] |
  "\(.number)\t\((($now|tonumber) - (.updatedAt|fromdate))/86400 | floor) d\t\(.title)"' \
  .foundry/scratch/blocked.json | sort -k2 -rn
```

One row each, no prose:

| # | Blocker | Owner | Since | Age | Impact | Ask |
|---|---|---|---|---|---|---|
| #305 | Vendor sandbox for 3-D Secure not provisioned | A. Rossi | 18 Aug | 9 d | M2 critical path, +9 d and counting | Escalate to vendor account manager by 29 Aug |

Owner is a **person**, never a team. Age is measured from the tracker, not from when it was first
mentioned. An entry with no ask is a complaint. Any blocker over 10 days goes in the headline.

Report the blocker count against the WIP `blocked` limit (default 2 from `groom-backlog`) so a
breach is visible.

## Step 7 — Forecast

Never a single date. Show the method:

```
Remaining:      52 − 33 = 19 criteria
Weekly rate:    2, 5, 7, 4, 6, 3, 3  →  mean 4.3, min 2, max 7
Optimistic  (7/wk):   2.7 weeks  → ~16 Sep
Likely      (4.3/wk): 4.4 weeks  → ~27 Sep
Pessimistic (2/wk):   9.5 weeks  → ~2 Nov
PERT expected:        4.9 weeks  → ~1 Oct
p80 ≈ expected + 0.8 × (pessimistic − expected)  → ~22 Oct
Committed date 30 Nov → 5.5 weeks of headroom at p80
```

Assumptions listed every time, minimum four: scope stops growing (state the observed growth rate
so the reader can discount this); team composition unchanged, with known absences named;
historical rate is representative (state the window; fewer than 4 data points makes the forecast
indicative only and the report must say so); no unmitigated risk above the escalation threshold
materialises — list the top three by exposure with their probability, as explicit exclusions.

Define the labels in the report: p50 "as likely as not"; p80 "the date to communicate
externally"; p95 "the date to promise contractually". Never publish p50 as a commitment.

## Step 8 — Changes since last report

A diff, not a narrative. Scope added and removed with issue numbers; milestones moved with old
and new dates; risks opened, closed or re-scored; decisions taken and by whom; decisions still
waiting, with how long. A decision waiting more than 5 days is itself a blocker — move it to §6.

If a previous report was wrong, correct it here explicitly with the corrected number. Silent
revision is how reports stop being read.

## Step 9 — Asks

Maximum five. Each: the decision or action, the person, the date, and the consequence of not
deciding. Zero asks is a fine outcome — say so rather than inventing one.

## Step 10 — Emit

1. Render `docs/status/YYYY-MM-DD-status.md` from `templates/status.md`.
2. Write `handoff.v1` to `.foundry/blackboard/<wave>/delivery-reporter.json` via
   `mcp__plugin_foundry-core_foundry__blackboard_write`; put unreadable signals in `blockedBy[]` with the failing
   command, and open decisions in `openQuestions[]`.
3. Before writing "done" or "complete" anywhere: if `superpowers` is installed, invoke
   `superpowers:verification-before-completion`. If it is not, run the gate `checks` yourself and
   paste their real output.
4. Hand re-sequencing to `roadmap` (revise mode) and re-scoring to `risk-review`. This skill
   reports the gap; it does not close it, and it never re-baselines.

## Exit criteria

- [ ] Every number traces to a command run in this session, with its window stated.
- [ ] Unreadable signals listed as unavailable with the failing command — never smoothed over.
- [ ] Headline states a judgement and, where one exists, a decision requested.
- [ ] Traffic-light status, if used, cites the rule that produced it.
- [ ] Burn-up shows both lines; scope growth vs. baseline stated as a percentage.
- [ ] Every progress figure carries its denominator.
- [ ] Every gate criterion shows its check command and actual result, or is marked unverified.
- [ ] Every blocker has a named person, a measured age, and an ask with a date.
- [ ] Forecast gives optimistic/likely/pessimistic plus p80, with the method and ≥ 4 assumptions.
      No single-date forecast anywhere in the document.
- [ ] Top three open risks by exposure listed as forecast exclusions.
- [ ] Changes-since-last shown as a diff with issue numbers; prior errors corrected explicitly.
- [ ] `handoff.v1` validates.

## What this skill deliberately does not cover

- Planning and re-planning — use `roadmap`. Reporting a gap is not authority to change the plan.
- Re-baselining. Changing the baseline is a plan revision with a recorded trigger, never a
  reporting adjustment.
- Deciding. It requests decisions; it does not make them on the sponsor's behalf.
- Individual performance assessment. Rates and cycle times describe the system; attributing them
  to people corrupts the data and the forecast with it.
- Financial reporting. Effort and dates only; budget variance belongs to `foundry-economics`.
- Root-cause analysis. It reports the blocker; diagnosis goes to
  `superpowers:systematic-debugging` or the relevant engineering agent.
- Executive slideware and narrative framing.

## References

| File | Load when |
|---|---|
| `references/burnup.md` | building the chart, choosing the unit, handling scope changes mid-flight |
| `references/forecasting.md` | rate-based and Monte-Carlo forecasting, percentile selection |
| `references/bad-news.md` | the escalation is uncomfortable and the wording matters |
| `templates/status.md` | rendering the report |
