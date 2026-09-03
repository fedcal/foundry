# Foundry — repository instructions

This repository *is* Foundry, so it holds itself to its own rules.

## Before changing anything

[`AUTHORING.md`](./AUTHORING.md) is normative. Every agent, skill, hook and workflow here must
satisfy it, and `scripts/validate-assets.mjs` enforces most of it mechanically.

## Foundry

Project memory index: `.foundry/memory/INDEX.md` (injected automatically at session start).

Retrieve full facts with the `foundry` MCP tool `memory_search`. Do not read
`.foundry/memory/facts/` directly — the index-first path is the point.
Before publishing or releasing, read the `publish-release` runbook with `runbook_get` and follow it.

## Local checks — all three must pass before a commit

```bash
node scripts/validate-assets.mjs                    # assets against AUTHORING.md
node --test 'plugins/foundry-core/test/*.test.mjs'  # kernel unit tests
(cd site && npm run build)                          # bilingual documentation site
```

## Conventions specific to this repository

- Assets are English. Only `site/src/content/docs/it/` is Italian.
- The kernel has **no runtime dependencies**. `npm` is allowed only under `site/`.
- Never edit a published contract schema; add `vN+1`.
- GitHub Actions are pinned by commit SHA with the version in a trailing comment.
- Never assert a version number, price, action SHA or legal citation that was not verified.
