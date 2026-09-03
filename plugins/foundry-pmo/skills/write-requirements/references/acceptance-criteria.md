# Acceptance criteria that can fail

A criterion is useful only if someone can build the Given, perform the When, and **disagree**
with you about the Then. If disagreement is impossible, the criterion says nothing.

## Structure

```
Given <the state of the world before, concretely>
When  <exactly one action or event>
Then  <the observable outcome, from outside the system>
```

| Clause | Common failure | Fix |
|---|---|---|
| Given | "given a user" | "given a registered user with a verified email, no active subscription, and one saved card" |
| Given | describes an internal DB state | describe it as a user-observable situation, or as a documented API precondition |
| When | two actions joined by "and" | split into two criteria, or move the first into Given |
| When | describes an internal call | describe what the actor does or what event arrives at the boundary |
| Then | "the system handles it" | say what is displayed, returned, recorded or emitted |
| Then | asserts an internal table row | assert what a query at the boundary returns, or what an audit record contains |

## Minimum coverage per requirement

- **1 happy path** — the intended flow.
- **≥ 1 rejection path** — what happens when input or state is invalid.
- **≥ 1 boundary** — the edge of the accepted range, on both sides where relevant.

A requirement with only a happy path is half specified, and the missing half is where every
production incident lives.

## Boundaries worth writing

| Kind | Values to specify |
|---|---|
| Numeric range | min, min−1, max, max+1, zero, negative |
| Collection | empty, exactly one, at the page size, one over the page size, at the hard limit |
| Text | empty string, whitespace only, at max length, over max length, non-ASCII, right-to-left, emoji |
| Time | boundary of a day/month, DST transitions, leap day, timezone of the actor vs. the server, expiry at exactly the boundary instant |
| Money | zero, smallest unit, rounding half-cases, negative (refunds), the currency's actual decimal places |
| Concurrency | two simultaneous identical requests; retry of an already-applied action (idempotency) |
| Auth | authenticated but unauthorised; token expired mid-operation; permission revoked between check and use |

You are not required to write all of these — you are required to have considered them and to
have written the ones that can occur. Say which you considered and dismissed, and why.

## Worked example

Requirement: *Refunds can be issued from the admin UI.*

```
1. Given an order paid 3 days ago for 120.00 EUR with no prior refund
   When an admin issues a full refund
   Then the refund is submitted to the provider, the order shows "Refunded 120.00 EUR",
        and the customer receives a refund confirmation email within 60 s

2. Given an order already fully refunded
   When an admin issues another refund
   Then no request reaches the provider, the UI shows "This order is already fully refunded",
        and the attempt is recorded with reason ALREADY_REFUNDED

3. Given an order paid 120.00 EUR with a prior partial refund of 100.00 EUR
   When an admin issues a refund of 20.01 EUR
   Then the refund is rejected, the UI shows "Maximum refundable amount is 20.00 EUR",
        and no request reaches the provider

4. Given an order paid 120.00 EUR
   When an admin issues a refund of 0.00 EUR
   Then the refund is rejected with "Refund amount must be greater than zero"

5. Given the provider returns a 5xx to a refund request
   When an admin issues a refund
   Then the UI shows "Refund could not be completed, please retry", the order state is unchanged,
        and the failure is recorded with the provider reference for reconciliation

6. Given a refund request already submitted with idempotency key K
   When the same request is retried with key K
   Then exactly one refund exists at the provider and the UI reports the original result
```

Note what these criteria specify beyond the happy path: the message the user sees, the recorded
system state, the idempotency contract and the reconciliation reference. Each of those would
otherwise be invented during implementation, inconsistently.

## Criteria for non-functional requirements

An NFR's criterion states the measurement, not a feeling:

```
Given the catalogue contains 1 000 000 products and the system is under 200 req/s sustained load
When a user searches by exact SKU
Then the p95 server response measured at the load balancer over a rolling 1 h window is ≤ 300 ms
     and the error rate is ≤ 0.1%
```

This is directly executable as a load-test assertion, which is the test: if a criterion cannot
become an assertion, it is not yet a criterion.

## Criteria for error handling and observability

Every rejection path criterion should say three things:

1. What the **actor** sees — the message class, not necessarily the exact copy.
2. What the **system records** — the reason code and the correlation identifier.
3. What the **system state** is afterwards — unchanged, partially applied (and how to tell), or
   rolled back.

Specifying (2) at requirements time is what makes an incident diagnosable at 3am. Discovering it
is missing during the incident is the usual alternative.

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| "Works as expected" | expected by whom, doing what? |
| Criteria that restate the title | adds no information; the requirement is still unspecified |
| Criteria referencing a UI element that does not exist yet | couples the criterion to a design that will change |
| One criterion covering the whole feature | cannot be partially satisfied, so progress is invisible until the end |
| Criteria written by the implementer after building | they describe what was built, not what was needed |
| Criteria with no rejection path | the system is specified only for the case where nothing goes wrong |
| Criteria asserting internal state | breaks on every refactor and tests the implementation, not the behaviour |
