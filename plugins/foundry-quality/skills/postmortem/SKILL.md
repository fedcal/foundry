---
name: postmortem
description: Run a blameless postmortem that produces a timestamped timeline, multiple contributing factors, and actions each with a named person and a due date — then writes a Foundry runbook so the second occurrence is faster than the first. Use after any SEV1, any SEV2 that ran long, any incident consuming more than 20% of an error budget, or any near miss worth learning from. Do not use to assign responsibility for an outage.
allowed-tools: Read Grep Glob Bash Write Edit
argument-hint: "[incident-id] [--sev 1]"
user-invocable: true
model: opus
effort: high
metadata:
  foundry.vertical: quality
  foundry.io: "incident record -> docs/postmortems/<id>.md + .foundry/runbooks/<slug>.md + finding.v1"
license: Apache-2.0
---

# Blameless postmortem

The purpose is a **system that fails less and recovers faster**, not an explanation of who was
holding the keyboard. Blameless means: assume everyone acted reasonably given the information
they had at the time, and ask what made the wrong action look right.

**"Human error" is never a cause.** It is a signal to keep looking: at the interface that made
the mistake easy, the alert that did not fire, the runbook that was wrong, the guardrail that
did not exist.

## When to run one

| Trigger | Mandatory |
|---|---|
| SEV1 | yes |
| SEV2 exceeding its expected duration | yes |
| Any single event consuming > 20% of an error budget | yes |
| Repeat of an incident with an existing postmortem | yes — and the previous actions get audited |
| Near miss that was caught by luck | yes; these are the cheapest lessons available |
| SEV3 with an obvious fix already shipped | no — a ticket is enough |

## When not to use this

- The incident is still active → run the incident, not the postmortem. Mitigate first.
- You want to determine accountability for a person → wrong instrument. This process is void the
  moment its output can be used against an individual, because the information stops flowing and
  you lose every future postmortem too.
- You need to root-cause a failing test → `superpowers:systematic-debugging`.

## Step 1 — Collect facts before opinions (within 24 hours)

Memory degrades fast and reconstructs itself to be coherent rather than accurate. Collect while
it is fresh:

```bash
ID=${1:?incident id}; OUT=docs/postmortems/$ID; mkdir -p "$OUT/evidence"
# Deploys and config changes in the window - the most common contributing factor
git log --since='<incident-start> -6 hours' --until='<incident-end>' \
  --pretty=format:'%h %ad %an %s' --date=iso-strict > "$OUT/evidence/deploys.txt"
# Alerts fired, in order, with timestamps - and note which ones did NOT fire
# Chat/incident channel export, with timestamps preserved
# Dashboards: screenshot the SLI, not a prose description of it
```

Required raw material: alert timeline, deploy/config timeline, the SLI graph across the whole
window, the chat transcript, and the commands actually run during mitigation. If a scribe kept
notes during the incident, they are the spine of the timeline; if not, note that reconstruction
was required and lower your confidence accordingly.

## Step 2 — Build the timeline

Start from `templates/postmortem.md`; it carries the required section order and the
fields the exit criteria below are checked against.


UTC, ISO 8601, one row per event, facts only — no interpretation in the timeline. Interpretation
belongs in contributing factors, and mixing them is how blame creeps in.

| Time (UTC) | Event | Source |
|---|---|---|
| 2026-08-24T09:41:12Z | Deploy of `orders-api` a1b2c3d completes | CI log |
| 2026-08-24T09:44:00Z | Error ratio rises from 0.05% to 45% (fast-burn threshold is 1.44%) | SLI dashboard |
| 2026-08-24T10:07:31Z | Fast burn-rate alert pages on-call | alert log |
| 2026-08-24T10:09:05Z | On-call acknowledges | pager |
| 2026-08-24T10:26:40Z | Rollback initiated | chat |
| 2026-08-24T10:31:10Z | Error ratio back below 0.1% | SLI dashboard |

Then derive the four numbers that are the actual improvement targets:

| Metric | Definition | This incident | Target |
|---|---|---|---|
| Time to detect (TTD) | impact start → alert fired | 23 m 31 s | ≤ 5 m |
| Time to acknowledge | alert → human engaged | 1 m 34 s | ≤ 5 m |
| Time to mitigate (TTM) | impact start → user impact ends | 47 m 10 s | ≤ 15 m |
| Time to resolve | impact start → cause removed | — | — |
| Error budget consumed | minutes of budget spent | 47.17 m x 45% = 21.2 of 40.32 (53%) | — |

A large gap between impact start and alert is the single most actionable finding a postmortem
can produce, and it is usually the cheapest to fix.

## Step 3 — Contributing factors, plural

Real incidents have several. A single-root-cause narrative is almost always a stopping point
chosen for comfort, and it produces a single fix that does not prevent the next variant.

Technique, phrasing traps and the blast-radius analysis: `references/causal-analysis.md`.

Use the categories, and find at least one in three different categories:

| Category | Ask |
|---|---|
| Trigger | what changed? (deploy, config, traffic, dependency, data, time) |
| Latent condition | what made the system vulnerable before the trigger? |
| Detection | why did it take that long to notice? what alert should have existed? |
| Diagnosis | what made it hard to understand? which telemetry was missing? |
| Mitigation | why did recovery take that long? was the runbook right? |
| Blast radius | why did it affect that many users? where was the isolation? |
| Process/organisational | approvals, ownership gaps, on-call load, knowledge concentration |

The five-whys technique degenerates into a single chain ending at a person. Prefer asking, at
each step, **"what else would have had to be true?"** — it branches, which is what real causality
does.

Counterfactual test for each candidate factor: *if this had been different, would the incident
have been prevented or materially shorter?* If no, it is context, not a contributing factor. Keep
it in the narrative, not in the factor list.

## Step 4 — Actions with owners and dates

Every action has **a named person, a due date, and a tracker link**. All three, or it is not an
action. Count the ones missing any of the three and publish that count — it is the single best
predictor of whether the incident repeats.

Required coverage — at least one action in each of these two classes:

1. **Make this class of failure less likely** (a guardrail, a test, a constraint, a type, a
   staged rollout).
2. **Make it detectable faster** (the alert that should have existed, with its threshold).

Strongly preferred, and required for SEV1:

3. **Make mitigation faster** (a documented, rehearsed, one-command rollback or kill switch).

Rank actions by `(prevented_impact x probability) / effort` and be honest that the long tail will
not be done. Better to commit to three actions that ship than nine that decorate a document.

Reject these action anti-patterns on sight:

| Anti-pattern | Replace with |
|---|---|
| "Be more careful" / "add a reminder" | a guardrail that makes the mistake impossible or loud |
| "Add more monitoring" | one named alert, with a threshold and a runbook |
| "Improve documentation" | the specific runbook, written now, in this postmortem |
| "Review the process" | a named change to a named step, owned |
| An action with a team as owner | a person; teams do not get paged |
| An action with no date | a date; "next quarter" is not a date |

## Step 5 — Write the runbook (this is the compounding part)

Every postmortem writes or updates `.foundry/runbooks/<slug>.md`. This is what makes the second
occurrence cheap, and it is the highest-return artefact of the whole exercise.

Use `templates/runbook.md`. Minimum content: what the symptom looks like, the **first three
commands** to run, how to mitigate **before** understanding, the most common causes with their
fixes, how to escalate and to whom, and how to verify recovery.

The runbook is linked from the alert that fires for this symptom. An alert without a runbook is a
`finding.v1` against `observability-engineer`'s exit criteria.

If `superpowers` is installed, use `superpowers:systematic-debugging` for the causal analysis in
step 3 — it is stronger than an ad-hoc five-whys and it produces the evidence trail this document
needs. If absent, use `${CLAUDE_PLUGIN_ROOT}/references/tdd-fallback.md`
§"Debugging without superpowers".

## Step 6 — Review meeting

Timebox 60 minutes. Attendees: everyone involved, the service owner, and one person from outside
the team (an outsider asks the questions insiders have stopped asking).

Ground rules stated aloud at the start, every time:
- Names appear only as roles in the timeline. "The on-call engineer", not "Marco".
- The question is always "what made this look correct at the time?"
- Disagreement about facts pauses the meeting until the evidence is checked.
- The meeting ends only when every action has a person and a date.

Publish widely. A postmortem read only by the team that had the incident teaches only that team;
a published one is how an organisation stops repeating an incident across services.

## Step 7 — Track completion

Action completion rate is a process metric with a threshold, reviewed monthly:

```bash
node -e '
const fs=require("node:fs");
const items=JSON.parse(fs.readFileSync("docs/postmortems/actions.json","utf8"));
const today=process.argv[1];
const due=items.filter(a=>a.dueDate<=today);
const done=due.filter(a=>a.status==="done");
const rate=due.length?Math.round(100*done.length/due.length):100;
const bad=items.filter(a=>!a.owner||!a.dueDate||!a.tracker);
console.log(JSON.stringify({due:due.length,done:done.length,onTimePercent:rate,malformed:bad.length},null,2));
if(bad.length){console.error("actions missing owner/date/tracker:\n"+bad.map(a=>a.title).join("\n"))}
process.exit(rate<80||bad.length?1:0);
' "$(date -u +%F)"
```

Below **80% completed by due date**, the postmortem process is theatre. File that as a
`finding.v1` with `severity: high` against the engineering owner — it is a more important finding
than anything in the individual incident.

## Exit criteria

1. Timeline in UTC ISO 8601, one row per event, facts only, each with a source.
2. TTD, time to acknowledge, TTM and error budget consumed are all computed as numbers.
3. At least three contributing factors across at least three different categories; each passes
   the counterfactual test.
4. Zero occurrences of "human error", "be more careful" or an unnamed owner in the document.
5. Every action has a named person, a due date and a tracker link; the malformed count is 0.
6. At least one prevention action and one detection action; a mitigation action for SEV1.
7. A runbook at `.foundry/runbooks/<slug>.md` is created or updated, and linked from the alert.
8. The document is published outside the owning team.
9. `actions.json` is updated and the completion check runs in the monthly review.

## Degradation

- **No incident scribe, timeline must be reconstructed** → mark each reconstructed row
  `source: recollection`, and make "appoint a scribe role" an action. Do not present a
  reconstruction as a log.
- **Telemetry missing for the window** → that gap is itself a top contributing factor under
  Diagnosis; hand it to `observability-engineer` as a `high` finding and say plainly which
  questions could not be answered.
- **No tracker** → keep `docs/postmortems/actions.json` in the repo as the tracker; the check
  above works against it. An action list without a mechanism is a wish list.
- **Organisation is not blameless in practice** → do not run the meeting yet. Publish a
  facts-only timeline and the metrics, and escalate the cultural precondition. A postmortem run
  in a blaming culture produces sanitised facts, which is worse than no postmortem.
- **Vendor-caused incident** → you still own detection, mitigation and blast radius. Write those
  factors; "the vendor was down" is a trigger, never the whole story.

## Deliberately not covered

Incident command during the event and severity definitions (`sre-planner`), instrumentation
(`observability-engineer`), performance analysis of the failure (`performance-engineer`), legal
or contractual consequences, and customer communication drafting.
