# Causal analysis without blame

Loaded on demand by the `postmortem` skill.

## Why "root cause" is the wrong frame

Complex systems do not fail for one reason. They run continuously in a partially degraded state,
and an incident is what happens when several degradations line up. Naming a single root cause
means choosing a stopping point, and the stopping point chosen is almost always the last human
action before the failure became visible — which is exactly the least useful place to stop.

Use **contributing factors**, plural, and stop when each one has an action or an explicit
decision to accept it.

## Instead of five whys: "what else would have had to be true?"

Five whys produces a chain. Chains terminate at people. Ask instead, at each level:

> For this outcome to occur, what else would have had to be true?

This branches, and the branches are where the cheap fixes are. Example:

*The bad config reached production.*
- The config was wrong when written → **was the format validated anywhere?**
- No test caught it → **is there a config schema? a smoke test on boot?**
- The rollout was global and immediate → **why is there no staged rollout?**
- Nothing alerted for 23 minutes → **which alert should have existed?**
- Rollback took 17 minutes → **why is rollback not one command?**

Five distinct actions, only one of which is about the person who wrote the config — and that one
turns into "add schema validation", not "be careful".

## The counterfactual test

For every candidate factor: *if this had been different, would the incident have been prevented
or materially shorter?*

- **Yes** → contributing factor; it gets an action.
- **No** → context. Keep it in the narrative, drop it from the factor list.

This test is what stops a postmortem becoming an unbounded list of everything that is imperfect
about the system.

## Substitution test

Before writing anything about a person's action, ask: *would another competent engineer, with the
same information, the same tooling and the same time pressure, have done the same thing?*

If yes — and it almost always is — the finding is about the information, the tooling or the
pressure. Write that instead.

## Phrases that indicate the analysis stopped too early

| Phrase | What to ask next |
|---|---|
| "Human error" | what made the wrong action look right? |
| "Someone forgot to..." | why was it possible to forget? where is the guardrail? |
| "The runbook was not followed" | was it findable? correct? was it tested since the last change? |
| "They should have known" | how would they have known? from which signal? |
| "A one-off mistake" | how many other one-offs are one deploy away? |
| "The vendor was down" | why did our system amplify it instead of degrading? |
| "It only affected a few users" | how do we know? is the measurement able to see more? |

## Detection gap analysis

The gap between impact start and alert is usually the cheapest large win in a postmortem. Work it
explicitly:

1. What was the first **signal** that differed from normal, and at what time? (Often minutes
   before the alert, visible in a graph nobody was watching.)
2. Was there an alert on that signal? If not, why not: not instrumented, not alerted, threshold
   too high, or window too long?
3. If there was, why did it not page: silenced, routed to a channel, below threshold, or
   inhibited by another alert?
4. What is the alert that would have fired at the first signal, and what is its threshold?

The answer to 4 is an action with a number in it. That is what a good postmortem produces.

## Blast-radius analysis

Separate from cause. Ask, independently of why it broke:

- Why did it affect **that many** users rather than fewer?
- What isolation boundary was missing: tenant, region, cell, canary, feature flag, bulkhead?
- Would a staged rollout have caught it? At what percentage, and after how long?
- Did retries, queues or caches **amplify** the failure? Retry amplification turns a degradation
  into an outage and is one of the most common blast-radius factors.

Blast-radius actions often deliver more value than prevention actions, because they work against
the next failure too — including the one you have not imagined.

## Repeat incidents

If a postmortem already exists for this class of failure, the new one must include an audit of
the previous actions:

| Previous action | Owner | Due | Status | If not done, why? |
|---|---|---|---|---|

A repeat incident with incomplete prior actions is a **process** finding of `severity: high`, and
it outranks anything technical in the current document. Fixing the process that drops actions
prevents more incidents than fixing this particular bug.

## Writing style rules

- Names appear only as roles: "the on-call engineer", "the reviewer".
- Timeline entries are facts with sources; interpretation goes in section 5.
- No passive voice hiding an actor where the actor is a **system** ("the config was applied" is
  fine if you name what applied it).
- No speculation presented as fact. If a factor is a hypothesis, label it and state what evidence
  would confirm it.
- Include "where we got lucky". It is the section that predicts the next incident.
