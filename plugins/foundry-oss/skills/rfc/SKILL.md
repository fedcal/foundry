---
name: rfc
description: Run the RFC lifecycle for a change that crosses the project's proposal threshold — draft the document, open the discussion window, drive it to a decision under the project's own rules, and record the outcome as an ADR plus a Foundry memory fact. Use when a change needs a major release, adds a dependency, changes a format or a default, or is too large to review as a pull request. Not for bug fixes, docs or refactors with no observable change.
user-invocable: true
argument-hint: "<new|discuss|decide|record> [rfc-number-or-slug]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: governance
  foundry.io: "proposal -> accepted/rejected RFC + adr.v1 + fact.v1"
license: Apache-2.0
---

# RFC lifecycle

An RFC exists to make a decision **before** the code makes it for you, and to leave a written
reason that survives the people who made it. Its value is the recorded rejection as much as the
acceptance: the same idea returns every eighteen months, and the archive is what stops the
project re-litigating it.

**Rule:** the RFC follows *this project's* rules — the threshold, the window and the decision
authority in its `GOVERNANCE.md`. If that file does not exist, say so and use the defaults
below explicitly labelled as defaults, or stop and hand off to `governance-architect`.

## Step 0 — Is an RFC required at all?

Read the threshold: `grep -A20 -i 'RFC' GOVERNANCE.md CONTRIBUTING.md 2>/dev/null`.

Default threshold when the project has none (state that you are using a default):

Required — the change needs a major release under SemVer 2.0.0 §8; adds or removes a runtime
dependency or raises a minimum toolchain version; changes a persisted or wire format; changes
security behaviour or a default; changes governance, licence or support policy; or exceeds the
project's effort ceiling.

Not required — bug fixes restoring documented behaviour; docs and tests; dependency patch
bumps; internal refactors with no observable change.

If it is not required, say so and stop. Pushing a small change through a heavy process is the
most reliable way to make contributors stop proposing things.

## Step 1 — Draft (`new`)

```bash
ls docs/rfc/ 2>/dev/null || mkdir -p docs/rfc
printf '%04d\n' "$(( $(ls docs/rfc/[0-9]*.md 2>/dev/null | sed -E 's#.*/([0-9]{4}).*#\1#' \
  | sort -n | tail -1 | sed 's/^0*//' ) + 1 ))"
cp "${CLAUDE_SKILL_DIR}/templates/rfc.md" docs/rfc/NNNN-<slug>.md
```

Before writing a line, gather prior art from **this** repository — an RFC that ignores the last
attempt gets rejected for the same reason:

```bash
grep -rln '<keyword>' docs/rfc/ docs/adr/ 2>/dev/null
gh search issues --repo owner/repo '<keyword>' --state all --limit 20 --json number,title,state,url
```

Quality bar for the draft — check each before opening the PR:

1. **Motivation is a problem, not a solution.** If the motivation section names the proposed
   mechanism, rewrite it. A reader must be able to disagree with your solution and still agree
   with the problem.
2. **At least two alternatives**, one of which is *do nothing*, each with why it was rejected.
   A single-option RFC is a request for rubber-stamping.
3. **The interface is shown**, not described: the signature, the config key, the payload, the
   CLI flag, as the user will type it.
4. **Migration and compatibility are answered**, including whether existing users break and
   what the deprecation timeline is. "TBD" here is an automatic rejection.
5. **Costs are stated**: implementation effort, ongoing maintenance surface, new dependencies,
   documentation debt, and who will carry them.
6. **Unresolved questions are listed explicitly.** Hiding them delays the objection; it does not
   prevent it.
7. It is readable in **15 minutes**. Longer means the change should be split.

If turning the idea into a specification is still fuzzy, invoke `superpowers:brainstorming`
first; if `superpowers` is absent, do the divergence manually and note it in the RFC's
*Prior art* section.

Open it as a pull request that adds only the RFC file, with status `draft`, and label
`type:feature` + `status:needs-decision`.

## Step 2 — Discussion window (`discuss`)

- Announce in the canonical channel named in `GOVERNANCE.md`. An RFC nobody was told about did
  not have a discussion window; it had a silence.
- Window length: from `GOVERNANCE.md`; default **14 days**, stated as a date in the thread.
- The author maintains an **open-questions table** at the top of the RFC and updates it as
  points are settled. Consensus is what the document says, not what the thread felt like.
- Every substantive objection gets one of three fates, recorded in the document: *incorporated*,
  *rejected with a reason*, or *deferred to a listed follow-up*. An objection that scrolled off
  the thread has not been handled.
- Facilitation duties, including how to stop a thread going in circles, are in
  `references/facilitation.md`.
- **Final comment period**: when the discussion converges, announce an FCP (default 7 days) with
  the intended disposition, in the thread and in the channel. New objections during FCP must
  raise something not already answered; procedural repeats do not restart the clock.

Extend the window once, with a reason, if a materially affected party has not been heard.
Repeated extension without new information is avoidance — go to Step 3 and record the split.

## Step 3 — Decision (`decide`)

Apply the project's decision rule verbatim. Whichever applies, the outcome is **public and
written**:

- Lazy consensus: state that the window elapsed with no unresolved objection, and the dates.
- Vote: record each voter, their `+1`/`0`/`-1`, and the reasoning for every non-`0`. A binding
  `-1` requires a written technical reason and an alternative; otherwise it counts as `0`.
- Tie-break: name the rule invoked and who invoked it.
- Recusals: list them.

Outcomes: `accepted` · `rejected` · `withdrawn` (by the author) · `postponed` (with the
condition that would revive it, e.g. "revisit if the upstream API stabilises"). Never leave an
RFC in `draft` forever — an abandoned proposal is marked `withdrawn` after the stale window in
`SUPPORT.md`, with a comment saying it may be reopened.

Merge the RFC PR **whatever the outcome**, with the status set. Rejected RFCs stay in the
repository; deleting them destroys the reason and guarantees the repeat.

## Step 4 — Record the outcome (`record`)

Three artifacts, in this order:

**1. ADR.** Emit `adr.v1` — see `plugins/foundry-core/schemas/adr.v1.schema.json`. Mapping:

| RFC section | ADR field |
|---|---|
| Motivation | `context` |
| Goals / constraints | `drivers[]` |
| Proposal + alternatives | `options[]` (≥ 2, each with `pros`/`cons`) |
| Decision text | `decision` |
| Deciders and votes | `deciders[]` |
| Drawbacks, migration cost, risks | `consequences.negative[]`, `consequences.risks[]` |
| Supersedes an earlier RFC | `supersedes` |

Write it with `mcp__plugin_foundry-core_foundry__blackboard_write`, validate with `mcp__plugin_foundry-core_foundry__contract_validate`,
then render `docs/adr/NNNN-<slug>.md`. An `accepted` RFC with no ADR is not recorded — the RFC
holds the debate, the ADR holds the decision.

**2. Memory fact.** One `fact.v1`, type `decision`, via `mcp__plugin_foundry-core_foundry__memory_write` — never by
hand:

```yaml
type: decision
scope: project
title: <the decision itself, not the topic, <= 80 chars>
tags: [rfc, <area>]
confidence: high
source: adr-NNNN
```

Body ≤ 120 words with the mandatory `**Why:**` and `**How to apply:**` lines. `supersedes` set
when it replaces an earlier decision, so the chain stays walkable.

**3. Consequences.** Link the RFC from the tracking issue; open the implementation issues; if
the decision creates a deprecation, hand it to `release-communicator` so it gets a dated removal
version rather than an intention.

## Exit criteria

- [ ] Threshold checked against `GOVERNANCE.md`, or the default used and labelled as such.
- [ ] Prior art searched and cited (or "none found", with the search recorded).
- [ ] Draft has ≥ 2 alternatives including *do nothing*, a shown interface, and a migration
      section with no "TBD".
- [ ] Window announced with dates in the canonical channel; FCP announced separately.
- [ ] Every substantive objection resolved as incorporated / rejected-with-reason / deferred,
      recorded in the document.
- [ ] Decision recorded publicly with the rule applied, the voters and any recusals.
- [ ] RFC merged with a terminal status; rejected and withdrawn RFCs retained.
- [ ] `adr.v1` written and validated; `docs/adr/NNNN-*.md` rendered.
- [ ] `fact.v1` written through `memory_write` with `source: adr-NNNN`.
- [ ] Implementation issues opened, or the decision explicitly needs no work.

## What this skill deliberately does not cover

- **Deciding.** It runs the process; the authority comes from `GOVERNANCE.md` and the humans
  named there. Never record a decision no human made.
- **Setting the threshold or the decision rules** — `governance-architect`.
- **Implementing the accepted proposal**, or estimating it beyond the RFC's cost section.
- **Code review of the eventual PR** — delegate to `superpowers:requesting-code-review`.
- **Vulnerabilities.** A security change with an undisclosed flaw behind it does not go through
  a public RFC; use `security-advisory` and RFC the design afterwards.
- **Marketing an accepted RFC**, or negotiating with a downstream project that dislikes it.

## References

- `templates/rfc.md` — the document skeleton.
- `references/facilitation.md` — running the window, handling deadlock, spotting false consensus.
