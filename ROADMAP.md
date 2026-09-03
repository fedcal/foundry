# Roadmap to 1.0.0

Foundry is at `0.1.0`. This document says what has to be **true** before the version number
becomes `1.0.0`, not when it will happen.

## What 1.0.0 means here

Under [SemVer 2.0.0](https://semver.org/), `1.0.0` is a promise of a stable public API. Foundry's
public API is larger than a function signature:

- the **eleven contract schemas** — once `1.0.0` ships, a breaking change to any of them requires
  `v2` of that schema, never an edit (see `AUTHORING.md`);
- the **agent and skill names** other projects invoke;
- the **MCP tool names and their arguments**;
- the **`.foundry/` on-disk layout** and `config.json` keys;
- the **hook event registrations** and what each gate blocks.

Publishing `1.0.0` freezes all of it. The cost of freezing too early is paid by every user who
later has to migrate; the cost of waiting is only impatience. So the criteria below are about
**evidence**, not effort.

## The phases

Each phase lists exit criteria that are machine-checkable or plainly observable. A phase is done
when every box is ticked — not when the work "feels finished".

### 0.2.0 — Earn confidence in the code

The kernel is the part every user runs. Today its weakest file is the one they run *first*.

- [x] `scripts/install.mjs` reaches **≥ 85%** line and **≥ 75%** branch coverage — it is at
      60.92% / 51.02% and is the first code a new user executes.
      **Met: 100.00% / 75.34%.**
- [x] Kernel overall reaches **≥ 90%** line and **≥ 80%** branch coverage — currently
      87.67% / 70.19%. **Met: 96.75% / 83.04%.**
- [x] No hook file sits below **50%** branch coverage. Today `validate-contract.mjs` (28.57%),
      `session-start.mjs` (25.00%), `subagent-firewall.mjs` (25.00%) and `stop-verify.mjs`
      (16.67%) do — a gate whose failure branch is untested is a gate nobody has proven blocks.
      **Met: the lowest is 50.00%** (`precompact-persist.mjs`, `session-start.mjs`), and four
      hooks are at 100%.
- [x] `session-start.mjs` has non-zero function coverage (currently **0.00%**).
      **Met: 100.00%.**
- [x] Coverage is enforced in CI, so it cannot silently regress. **Met:** the test job runs
      `--test-coverage-lines=96 --test-coverage-branches=82 --test-coverage-functions=94`,
      verified to exit non-zero when a threshold is not reached.

Two things found along the way that the criteria above did not ask for, and should have:

- `plugins/foundry-growth/hooks/guard-claims.mjs` shipped in 0.1.0 with **no test at all**,
  because the test command named one plugin and it lives in another. The glob is now
  `plugins/*/test/*.test.mjs` (AUTHORING.md §1.7) and the hook has 163 tests. A coverage
  percentage says nothing about a file the measurement never loaded.
- A coverage figure was being read off the author's own machine: the `foundry tokens` tests
  inherited `process.env`, so the subprocess read the real `~/.claude/settings.json` and one
  arm counted as covered because that laptop had plugins enabled. It now runs under an
  isolated `HOME`. A number that changes with whose machine produced it is not a measurement.

### 0.3.0 — Survive contact with a real project

Nothing here can be faked by writing more code. It requires installing Foundry somewhere that
was not built to accommodate it.

- [ ] Installed and used on **at least three** projects that are not this repository, across at
      least two different stacks.
- [ ] Every contract that a real run produced has been re-read against its schema: fields that
      went unused, and fields that were missing and had to be worked around, are both recorded.
- [ ] At least one **breaking** schema change identified and made — or a written statement, per
      contract, that real usage found nothing to change. A contract nobody has stressed is not
      stable, it is merely unused.
- [ ] The install path verified on a clean machine by someone who did not write it.

### 0.4.0 — Close the loop with users

- [ ] Issue templates exercised by real reports; the triage protocol in `foundry-oss` run at
      least once on real traffic rather than on examples.
- [ ] Documented answers for the questions people actually ask, replacing guesses in the FAQ.
- [ ] A deprecation performed end to end on something real, proving the `api-deprecation` path
      works outside its own documentation.

### 1.0.0 — Declare stability

- [ ] Every 0.2–0.4 criterion met.
- [ ] No known breaking change pending against any of the eleven schemas.
- [ ] `CHANGELOG.md` documents the compatibility promise explicitly: what may change in a minor
      release, and what may not.
- [ ] The `publish-release` runbook executed at least twice, so its steps are proven repeatable
      rather than proven once.

## What is deliberately not a criterion

- **A number of agents, skills or plugins.** Foundry ships 78 agents and 80 skills at `0.1.0`.
  More of them is not progress toward stability; it is more surface to freeze.
- **A date.** Every criterion above is either measured or observed. None of them is scheduled.
- **Adoption metrics.** Stars and installs measure attention, not whether the contracts hold.
