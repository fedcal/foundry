---
title: Contributing
description: The quality bar for a Foundry asset and the three checks to run locally before opening a pull request.
sidebar:
  order: 1
---

Contributions are welcome. Two documents govern them:

- [`AUTHORING.md`](https://github.com/fedcal/foundry/blob/main/AUTHORING.md) — **normative**, and
  enforced by CI. Read it first. A readable walkthrough is at
  [Authoring assets](/foundry/en/reference/authoring/).
- [`CONTRIBUTING.md`](https://github.com/fedcal/foundry/blob/main/CONTRIBUTING.md) — the process:
  branches, commits, pull requests, review.

## The three local checks

Run all three before opening a pull request. They are the same checks CI runs.

```bash
node scripts/validate-assets.mjs                    # every asset against AUTHORING.md
node --test 'plugins/foundry-core/test/*.test.mjs'  # kernel unit tests
cd site && npm ci && npm run build                  # the documentation site
```

| Check | What it catches |
|---|---|
| `validate-assets.mjs` | A marketplace entry with no plugin directory, a `plugin.json` whose name does not match its directory, missing agent or skill frontmatter, a `model` or `effort` outside the allowed enum, a `SKILL.md` body over 500 lines, and Italian text leaking into an asset. |
| `node --test` | Regressions in the kernel: path resolution, the memory store, the index builder, the JSON Schema validator, token accounting. |
| `npm run build` | Broken internal links, invalid frontmatter, and any page that does not compile. |

Only the third needs `npm`. The first two use the Node.js standard library, because Foundry itself
has zero runtime dependencies and the tooling holds itself to the same rule.

## The quality bar

An asset ships only if all of these hold. This is the checklist reviewers work from.

- [ ] It names **concrete** artifacts: real file paths, real commands, real config keys.
- [ ] It states **when not to use it** and what it deliberately does not cover.
- [ ] It defines **measurable** exit criteria — thresholds, counts, gates — not "make it good".
- [ ] It declares `model:` and `effort:` and respects the routing table.
- [ ] It declares input and output contracts (agents), or progressive disclosure (skills).
- [ ] It degrades gracefully when an optional dependency — `superpowers`, an MCP server, a CLI such
      as `gh` — is absent: detect, announce, continue.
- [ ] The body is 500 lines or fewer; longer material lives in `references/`.
- [ ] It cites the standard it enforces where one exists: a WCAG 2.2 SC number, an OWASP ASVS
      control id, an ISO clause, a GDPR article, an RFC number.

The rule that catches most first contributions is **no generic filler**. An asset that would apply
unchanged to any project is a defect, not a starting point.

## Rules that are not negotiable

| Rule | Consequence if broken |
|---|---|
| English only inside plugins | `validate-assets.mjs` fails on Italian markers |
| No vendored third-party content | PR rejected; everything here is original Apache-2.0 work |
| Never duplicate `superpowers` | PR rejected; invoke it instead |
| Zero runtime dependencies | PR rejected; standard library only |
| Cross-platform hooks, exec form only | PR rejected; no shell pipelines |
| Never edit a `*.v1` schema in a breaking way | Add `*.v2` instead |

## Where things go

| Contribution | Location |
|---|---|
| A new agent | `plugins/foundry-<vertical>/agents/<domain>-<role>.md` |
| A new skill | `plugins/foundry-<vertical>/skills/<verb>-<object>/SKILL.md` |
| Reference material for a skill | `references/` beside the `SKILL.md`, loaded on demand |
| A new contract | `plugins/foundry-core/schemas/<noun>.v<major>.schema.json` |
| A new jurisdiction | `plugins/foundry-legal/packs/<id>.json` — see the pack format in [foundry-legal](/foundry/en/plugins/legal/) |
| Documentation | `site/src/content/docs/{en,it}/…`, both languages |

Documentation is bilingual EN/IT and lives in `site/`, never inside a plugin. Italian pages keep
identical filenames and `sidebar.order`; only the content is translated.

## Issue templates

The repository ships four intake paths under `.github/ISSUE_TEMPLATE/`: a bug report, an asset
proposal, a jurisdiction pack proposal, and a config that routes anything else.

Use the jurisdiction template for a compliance pack: it asks, per control, whether the citation was
confirmed against an official text — which is the question that decides whether
`unverifiedCitation` stays `true`.

## Licence

Apache-2.0. By contributing you agree your contribution is licensed under it. See
[`LICENSE`](https://github.com/fedcal/foundry/blob/main/LICENSE) and
[`NOTICE`](https://github.com/fedcal/foundry/blob/main/NOTICE).
