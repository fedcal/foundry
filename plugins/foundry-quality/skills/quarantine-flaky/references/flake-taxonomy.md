# Flake taxonomy — signatures, diagnostics and fixes

Loaded on demand by the `quarantine-flaky` skill.

Each entry gives the **signature** (how you recognise it from run data alone), the
**diagnostic** (the experiment that confirms it), and the **fix**. Classify before fixing:
the fixes are disjoint, and applying the wrong one wastes a quarantine window.

---

## 1. Shared state

**Signature.** Passes at `--workers=1`, fails at `--workers>=4`. Or passes alone, fails in the
full suite. Failure rate rises with parallelism. Often several tests in one area fail together.

**Diagnostic.**
```bash
<test command> --workers=1   # repeat 10x - expect 0 failures
<test command> --workers=8   # repeat 10x - expect the flake to appear
```
If the failure rate tracks worker count, it is shared state. Stop looking at timing.

**Common shared resources, in order of frequency.**
- A seeded record reused by multiple tests (the "test user", "the demo product").
- A unique constraint hit by two workers generating the same natural key.
- A fixed port, a temp file with a fixed name, a fixed directory.
- A cache or an in-memory singleton surviving between tests in the same process.
- A message queue where one test consumes another's message.
- A feature flag toggled globally by one test.
- The system clock, if any test changes it globally.

**Fix.** Namespace everything a test creates with `${RUN_ID}-${WORKER_ID}-${seq}`, passed in
through the environment so the value appears in the artefacts and the run is reproducible. Bind
to port 0 and read back the assigned port. Use a per-test schema, database or tenant where the
engine allows it. Never share a fixture that any test mutates.

---

## 2. Timing and race conditions

**Signature.** Fails more on loaded or slower runners; passes locally always; the error is a
timeout on an assertion or a "element not found/not stable".

**Diagnostic.** Run with an artificial CPU constraint or under high parallelism. If the failure
rate rises with machine load but not with shared-state exposure, it is timing.

**Fix.**
- Assert the **end state**, letting the runner retry the assertion: "the confirmation heading is
  visible", "the row count is 3".
- Wait for the **specific** network response the action triggers, then assert the DOM. Never
  "wait for network idle": polling, websockets and analytics mean an app may never be idle.
- Ask the app for a readiness signal (`data-state="ready"`). Adding one attribute is cheaper and
  more reliable than any heuristic wait.
- Disable animations and transitions globally in the test profile.
- Never a fixed sleep. It is too short on a slow runner and wasted on a fast one, and the
  correct value does not exist.

---

## 3. Time, timezone and calendar

**Signature.** Fails at a specific hour (often around midnight UTC or local), on the 1st or last
day of a month, on a DST switch date, or on 29 February.

**Diagnostic.**
```bash
TZ=Pacific/Chatham <test command>       # a 45-minute offset finds a surprising number of bugs
TZ=America/Santiago <test command>      # southern-hemisphere DST
faketime '2027-02-28 23:59:50' <test command>   # only if the tool is already available
```

**Fix.** Inject the clock at the boundary (a header, an env var, a DI-provided clock). Never
assert a value derived from "now"; assert ordering or a bounded range instead. Move the
month-end, DST and leap-day cases to unit tests where they can be exhaustive and fast — an E2E
test is the wrong place to explore a calendar.

---

## 4. Ordering assumptions

**Signature.** Fails on a different runner, a different database version, or after an unrelated
change. Error is a mismatch in list order or in "first element".

**Diagnostic.** Run the query directly twice on a warm and a cold cache; check whether the SQL
has an `ORDER BY`. A `SELECT` without one has no ordering guarantee even if it appears stable.

**Fix.** Either the system promises the order (add `ORDER BY`, make it part of the contract and
test it deliberately) or the test stops assuming it (compare sets, or sort both sides before
comparing). Do not sort in the test to hide a missing guarantee a user depends on — decide which
of the two is true and fix the right layer.

---

## 5. External dependency

**Signature.** Correlates with nothing internal. Failure messages mention DNS, TLS, connection
reset, 502, or a vendor-specific error. Often clusters in time across unrelated tests.

**Diagnostic.** Check whether unrelated specs failed in the same window. Check the vendor's
status history for the timestamp.

**Fix.** Stub at the network boundary for the merge-blocking pipeline; keep a **scheduled canary**
against the real endpoint outside it, so a genuine vendor API change is still caught somewhere.
Never make a vendor's availability a condition of merging. Record in the suite README which
vendors are stubbed and why.

---

## 6. Resource exhaustion

**Signature.** The Nth test fails regardless of which test is Nth. Failure rate rises with suite
size, not with parallelism. Errors mention EMFILE, EADDRINUSE, connection pool timeout, or OOM.

**Diagnostic.**
```bash
ulimit -n                       # file descriptor ceiling
# watch RSS across the run; a monotonic rise across tests is a leak in the harness or the app
```

**Fix.** Close what you open in a `finally`. Reuse one browser context per worker instead of one
per test where the runner supports it. Size the connection pool against the worker count. Cap
workers at measured capacity — oversubscribing CPU also manufactures category 2 flakes, so this
one fix often removes two symptoms.

---

## 7. The product is genuinely racy

**Signature.** The test is correct, the assertion is reasonable, and the failure reproduces
manually if you try hard enough. Often an endpoint that is not idempotent, a missing loading
state, a double-submit, or a read-after-write against a replica.

**Diagnostic.** Reproduce outside the test: fire the same two requests concurrently with `curl`
in the background and compare outcomes.

**Fix.** This is **not a test fix**. File a `finding.v1` against the product owner with the trace
and the reproduction, keep the spec quarantined referencing the finding id, and move the
deadline once — to the finding's due date. Teams that reflexively "stabilise the test" here
delete their own early warning of a production race.

---

## Anti-fixes — reject these on sight

| Anti-fix | Why it is worse than the flake |
|---|---|
| `sleep(2000)` | adds runtime to every run and still fails on a slow runner |
| Raising the global timeout | hides a genuine slowdown; the next flake needs a bigger number |
| `retries: 3` | converts an unknown failure rate into an unknown, invisible failure rate |
| `test.skip` with no record | a deleted test that still looks like coverage |
| Re-running CI until green | trains the team that red means nothing |
| Removing the assertion | the test now passes for no reason at all |
| Making the test sort/normalise a genuine ordering guarantee away | hides a real contract break |

## Suite-level health metrics to track

| Metric | Budget | What a breach means |
|---|---|---|
| Flake rate (runs with a retried-then-passed test / total runs) | ≤ 1% | the suite is stopping being believed |
| Quarantined tests | ≤ 3 | the suite is being deleted gradually |
| Oldest quarantine age | ≤ 14 days | the loan is not being repaid |
| Re-run-to-green rate (manual CI re-runs / total runs) | ≤ 2% | the strongest cultural signal; measure it |
| Mean time to close a quarantine entry | ≤ 7 days | trending up means the cause is structural |

Track the re-run-to-green rate specifically. Teams under-report flakiness in surveys and the
re-run counter never lies.
