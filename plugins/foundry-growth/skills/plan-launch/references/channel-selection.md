# Channel selection from evidence

A channel is a hypothesis about where your audience already spends attention. This file scores
that hypothesis. It deliberately contains **no list of platforms**: any list written down here
would be a claim about the outside world that goes stale, and a plan built on a remembered list
is a plan built on where the author last had a good day.

The input is the audience evidence from step 3 of the skill. If that section is empty, this
procedure cannot be run honestly — score nothing, pick at most two channels as an explicit
experiment, and label the whole channel plan `hypothesis, no evidence`.

## Rule 0 — a candidate needs a provenance line before it may be scored

Every candidate channel enters the table with one line saying where the idea came from:

- a referrer row in traffic data (`gh api repos/{owner}/{repo}/traffic/popular/referrers`),
- the origin of a person who already filed an issue, asked a question or starred the project,
- a place where the adjacent problem is currently discussed, found by search in this session,
- an explicit, labelled guess.

A candidate whose provenance is "everyone posts there" is a guess, and gets written down as one.
Guesses may be scored; they may not be laundered into evidence.

## The five dimensions

Score each dimension 0, 1 or 2. **A dimension scored from memory rather than from something read
in this session scores 0** and carries the marker `unverified`. That rule is the whole mechanism:
it makes the cheap, confident answer also the losing answer.

| # | Dimension | 2 | 1 | 0 |
|---|---|---|---|---|
| D1 | **Audience presence** — evidence that the people described in the positioning are there | a named referrer, issue author or thread found in this session | plausible adjacency argued from a source read in this session | asserted, or `unverified` |
| D2 | **Topic fit under the channel's own written rules** — the post is on-topic and self-promotion is permitted in this form | the rules page was fetched and the permitting line quoted | rules fetched but ambiguous; a human must confirm | rules not fetched, or the post is off-topic |
| D3 | **Standing** — the account that will post has whatever history or membership the channel requires | your own profile checked in this session and the requirement read | account exists, requirement not stated by the channel | no account, or the requirement is unmet |
| D4 | **Answering capacity** — the named owner can be present in that channel during its reply window | owner named, hours stated, notifications reachable | owner named, hours uncertain | nobody named |
| D5 | **Durability** — the post stays findable after the day it is posted | the channel exposes a stable public URL and is indexed | archived but hard to find | ephemeral by design |

**Selection rule.** A channel is eligible only if D1 ≥ 1 **and** D2 ≥ 1 **and** D3 ≥ 1. Rank the
eligible channels by total score and take the top **three at most**. Record the rejected ones with
their scores in the plan's `outOfScope` — the rejections are the part a future launch will need.

A total below 6 with no zero is a weak channel, not a forbidden one; post there only if fewer than
three channels are eligible, and say in the plan that it was a fill.

## Runtime rules verification — the binding protocol

Perform this for every eligible channel, at plan time, in this session.

1. Fetch the channel's own rules, guidelines or FAQ page with `WebFetch`. Not a summary of it, not
   a third-party article about it — the page the channel itself publishes.
2. Record, in the plan's channel table: the exact URL, `checked: YYYY-MM-DD`, who read it, and the
   **quoted line** that permits or constrains the post.
3. Record any of these that the page actually states: self-promotion policy, account age,
   reputation or membership requirement, posting frequency limit, title and formatting
   constraints, link policy, required disclosure of affiliation, moderation route for a mistake.
4. Anything the page does not state is left blank. A blank cell is a fact about your evidence; a
   filled one you invented is a landmine.

**Never written down, in any circumstance, from memory or inference:** a channel's ranking or
recommendation behaviour, its reach, a "best time to post", an expected click-through or
conversion rate, an industry-average figure, a follower or subscriber threshold, a pricing tier,
or a moderator's disposition. These change without notice and none of them is verifiable from this
repository. If a number of this kind is genuinely needed for a decision, fetch it now with its
source and date, or make the decision without it and say which.

**Re-check shelf life.** A rules line older than 30 days at the moment of posting is re-fetched
before the post goes out. Put that re-check in the launch-day wave's `gate`.

## Adaptation, not duplication

Each channel gets copy written for that channel's readers and constraints. The same paragraph
pasted into three places is worse on every axis: it reads as broadcast, it usually violates at
least one of the three rules pages you just fetched, and when it fails you cannot tell which
channel was wrong because the stimulus was not really the same anyway.

What stays identical across channels: the claim itself, and every number in it. Adapting the
framing is craft; adapting the claim per audience is two different promises made in public on the
same day.

## Refused by name

These are not discouraged. They are refused, and the refusal is recorded in the plan:

- coordinated upvoting, vote rings, or asking a group to upvote rather than to read;
- sockpuppet, alternate or undisclosed accounts, including a colleague posting as an unaffiliated
  enthusiast;
- comments seeded in advance and presented as organic;
- deleting and reposting to evade a rate limit, a downvote or a moderation decision;
- messages to addresses collected by scraping, or bulk identical outreach to people who never
  asked to hear from you;
- undisclosed sponsorship, affiliation or paid placement;
- a fabricated deadline, a fabricated user count, a testimonial nobody gave, or a logo belonging
  to somebody who is not a user.

Consent for any contact list, GDPR lawfulness for outreach, advertising-claims law and sponsorship
disclosure are **not** decided here: flag them and hand them to `foundry-legal`. Improvising a
legal position inside a launch plan is how a growth document becomes a liability.

## Degradation

- **`WebFetch` and `WebSearch` both unavailable** → no channel may score above 0 on D2. Mark every
  channel `RULES UNVERIFIED`, state in the plan that a human confirms each rules page before
  posting, and put that confirmation in the launch-day `gate`. Do not substitute recalled rules;
  an unverified plan that says so is usable, and one that pretends is not.
- **`gh` unavailable or the project is not on GitHub** → D1 evidence comes from the hosting
  provider's analytics read by hand, or from the issue and question history you can actually see.
  Label it `manual reading` with the date.
- **Zero eligible channels** → that is a result. Report it: the audience evidence does not yet
  support a broadcast, and the honest next move is `find-collaborators` (one-by-one contact) or
  `build-audience` (earn the standing first), not posting anyway into a channel whose rules you
  would be breaking.

## The output row

One row per candidate, kept in `docs/growth/launch-plan.md`, rejections included:

| channel | provenance | D1 | D2 | D3 | D4 | D5 | total | rules URL | checked | owner | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|

`verdict` is `selected`, `fill`, `rejected` or `refused` — and `refused` names which line of the
list above applied.
