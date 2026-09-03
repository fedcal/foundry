# Working without `superpowers`

Foundry declares a **soft** dependency on the `superpowers` plugin. When it is installed, the
assets in `foundry-quality` delegate to it and do not reimplement it:

| Need | Delegate to |
|---|---|
| Test-first discipline | `superpowers:test-driven-development` |
| Root-causing a failure | `superpowers:systematic-debugging` |
| Turning an idea into a spec | `superpowers:brainstorming` |
| Turning a spec into a plan | `superpowers:writing-plans` |
| Review, giving and receiving | `superpowers:requesting-code-review`, `superpowers:receiving-code-review` |
| Claiming completion | `superpowers:verification-before-completion` |

This file is the **reduced fallback** used only when `superpowers` is absent. It is deliberately
thinner than the real thing. Detect first, announce which path you took, then continue:

```bash
ls -d ~/.claude/plugins/*/superpowers 2>/dev/null || echo "superpowers: not installed - using fallback"
```

Always say in your summary which path was used. Silent degradation hides a capability gap.

---

## Test-first, reduced

1. **Write the assertion before the implementation.** Start from the acceptance criterion, in its
   given/when/then form, and turn it into one failing test.
2. **Watch it fail, and read the failure message.** A test that has never failed proves nothing.
   If the failure message would not tell a stranger what broke, fix the message now — you will be
   the stranger in six months.
3. **Write the smallest change that makes it pass.** Not the design you intend to end at; the
   smallest change. The design emerges from the third or fourth test, not the first.
4. **Run the whole affected suite**, not just the new test.
5. **Refactor with the tests green**, in a separate step from behaviour change. Never both at
   once — when something breaks you need to know which of the two did it.
6. **Repeat per acceptance criterion**, not per function.

Checklist before calling a test done:

- [ ] It fails when the behaviour is removed (verify by deleting the implementation line).
- [ ] Its name states the behaviour, not the method: `rejects an order below the minimum`,
      not `testCreateOrder2`.
- [ ] It has one reason to fail.
- [ ] It does not assert that a mock was called, unless the interaction *is* the requirement.
- [ ] It does not depend on order, on wall-clock time, or on another test's data.
- [ ] It fails with a message that names the expected and actual values.

---

## Debugging without `superpowers`

A reduced version of a systematic loop. The discipline that matters is: **one variable at a
time, and write it down.**

1. **Reproduce reliably** before changing anything. If it reproduces 1 in 10, you need 20 runs to
   evaluate any fix — decide that now, not after you have "fixed" it.
2. **Write the current belief as a falsifiable statement.** "The pool is exhausted because
   connections are not returned on the error path."
3. **Design the cheapest experiment that could prove it wrong**, not the one that confirms it.
   Confirmation is how a debugging session takes a day.
4. **Change one thing.** Record what you changed and what happened, in a file, not in your head.
5. **Bisect when the search space is large**: `git bisect` over commits, binary search over
   config, or halving the input.
6. **When the hypothesis survives, prove it twice**: make the bug appear and disappear on demand.
   A fix that only makes the symptom stop is a fix you cannot defend.
7. **Write the regression test before the fix**, and confirm it fails.

Record for the postmortem or the finding: the reproduction, the falsified hypotheses (they are
evidence too), the confirmed cause, and the test that now guards it.

---

## Verification before claiming completion, reduced

Never claim done from intention. Run the checks and paste the observed output.

- [ ] The exact command a reviewer would run, and its exit code, recorded.
- [ ] The new test fails when the change is reverted (demonstrate it, do not assert it).
- [ ] The full suite ran, not just the touched file.
- [ ] Every numeric exit criterion in the asset has a measured value next to it.
- [ ] Every claim in the summary maps to an observed output, not to an expectation.
- [ ] Artefacts written to the paths the output contract names, and validated against the schema.

If any box cannot be ticked, report the work as **partial** with the blocking item named. A
`handoff.v1` with `status: "partial"` and an honest `blockedBy` is worth more than a
`"complete"` that is wrong.

---

## Working without `superpowers` for planning and elicitation

**In place of `brainstorming`** — to elicit requirements from a stakeholder:
ask for a concrete recent example rather than a general rule; ask what happens when it goes
wrong; ask who complains and how you find out; ask what they do today as a workaround. Write the
answers as given/when/then acceptance criteria and read them back for confirmation before
building anything on them.

**In place of `writing-plans`** — shape work into waves where each wave has a gate that a
reviewer can run as a command and a numeric threshold. A wave without a runnable gate is a wish.
Order waves so that the cheapest thing that could invalidate the plan happens first.
