---
name: test-plan
description: Build a risk-based test plan as a plan.v1 artifact, tied line by line to requirement.v1 acceptance criteria. Use when starting a test suite, when a release needs a defensible test scope, when coverage is being argued about without data, or when the suite is large but bugs still escape. Produces the not-tested list with a compensating control for every entry. Do not use for writing individual tests or for TDD discipline.
allowed-tools: Read Grep Glob Bash Write
argument-hint: "[requirements-path] [--area src/billing]"
user-invocable: true
model: opus
effort: high
metadata:
  foundry.vertical: quality
  foundry.io: "requirement.v1 -> plan.v1"
license: Apache-2.0
---

# Risk-based test plan

Produce a `plan.v1` that says what will be tested, at which level, in what order, and — the
part everyone skips — **what will not be tested and what covers that risk instead**.

A plan whose `outOfScope` is empty has not been thought about. Reject it, including your own.

## When not to use this

- You are about to write one test for one function → just write it (with
  `superpowers:test-driven-development` if available).
- The suite is above a 1% flake rate → run `quarantine-flaky` first. Planning new tests onto
  an untrusted suite adds cost and no confidence.
- You need load or soak coverage → that is `performance-engineer`, not this skill.
- The **shape** of the suite is what is in dispute — pyramid vs trophy, where the
  integration/unit boundary sits, the test-doubles policy, where mutation testing pays, which
  tests to delete → delegate to the `foundry-quality:test-strategist` agent, which argues those
  from a cost model. This skill is the one-pass user-facing route to the same `plan.v1`.
  **Run one or the other against a wave, never both**: they write to
  `.foundry/blackboard/<wave>/test-plan.json` and `.../test-strategist.json` respectively, and
  a wave carrying two plans has no owner and no reconciliation rule.

## Inputs

| Input | Required | Where it comes from |
|---|---|---|
| `requirement.v1` objects with `acceptanceCriteria` | yes | `.foundry/blackboard/*/`, or written now |
| Escaped-defect history | strongly preferred | `git log`, issue tracker |
| Measured current suite runtime | yes | you must run it, not estimate |
| `risk.v1` with `impactEur` | optional | risk register |

If there are no requirements, stop and produce them first — a test plan derived from code
tests what the code does, not what it should do. Use `superpowers:brainstorming` if present.

## Procedure

### 1. Measure the ground truth (do not skip, do not estimate)

```bash
AREA=${1:-.}
# Suite size
git ls-files -- "$AREA" | grep -cE '(\.|_|/)(test|spec)\.[a-z]+$|Test\.java$|_test\.go$|test_.*\.py$'
# Real runtime - run it once, record the seconds
/usr/bin/time -f '%e s' <your test command> 2>&1 | tail -1
# Churn: where the code actually moves
git log --since='12 months ago' --name-only --pretty=format: -- "$AREA" \
  | grep -vE '^$' | sort | uniq -c | sort -rn | head -20
# Escaped defects: files touched by fix commits = where tests convert into avoided incidents
git log --since='12 months ago' --name-only --pretty=format: -i --grep='fix\|regression\|hotfix' -- "$AREA" \
  | grep -vE '^$' | sort | uniq -c | sort -rn | head -20
```

Record all four numbers in the plan. Everything after this is ranked against them.

### 2. Score each requirement

For every requirement, compute a risk score you can defend:

```
risk = likelihood(1-5) x impact(1-5) x detectability_gap(1-3)
```

- `likelihood` — take it from the churn and fix-commit counts, not from feeling. A file in the
  top 5 of the fix-commit list is a 5.
- `impact` — money, safety, legal exposure, data integrity, or user trust. Use `risk.v1`
  `impactEur` where it exists.
- `detectability_gap` — 1 if a failure is loud and immediate in production, 3 if it is silent
  (wrong number in a report, a slowly corrupting record, a permission quietly widened).

Silent failures deserve tests far more than loud ones. A crash gets fixed in an hour; a wrong
invoice total gets discovered by a customer in a quarter.

### 3. Assign each acceptance criterion to exactly one primary level

Use the decision rule, in order — the first match wins:

1. Does the criterion depend on a real engine's semantics (SQL, timezone, serialisation,
   concurrency)? → **integration**
2. Does it cross a boundary owned by another team or deployable? → **contract**
3. Does it describe a full user journey across ≥ 3 components and is it revenue/safety
   critical? → **E2E** (subject to the ≤ 15 journey cap)
4. Is it a rule, calculation, state machine or invariant? → **unit** (and consider a
   property test if the invariant holds over a range of inputs)
5. Is it a non-functional budget? → hand to `performance-engineer`
6. None of the above? → it is probably not a testable criterion; rewrite it or move it to
   `outOfScope`.

"Exactly one primary level" is enforced: the same criterion covered at two levels is
redundancy, and the more expensive one gets deleted. Record the deletion as a task.

### 4. Write the not-tested list first

Before listing what you will test, list what you will not. Format, verbatim:

```
<thing> — not tested at <level> because <cost reason>; compensating control: <control>
```

Legitimate compensating controls: a type system that makes the state unrepresentable, a
database constraint, a runtime assertion that pages, a monitoring alert with a runbook, a
manual pre-release check with an owner, a feature flag with a fast rollback, or an accepted
risk signed by a named person.

"We'll be careful" is not a compensating control.

Details and worked examples: `references/level-allocation.md`.

### 5. Set the budgets as gates

| Gate key | Value | Rationale |
|---|---|---|
| `maxDurationSeconds` | 120 (unit), 600 (PR pipeline), 3600 (nightly) | beyond this the loop is abandoned |
| `maxFlakeRatePercent` | 1 | above it, the suite is not believed |
| `minMutationScore` | 70, on named modules only | see the four criteria in `test-strategist` |
| `requirementsCovered` | every `must` id | traceability |
| `expectFailBefore` | a command that must fail before the wave | proves the test can fail |

`expectFailBefore` is the cheapest defence against tests that pass vacuously. Every wave
gets one.

### 6. Order the waves

1. **Stabilise** — if flake rate is unknown or > 1%, this wave exists and everything waits.
2. **Cover the top-10 risk score** at the assigned levels.
3. **Delete/consolidate** — redundant, mock-asserting, and E2E tests that duplicate lower
   levels. Estimate hours saved per year.
4. **Harden** — mutation testing on the qualifying modules, property tests on invariants.
5. **Gate** — wire the budgets into CI so the plan cannot silently decay.

Deletion goes early on purpose: it makes every later wave cheaper and it is the wave teams
never get to if it is scheduled last.

### 7. Emit `plan.v1`

Write to `.foundry/blackboard/<wave>/test-plan.json`. Validate before returning:

```bash
node -e '
const p=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));
const errs=[];
if(p.schema!=="plan.v1")errs.push("schema");
if(!p.waves?.length)errs.push("waves empty");
if(!p.outOfScope?.length)errs.push("outOfScope empty - the not-tested list is mandatory");
for(const w of p.waves||[]){
  if(!w.gate||!Object.keys(w.gate).length)errs.push(`wave ${w.id}: gate missing`);
  if(w.gate && !w.gate.command)errs.push(`wave ${w.id}: gate has no runnable command`);
  for(const t of w.tasks||[]) if(!t.agent)errs.push(`task ${t.id}: no agent`);
}
if(errs.length){console.error(errs.join("\n"));process.exit(1)}
console.log("plan.v1 OK:",p.waves.length,"waves,",p.outOfScope.length,"out-of-scope entries");
' .foundry/blackboard/<wave>/test-plan.json
```

## Traceability

Every `must` requirement id appears in exactly one wave's `gate.requirementsCovered`. Check it
mechanically rather than by reading:

```bash
node -e '
const fs=require("node:fs");
const plan=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const reqs=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const covered=new Set(plan.waves.flatMap(w=>w.gate.requirementsCovered||[]));
const missing=reqs.filter(r=>r.priority==="must"&&!covered.has(r.id)).map(r=>r.id);
console.log(missing.length?"UNCOVERED must: "+missing.join(", "):"all must requirements covered");
process.exit(missing.length?1:0);
' plan.json requirements.json
```

## Exit criteria

1. Four measured numbers recorded: test count, real runtime in seconds, top churn files, top
   fix-commit files.
2. Every `must` requirement covered at exactly one primary level; the traceability check
   exits 0.
3. `outOfScope` non-empty; every entry has a cost reason and a compensating control from the
   allowed list.
4. Every wave gate has a runnable `command` plus at least one numeric threshold.
5. At least one deletion/consolidation task, or a written statement that the suite was
   inspected and contains none.
6. Stabilisation is wave 1 whenever the flake rate is unknown or above 1%.
7. The validator above exits 0.

## Degradation

- **`superpowers` absent** → use `references/tdd-fallback.md` at the plugin root for the
  reduced test-first checklist; state in the plan that the fallback was used.
- **No git history** → churn and fix-commit ranking unavailable; fall back to requirement
  priority and `risk.v1`, and mark the level allocation `confidence: low` in `goal`.
- **Cannot run the suite** → record runtime as a target with `"measured": false` in the gate.
  Never write a runtime you did not observe.
- **No requirements and no stakeholder access** → produce a provisional plan from code, label
  it provisional in `goal`, and make "write acceptance criteria" wave 1.

## Deliberately not covered

Test authoring, TDD discipline, E2E stabilisation mechanics, contract mechanics, performance
budgets, security test cases, and choosing a test runner. This skill decides scope and level;
other assets execute it.
