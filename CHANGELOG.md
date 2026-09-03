# Changelog

All notable changes to Foundry are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html), applied per plugin.

## [Unreleased]

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
