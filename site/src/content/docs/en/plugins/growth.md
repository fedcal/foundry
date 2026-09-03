---
title: foundry-growth
description: Everything around the project rather than inside it — positioning, launch, audience, fundraising narrative, personal reputation, and finding collaborators in your own field.
sidebar:
  order: 7.5
---

Building the thing is the part Foundry already covered. `foundry-growth` covers the rest: deciding
who the project is for and what it claims, launching it without pretending, holding an audience,
asking for money from the right kind of funder, being findable by the people who matter, and
finding the people to work with.

It is the vertical most tempted to fabricate, so it is the one held tightest. No agent here may
assert a platform's current rules, a follower threshold, a fund's cheque size, an accelerator's
deadline, a conversion benchmark or a "best time to post" — all of it goes stale and none of it is
verifiable from your repository. Every such fact is fetched at runtime from its own source and
stamped with the date it was checked, or it does not appear.

## Install

```bash
/plugin install foundry-growth@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- The project works and nobody knows it exists.
- Your description of it could describe three other projects, and no two people on the team answer
  "who is this for" the same way.
- A launch date is being discussed and nobody has written down what would count as it going well.
- You are about to approach a funder, or a grant call is open, and the deck has never been
  stress-tested by anyone willing to say no.
- Your best work is invisible, under NDA, or inside a private repository — and you need to be
  credible anyway.
- The project has outgrown one person.

## When not to use it

- It does not write your financial model. Projections, unit economics, break-even, NPV/IRR and TCO
  belong to `foundry-economics`. Growth writes the argument; economics writes the numbers.
- It does not do grant administration — eligibility forms, budget tables, timesheets, milestone
  reporting. That is `foundry-economics:funding-analyst`. Growth does the targeting and the
  narrative.
- It does not run the contributor funnel inside an open source repository, write CONTRIBUTING or
  triage issues. That is `foundry-oss`. Growth brings people to the project; `foundry-oss` runs
  what happens once they arrive.
- It does not give legal advice. Marketing consent, GDPR for a contact list, advertising-claims
  law, endorsement disclosure, contracts and IP assignment all go to `foundry-legal`.
- It will not help you fake anything. Invented testimonials, logos of non-users, uncounted user
  counts, manufactured scarcity and scraped contact lists are refused by name, not rewritten into
  something more palatable.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `positioning-strategist` | Settles who the project is for and what it claims before any copy, landing page, launch or pitch inherits the answer. Real alternatives evaluated including doing nothing and doing it by hand, explicit non-goals, a name checked against live registries rather than memory, and a final pass that traces every superiority word to an evidence artifact or cuts it. | `sonnet` | `medium` |
| `launch-strategist` | Readiness gates that must pass before a date is allowed to exist, channels chosen from where the audience already is with each channel's current rules fetched at launch time, success defined in numbers agreed beforehand, the first-hours protocol, and an honest reading of a flat launch — wrong channel, wrong positioning and no demand are three different fixes. | `sonnet` | `medium` |
| `audience-builder` | Sustained attention rather than a one-day spike: an editorial backlog mined from work that already happened, a cadence sized to the hours you actually have, metrics that state the question each one can and cannot answer, and the compounding assets that keep working after the post scrolls away. | `sonnet` | `medium` |
| `fundraising-strategist` | Starts from whether you should raise at all, and from whom. Funding types and what each really demands, readiness assessed as evidence that exists rather than a story, the deck as an argument rather than a template, the data room, the outreach sequence, and rehearsal of the questions that will be asked — including "why hasn't this worked yet". | `opus` | `high` |
| `personal-brand-strategist` | For people who find self-promotion distasteful: describing real work accurately is documentation, not promotion. A reproducible audit of what a stranger currently finds, the portfolio as verifiable evidence, public writing and CFPs, and the claim-verification pass where anything a reader cannot check gets cut. | `sonnet` | `medium` |
| `collaborator-scout` | Names the gap and what you offer in return before anyone is approached. Candidates derived from public artifacts rather than a list of platforms, outreach that earns a reply, the fit conversation including the awkward questions, a scoped trial with a defined end, and terms — ownership, credit, decision rights, exit — settled before the work starts. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `position-project` | Before a landing page, launch or pitch is written; when the current description could describe three other projects; when nobody gives the same answer to "who is this for". Reads the repository first to find what the project actually does versus what its author says it does. Produces `docs/growth/positioning.md`. |
| `plan-launch` | When a launch date is being discussed, or a previous launch landed flat. Runs a readiness gate first that is executable against the repository, and is willing to conclude "not ready, postpone". Produces `docs/growth/launch-plan.md` and a `plan.v1`. |
| `build-audience` | When the project has shipped but nobody knows it exists, or publishing has been sporadic. Mines the repository for material that already exists and sizes the cadence to a stated number of hours per week. Produces `docs/growth/audience-plan.md`. |
| `prepare-fundraise` | Before approaching any funder, when a grant call is being considered, or when a deck has never been stress-tested. Begins with "should you raise at all" and may answer no. Produces `docs/growth/fundraising/` with a readiness assessment, narrative, deck outline, evidence index and data-room checklist. |
| `audit-personal-brand` | Before a job search, a round, a conference proposal or a collaboration approach; when what a stranger finds does not match what you can actually do. Produces `docs/growth/personal-brand.md` with a small prioritised action set, not forty tasks. |
| `find-collaborators` | When the project has outgrown one person, a skill is missing, or a previous collaboration ended badly. Produces `docs/growth/collaborators.md`. |

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `positioning-strategist` | `requirement.v1` | `adr.v1` |
| `launch-strategist` | `adr.v1` | `plan.v1` |
| `audience-builder` | `plan.v1` | `plan.v1` |
| `fundraising-strategist` | `requirement.v1` | `review.v1` |
| `personal-brand-strategist` | `requirement.v1` | `review.v1` |
| `collaborator-scout` | `requirement.v1` | `plan.v1` |

Positioning is an `adr.v1` because it is a decision with alternatives and consequences, and because
everything downstream inherits it — the launch reads it, the pitch quotes it, the outreach depends
on it. Reopening a position supersedes the previous ADR rather than editing it.

## The claim gate

This is the only vertical that ships a hook of its own. `guard-claims.mjs` runs on `PreToolUse` for
`Write` and `Edit`, and asks for confirmation — never blocks — when outbound copy contains a
substantiation risk: a percentage, a multiple, a money figure or a user count with no source beside
it; an unqualified superlative; borrowed credibility (`trusted by`, `as seen in`, a testimonial
block); manufactured urgency; or a prediction written in the grammar of a fact. The reason quotes
the exact fragments and says what would make each one publishable.

It only reads prose under an outbound path — `growth/`, `marketing/`, `launch/`, `pitch/`,
`press/`, `fundraising/` and similar — so source, tests and documentation never trigger it. It is
silent until `foundry init` has run, respects `enforcement: "off"` and
`{"growth": {"claimGuard": false}}`, and can be suspended by an override in
`.foundry/overrides.json` that carries an expiry. An override with no expiry is ignored, by the
same kernel rule that governs every Foundry gate.

It is a lexical tripwire, not a fact-checker: it cannot tell a true "40% faster" from a false one,
only that nothing beside it says where the number came from. A silent run means "nothing obvious",
never "substantiated".

## Limits

- Search results are personalised and time-varying. A recorded crowding count is a dated
  observation, not a measurement a second run reproduces.
- Estimating how quickly a competitor could copy a feature is work inside someone else's codebase.
  These agents force the assumption to be stated, which makes it honest without making it accurate.
- The gate is lexical. It will flag a positioning document that quotes "trusted by 10,000
  developers" as an example of what not to write. That is the correct trade for a pattern matcher
  with no parser: approve it and move on.
- Nothing here makes a project worth attention. If the audience is not the bottleneck, the
  `audience-builder` is instructed to say so and stop.
