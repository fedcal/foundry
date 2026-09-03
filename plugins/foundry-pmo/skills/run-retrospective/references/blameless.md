# Blameless framing — rewriting accusations into system statements

Blameless does not mean consequence-free, and it does not mean vague. It means the object of
analysis is the system that allowed a reasonable action to produce a bad outcome. Vagueness is
the failure mode of teams that adopt the word without the method: "mistakes were made" analyses
nothing and protects no one.

## The rewrite

| Said in the room | Recorded in `review.v1` |
|---|---|
| "X broke the build" | "a change reached main without the test that would have caught it" |
| "we were sloppy about reviews" | "review latency p85 was 3.2 days; the review column has no WIP limit" |
| "QA is a bottleneck" | "one person holds sign-off for six streams" |
| "people keep forgetting the migration step" | "the migration step is manual and has no check in CI" |
| "the intern deployed on Friday" | "the deploy pipeline permits production deploys with no second approver" |
| "requirements were unclear" | "three of eight selected items entered the Sprint without acceptance criteria" |

Each rewrite does the same thing: it converts something only a person can fix by trying harder
into something the team can change on purpose.

## The counterfactual question

**What made that action reasonable at the time?**

Everyone acts on the information available to them. If an action looks stupid in hindsight, then
either the information was wrong, or it was missing, or the incentive pointed elsewhere — and
each of those is a finding the team can act on. "They should have known" is not an analysis; it
is a restatement that the outcome was bad.

Hindsight bias is the specific enemy here. After the fact, the correct path is obvious and the
signals that pointed to it are salient. They were not salient at the time, among all the signals
that pointed nowhere.

## Rules that hold the frame

- **No names in cause statements.** A name appears in `review.v1` only as an action owner. An
  owner is an accountability; a name in a cause is an accusation.
- **Attack the class, not the instance.** "This deploy lacked a rollback plan" is weaker than
  "deploys do not require a rollback plan".
- **Separate the decision from the outcome.** A good decision can have a bad outcome. Judging
  decisions by their results teaches people to avoid decisions rather than to reason well.
- **Watch the power gradient.** If a manager is present and the team has less power, the data
  degrades — people report what is safe. Offer to run the session without them, and say why.

## When behaviour genuinely is the issue

Blameless framing is not a prohibition on addressing individual conduct. It is a statement about
where that conversation belongs: privately, with the person's manager, outside the retrospective.
Using a team meeting for it corrupts both — the team stops speaking freely, and the person gets a
performance conversation held in front of an audience.

## The line that ends most bad retrospectives

When a theme returns for the third cycle with no action, stop discussing it. Repeated discussion
without change is how a team performs concern instead of resolving it, and it teaches everyone
present that the meeting does not matter. Escalate it as `risk.v1` with a named recipient and
move on.
