---
title: Changelog
description: Release history for the Foundry marketplace and its twelve plugins.
sidebar:
  order: 3
---

All twelve plugins and the marketplace share a version. Contracts are versioned separately, by
filename.

## 0.1.0

First public release.

### Marketplace

Twelve plugins under one marketplace (`fedcal/foundry`), each declaring
`dependencies: [foundry-core]` except the kernel itself. `foundry-core` is the only plugin with
`defaultEnabled: true`.

| Plugin | Agents | Skills |
|---|---|---|
| `foundry-core` | 4 | 7 |
| `foundry-research` | 5 | 5 |
| `foundry-ai` | 4 | 4 |
| `foundry-data` | 4 | 4 |
| `foundry-dev` | 19 | 17 |
| `foundry-quality` | 6 | 5 |
| `foundry-ops` | 6 | 5 |
| `foundry-pmo` | 6 | 6 |
| `foundry-economics` | 5 | 5 |
| `foundry-legal` | 5 | 4 |
| `foundry-growth` | 6 | 6 |
| `foundry-oss` | 4 | 5 |

### Kernel

- **Governed memory** in four tiers: session scratch, atomic facts, runbooks and ADRs. Only
  `.foundry/memory/INDEX.md` is loaded by default, hard-capped at 4000 tokens; everything else is
  retrieved on demand.
- **Eleven contracts** as JSON Schema 2020-12: `fact.v1`, `finding.v1`, `review.v1`, `adr.v1`,
  `plan.v1`, `requirement.v1`, `risk.v1`, `estimate.v1`, `compliance-check.v1`, `handoff.v1`,
  `tracker-item.v1`.
- **MCP server** (`foundry`): nine tools — `memory_search`, `memory_write`, `memory_index`,
  `runbook_list`, `runbook_get`, `contract_validate`, `blackboard_write`, `blackboard_read`,
  `token_report` — plus a memory-index resource, a contracts resource and one resource per runbook.
- **Nine hook entries** across eight events: session state injection, targeted prompt-time recall,
  a Bash guard with eight named rules, a write guard for credentials and protected paths,
  blackboard contract validation, the subagent context firewall, the verify-before-claiming gate,
  pre-compaction persistence, worktree preparation and session-end metrics.
- **CLI**: `foundry init`, `doctor`, `memory index|search|prune`, `tokens`, `runbooks`,
  `validate`, `profile`.
- **Three dynamic workflows**: `foundry-feature-delivery`, `foundry-audit-sweep`,
  `foundry-compliance-sweep`.
- **Two playbooks**: `feature-delivery.yaml`, `audit.yaml`.
- **Three output styles**: Foundry Senior Engineer, Foundry Analyst, Foundry PMO.

### Profiles

Five profiles that set plugins, permissions and enforcement level together:
`angular-spring-enterprise`, `oss-library`, `pa-italia`, `startup-mvp`, `full`.

### Jurisdiction packs

Five packs, 147 controls in total: `global-baseline` (40), `eu` (39), `it` (16),
`north-america` (26), `uk-apac-latam` (26). Every pack ships with `lastReviewed: null` and an empty
`sources` array; citations are unverified and the engine says so in every report.

### Governance

Thirteen OSS templates in `foundry-oss`, an authoring contract enforced in CI by
`scripts/validate-assets.mjs`, kernel unit tests, and a bilingual EN/IT documentation site.

### Known limits at 0.1.0

- Jurisdiction packs are unverified against official texts.
- `memory_search` is keyword scoring, not semantic search.
- Token figures are estimated at roughly four characters per token, not tokenizer output.
- Pipeline scaffolding targets GitHub Actions only; infrastructure code targets Terraform and
  OpenTofu only; repository operations require an authenticated `gh`.
- The database agents assume PostgreSQL.

### Verified behaviour

Checked against the Claude Code 2.1.250 binary on 2026-08-28, rather than against bundled
documentation. Three consequences are baked into this release:

- `PreToolUse` accepts only `allow`, `deny`, `ask` and `defer`. `escalate` is rejected by the
  schema and fails open, so the protected-path gate asks instead.
- `Stop` and `SubagentStop` block with a top-level `{"decision":"block","reason":…}`, not with
  `permissionDecision`.
- Marketplace `source` paths resolve against the marketplace root, so every entry carries its
  full path and `metadata.pluginRoot` is not used.

The blocking gates stay silent until a project runs `foundry init`, so installing the kernel does
not arm them on every project on the machine.

### Requirements

Claude Code 2.1.x or later; Node.js 20 or later. `superpowers` optional, with graceful
degradation. Licensed Apache-2.0.
