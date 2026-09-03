---
title: foundry-quality
description: Test strategy, contract and end-to-end testing, performance engineering, observability and SRE practice.
sidebar:
  order: 4
---

`foundry-quality` decides what to test and what to deliberately leave untested, keeps suites green
for real reasons, sets performance budgets that fail the build, and turns user journeys into SLOs
with an error-budget policy that has consequences.

It does **not** reimplement test-driven development. Foundry declares a soft dependency on
[superpowers](https://github.com/obra/superpowers) and delegates TDD discipline, systematic
debugging and verification-before-completion to it. When `superpowers` is absent, the reduced
fallback in `references/tdd-fallback.md` applies.

## Install

```bash
/plugin install foundry-quality@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- Nobody can say what the test suite is *for*, or coverage is being chased as a number.
- CI is red for reasons unrelated to the change, and people re-run builds to get green.
- A latency or bundle-size regression shipped because nothing measured it.
- Reliability is discussed in adjectives rather than in a target, a window and an error budget.

## When not to use it

- It does not write feature code. It writes tests, budgets, instrumentation and policy.
- If `superpowers` is installed, use it for the red-green-refactor loop itself; this plugin
  decides *what* to test, not *how* to drive an individual change.
- SLOs without production telemetry are guesses. `define-slo` needs real measurements or it will
  say so.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `test-strategist` | Decides what to test, at which level, and what to leave untested — risk-driven strategy for a specific codebase, choosing pyramid or trophy shape from the code's actual structure. | `opus` | `high` |
| `performance-engineer` | Backend and system performance driven by measurement: budgets and SLIs set before touching code, profiling that attributes cost to a named frame or query. | `opus` | `high` |
| `sre-planner` | Turns user journeys into SLIs, SLOs with justified targets and an error-budget policy with teeth; designs multi-window multi-burn-rate alerts instead of raw thresholds. | `opus` | `high` |
| `contract-tester` | Consumer-driven contract testing between services and between frontend and backend, with provider verification wired into the provider's CI. | `sonnet` | `medium` |
| `e2e-engineer` | Builds end-to-end suites that stay green for real reasons: the small set of journeys worth the cost, deterministic isolated test data, an explicit stubbing policy. | `sonnet` | `medium` |
| `observability-engineer` | Instruments with OpenTelemetry so incidents are diagnosable: structured logs carrying trace and correlation ids, RED metrics for request-driven services, USE metrics for resources. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `test-plan` | Starting a test suite, or a release needs a defensible test plan tied line by line to `requirement.v1` acceptance criteria. |
| `perf-budget` | Before a launch, after a latency regression, or when performance needs a gate in CI that actually fails the build. |
| `define-slo` | Reliability is discussed without a target — turns one journey into SLIs, an SLO, an error-budget policy and burn-rate alerts. |
| `quarantine-flaky` | CI is red for no reason, people re-run builds, or retries are hiding instability. |
| `postmortem` | After an incident — a timestamped timeline, multiple contributing factors, and actions each with a named person and a due date. |

`quarantine-flaky` ships `scripts/flake-report.mjs` for the detection pass, so flakiness is
quantified from run history rather than asserted.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `test-strategist` | `requirement.v1` | `plan.v1` |
| `performance-engineer` | `requirement.v1` | `plan.v1` and `finding.v1` |
| `sre-planner` | `requirement.v1` | `plan.v1` |
| `contract-tester` | `requirement.v1` | `review.v1` |
| `e2e-engineer` | `plan.v1` | `review.v1` |
| `observability-engineer` | `requirement.v1` | `review.v1` |

`postmortem` additionally writes a Foundry runbook, so the same incident has a followable
procedure next time.

## What else it ships

`references/tdd-fallback.md` — the reduced checklist used **only** when `superpowers` is not
installed. It states explicitly which superpowers skill each item would otherwise delegate to, so
the degradation is visible rather than silent.

## Limits

- Flake detection needs run history. On a repository with no CI history there is nothing to
  quantify.
- Performance budgets are only as good as the baseline. `perf-budget --baseline` must be run on
  representative hardware or the gate will fire on noise.
- Contract testing requires both sides to participate. A provider that will not run verification
  in its own CI turns the consumer's expectations into documentation, not a gate.
