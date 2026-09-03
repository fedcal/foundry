# Action quality — the four tests, and how each fails

One action per retrospective. It must pass all four tests. Most retrospective actions fail at
least two, which is why most retrospective actions do not happen.

## 1. Owned by a name

**Fails as:** "the team will…", "we should…", "everyone needs to…"

Collective ownership is the most reliable way for nothing to happen: each person assumes the
action is being carried by someone with more slack. One name does not mean one person does all
the work — it means one person is accountable for it being done, and is the person to ask.

## 2. Dated, inside the next cycle

**Fails as:** "going forward", "from now on", "when we get time"

An action without a date is a wish. The date must fall inside the next cycle, because the next
retrospective is where it will be checked — an action due in three months is checked by nobody.

If the work genuinely takes longer than a cycle, the action is the first slice of it, dated
inside the cycle, and the rest belongs on the backlog as tracked work.

## 3. Within the team's authority

**Fails as:** "get the platform team to prioritise our ticket", "change the release process"

If the team cannot make the decision, the action is not the fix — the action is **escalating it,
to a named recipient, by a date**. That is something the team can actually do and be held to.

Record the underlying problem as `risk.v1` for `foundry-pmo:risk-manager` so it stays visible
after the retrospective closes. Actions that depend on somebody outside the room are the single
largest category of retrospective actions that quietly die.

## 4. Observable

**Fails as:** "communicate better", "be more careful with reviews", "improve quality"

Somebody outside the room must be able to tell whether it happened. Rewrite until they can:

| Wish | Observable action |
|---|---|
| "communicate better" | "post a one-line deploy note in `#deploys`, from Monday, owner: A" |
| "be more careful with reviews" | "set a WIP limit of 3 on the review column, by Friday, owner: B" |
| "improve test quality" | "add a CI check that fails when a new endpoint has no test, by end of cycle, owner: C" |
| "reduce interruptions" | "one named support rota member per cycle, starting next cycle, owner: D" |

## Where the action lives

On the board, as a tracked item in the next cycle, created through
`foundry-pmo:tracker-operator`. Not in a document, not in a wiki page, not in the retrospective
notes.

An improvement that is not on the board competes with the board for the same hours and loses
every time. Putting it on the board also makes it visible at the next Planning, which is where
capacity for it gets reserved — or where the team honestly decides it will not happen.

## Checking it next cycle

The first step of the next retrospective is checking this action: done, partly done, or not
started. Not started is the first topic and outranks anything new.

Two consecutive not-started actions is a finding in itself, and generating a third action is
avoidance. The real question at that point is whether the team has the capacity or the authority
to improve anything, and that question goes upward.
