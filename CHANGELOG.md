# Changelog

All notable changes to Foundry are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html), applied per plugin.

## [Unreleased]

## [0.2.0] — 2026-09-03

Earning confidence in the code. Every exit criterion in `ROADMAP.md` for this phase is met and
each is stated with the figure that met it, not with a claim.

Plugin versions move independently, as this file has said since 0.1.0: `foundry-core` takes the
minor bump because it gained a documented environment variable; the other eleven take a patch
because their manifests changed and nothing else did.

### Added

- **Coverage is now enforced in CI.** The test job runs with `--test-coverage-lines=96
  --test-coverage-branches=82 --test-coverage-functions=94`, which fail the run rather than warn.
  Without this the other criteria decay back to where they started and nobody notices.
- **`FOUNDRY_PROFILES_DIR`** (`foundry-core`) pins the directory `foundry profile` reads,
  mirroring the existing `FOUNDRY_PROJECT_DIR`. It exists because four error paths — including
  the three written for a user hand-writing a profile, which the CLI itself invites — could not
  be reached by any test: the directory search always resolved to the executing clone's own
  `profiles/`, so it could never be absent and every file it could name was already valid.
- **`AUTHORING.md` §1.7**, which requires a test for every shipped hook, fixes the single command
  that runs them, and states what a hook test must cover: the wire JSON from a real subprocess,
  an empty stderr, the opt-in arms where a gate silently dies, and one test per numbered item of
  any behaviour contract the hook declares. The document previously said nothing about tests.
- **The first tests for `guard-claims`** (`foundry-growth`), 163 of them. The hook is 470 lines,
  runs on every Write and Edit in an opted-in project, and shipped in 0.1.0 with no test —
  because the test command named one plugin and the hook lives in another. All nine items of its
  behaviour contract are true of the code and each is now pinned. Mutation tested: 19 of 20
  mutants killed.

### Changed

- **The test command is `node --test 'plugins/*/test/*.test.mjs'`** everywhere it appears. It
  named `foundry-core` alone, in eleven places, so a whole plugin's code was invisible to every
  local check, to CI and to the release runbook.
- **`foundry profile <unknown>` now lists the profiles that exist**, and a missing profiles
  directory is reported as such by both spellings of the command. It was the only error path in
  the CLI that named no way to recover.
- Plugin manifests point at `claude-code-plugin-manifest.json`. Eleven of twelve used a URL that
  301s to a 404, so schema validation in editors was silently doing nothing.
- `astro` 7.2.10, `@astrojs/starlight` 0.41.10, and `sharp` raised past GHSA-f88m-g3jw-g9cj
  (high). The five pinned GitHub Actions were bumped with every SHA re-resolved through the tags
  API first — a pin is only worth the verification behind it.

### Fixed

- **A coverage figure was being read off the author's machine.** The `foundry tokens` tests
  inherited `process.env`, so the subprocess read the real `~/.claude/settings.json` and one arm
  counted as covered because that laptop had plugins enabled. It now runs under an isolated
  `HOME`. A number that changes with whose machine produced it is not a measurement.
- Two guards that could not fire were removed — one in `subagent-firewall`, one in the CLI's
  plugin-surface accounting. Dead code in the shape of a live check reads as a handled case and
  is not one.
- `scripts/validate-assets.mjs` rejects a raw NUL byte in an asset source. One reached the tree
  as a fixture and made GNU `grep` skip the file in silence; a few kilobytes earlier and `git
  grep -nIE` would have skipped it too, which is the whole of the credential scan in CI.

### Coverage

| | 0.1.0 | 0.2.0 |
|---|---|---|
| tests | 200 | 494 |
| lines | 87.67% | 96.75% |
| branches | 70.19% | 83.04% |
| functions | 80.00% | 95.10% |

`scripts/install.mjs`, the first code a new user runs, went from 60.92% / 51.02% to
100.00% / 75.34%. No hook sits below 50% branch coverage; four are at 100%.

## [0.1.0] — 2026-09-03

First public release.

### Added

- **`foundry-core`** — the kernel:
  - four-tier memory (scratch, facts, runbooks, decisions) with a token-capped generated index;
  - eleven versioned I/O contracts as JSON Schema 2020-12, validated by a zero-dependency
    validator;
  - the `foundry` MCP server exposing `memory_search`, `memory_write`, `memory_index`,
    `runbook_list`, `runbook_get`, `contract_validate`, `blackboard_write`, `blackboard_read`,
    `token_report`;
  - nine hook entries across eight events — `SessionStart`, `UserPromptSubmit`, `PreToolUse`
    (Bash and Write/Edit/NotebookEdit), `PostToolUse`, `SubagentStop`, `Stop`, `PreCompact` and
    `SessionEnd` — each with a named rule and an expiring override path;
  - three dynamic workflows (audit sweep with adversarial verification, feature delivery,
    compliance sweep) and two orchestration playbooks;
  - three output styles and the `foundry` CLI (`init`, `doctor`, `memory`, `tokens`, `runbooks`,
    `validate`, `profile`).
- **Eleven vertical plugins** — research, development, quality, AI engineering, data science,
  operations, PMO, economics, legal, growth and OSS governance — each depending on the kernel and
  installable on its own.
  `foundry-growth` covers what surrounds a project rather than what is inside it — positioning,
  launch, audience, fundraising narrative, personal reputation and finding collaborators — and is
  the only vertical that ships a hook of its own: an advisory `PreToolUse` gate that asks before
  outbound copy states a claim with no evidence beside it.
  `foundry-dev` covers Angular, Spring Boot, Python and FastAPI; `foundry-ai` covers retrieval,
  evaluation, agent architecture and prompt engineering, and hands AI compliance to `foundry-legal`.
- **Five profiles** — `angular-spring-enterprise`, `oss-library`, `pa-italia`, `startup-mvp`, `full`.
- **`AUTHORING.md`**, the normative authoring contract, enforced in CI by
  `scripts/validate-assets.mjs`.
- **Bilingual documentation site** (English and Italian) built with Astro Starlight and published
  to GitHub Pages.

### Notes

- Verified against Claude Code 2.1.250 as of 2026-08-28, checking the hook contract against the
  shipped binary rather than against bundled documentation. Three consequences are baked into this
  release: `PreToolUse` accepts only `allow|deny|ask|defer` (`escalate` is rejected and fails
  open, so the protected-path gate asks); `Stop` and `SubagentStop` block with a top-level
  `{"decision":"block","reason":…}` rather than with `permissionDecision`; and marketplace
  `source` paths resolve against the marketplace root, so each entry carries its full path and
  `metadata.pluginRoot` is not used.
- The blocking gates stay silent until a project runs `foundry init`, so installing the kernel
  does not arm them on every project on the machine.
- Foundry declares an optional dependency on `superpowers` and delegates test-driven development,
  systematic debugging and completion verification to it rather than reimplementing them.
