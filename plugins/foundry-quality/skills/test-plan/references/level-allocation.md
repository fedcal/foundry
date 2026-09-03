# Level allocation — worked rules and examples

Loaded on demand by the `test-plan` skill. This file exists so `SKILL.md` stays short.

## The allocation table

| Criterion looks like | Level | Why not one level down | Why not one level up |
|---|---|---|---|
| "the discount is 12% for orders over 500 EUR when the customer is gold tier" | unit | nothing below unit | integration would run a database to test arithmetic |
| "an order id is unique even when two requests arrive simultaneously" | integration | a unit test cannot exercise a unique constraint or a race | E2E would take 40x the time for the same signal |
| "a cancelled subscription stops billing at the period end" | integration | crosses time handling + persistence | E2E only if it is also a revenue-critical journey |
| "the checkout API returns 402 with a `payment_declined` code the web app renders" | contract | unit tests both sides in isolation and both can be wrong together | E2E is slower and does not prove independent deployability |
| "a returning customer pays by card and receives confirmation" | E2E | no lower level crosses browser + API + payment provider + mail | nothing above |
| "search results appear within 300 ms at 200 rps" | performance | a functional test cannot express a percentile | — |
| "the invoice PDF matches the approved layout" | approval/golden file | assertions on PDF internals are unmaintainable | E2E cannot judge a layout |
| "the balance never goes negative for any sequence of operations" | property | example-based tests only sample the space | — |

## Silent-failure examples (detectability_gap = 3)

These deserve tests out of proportion to their apparent complexity, because production will not
tell you they are wrong:

- Money rounding, currency conversion, tax rules, proration.
- Permission checks that fail **open** (the user sees more, not less).
- Any aggregate shown to a user: totals, counts, dashboard numbers, exported reports.
- Deduplication and idempotency keys — a duplicate charge looks like a successful charge.
- Timezone and DST handling on scheduled work; a job that runs twice on one October night.
- Cache invalidation — stale data is a correct-looking wrong answer.
- Soft deletes and data-retention deletion — under-deletion is a regulatory exposure, and
  over-deletion is unrecoverable.
- Feature flags where the "off" branch is never exercised in staging.

## Redundancy patterns to delete

When you find these, they become deletion tasks with an estimated annual saving:

1. **The mirrored E2E.** An E2E journey whose assertions are all reachable from an integration
   test already in the suite. Keep the integration test.
2. **The mock echo.** A unit test whose only assertion is that a mock was called with the
   arguments the code just passed. It cannot fail except during refactoring.
3. **The parameterised restatement.** Twenty parameterised cases for a mapping with no
   branching. One case proves the wiring; the other nineteen are maintenance.
4. **The framework test.** Asserting that the ORM saves, the router routes, the validator
   validates.
5. **The snapshot nobody reads.** A snapshot updated with `-u` whenever it fails is a
   changelog, not a test. Either assert specific properties or delete it.
6. **Duplicated setup across levels.** The same fixture built at unit, integration and E2E
   level means three places break when the model changes.

## Compensating controls, ranked by strength

When something goes in `outOfScope`, name one of these:

| Control | Strength | Notes |
|---|---|---|
| Type system / schema making the state unrepresentable | strongest | costs nothing at runtime, cannot drift |
| Database constraint (unique, FK, check, not-null) | very strong | enforced regardless of code path |
| Runtime assertion that fails loudly and pages | strong | needs an alert and a runbook to count |
| Monitoring alert on the symptom | medium | only counts if it links a runbook and has an owner |
| Feature flag with a measured rollback time | medium | the control is the speed of undo, state the seconds |
| Canary / progressive rollout | medium | limits blast radius, does not prevent |
| Manual pre-release check | weak | needs a named owner and a checklist item, decays fast |
| Code review | weakest | not a control; do not list it |
| "We'll be careful" | none | reject |

## Property-testing candidates

Reach for property tests when an invariant holds across a range, not for a single example:

- Round trips: `parse(format(x)) == x`, `decode(encode(x)) == x`, serialise/deserialise.
- Algebraic laws: commutativity of a merge, idempotency of a sync, associativity of a fold.
- Invariants: a total always equals the sum of its parts; a state machine never reaches a
  state not in its transition table; a sorted output is a permutation of the input.
- Oracle comparison: the fast implementation agrees with the obvious slow one.

Always keep the shrunk counterexample as a permanent example-based regression test. The
property found it; the example keeps it found.

## Legacy code with no tests

Do not start with unit tests — there are no seams, and creating them without tests is the risky
part. Order:

1. **Characterisation tests at the widest seam that runs in under 60 seconds.** Capture current
   behaviour, including behaviour that is wrong. The goal is a change detector, temporarily.
2. **Pin the behaviour that money or compliance depends on**, even if it is bizarre. Ask before
   "fixing" anything discovered here; downstream systems may depend on the bug.
3. **Cut one seam, add unit tests behind it, delete the characterisation test that covered it.**
   Characterisation tests are scaffolding with a demolition date; record it.
4. Track the ratio of characterisation to real tests over time. If it is not falling, the
   refactoring is not happening and the plan needs to say so.

## Runtime allocation, worked

For a service with real domain logic, a defensible steady state at a 600 s PR budget:

| Level | Tests | Share of runtime | Wall clock |
|---|---|---|---|
| unit | ~800 | 15% | 90 s |
| integration | ~150 | 45% | 270 s |
| contract | ~30 | 5% | 30 s |
| E2E (PR subset) | 6 journeys | 30% | 180 s |
| lint/type/build | — | 5% | 30 s |

Note the inversion between test *count* and *runtime share* at the unit and integration levels.
That is normal and healthy: count is what you write, runtime is what you pay. Plan against the
column you pay for.
