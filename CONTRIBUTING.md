# Contributing to Foundry

Thank you for considering it. This project aims to be a de-facto standard, which means the bar for
what goes in is deliberately high — not to gatekeep, but because a standard full of generic
material is worse than no standard at all.

## Read this first

[`AUTHORING.md`](./AUTHORING.md) is **normative**. It defines the frontmatter schemas, model and
effort routing, the memory model, the I/O contracts and the quality bar. CI enforces most of it
mechanically; a reviewer enforces the rest. A pull request that has not been checked against it
will be sent back for that reason alone.

## The quality bar, in short

An asset ships only if all of these hold:

- [ ] It names **concrete** things: real file paths, real commands, real config keys, real thresholds.
- [ ] It states **when not to use it** and what it deliberately does not cover.
- [ ] Its exit criteria are **measurable** — numbers, not adjectives.
- [ ] It declares `model:` and `effort:` per the routing table.
- [ ] Agents declare `## Input contract` and `## Output contract`.
- [ ] `SKILL.md` is under 500 lines; depth lives in `references/`.
- [ ] It degrades gracefully when an optional dependency is missing.
- [ ] It cites the standard it enforces, where one exists (WCAG SC, OWASP ASVS id, RFC, ISO clause).

The commonest reason a contribution is rejected: it reads like it could apply to any project. If
removing the domain words would leave a generic template, it is not ready.

## Before you open a pull request

```bash
node scripts/validate-assets.mjs                    # every asset against AUTHORING.md
node --test 'plugins/*/test/*.test.mjs'  # unit tests, every plugin
cd site && npm ci && npm run build                  # documentation site
```

All three must pass. If you changed kernel behaviour, add a test that fails without your change.

## What to work on

- **A new agent or skill in an existing vertical** — the easiest useful contribution. Open an issue
  first describing what it does and, importantly, what it will not do.
- **A jurisdiction pack** in `plugins/foundry-legal/packs/` — packs are data, so a new country is a
  new file, not a new prompt. State the instrument and the obligation in general terms; do not
  invent article numbers, thresholds or deadlines, and set `unverifiedCitation: true` where a
  citation could not be confirmed.
- **A new contract version** — never edit a published `vN` schema. Add `vN+1` and migrate consumers.
- **Translations** — the documentation site is English and Italian. Assets themselves stay English.

## What will not be merged

- Vendored or copied content from other projects, in any form. Everything here is original and
  Apache-2.0.
- Anything reimplementing what [`superpowers`](https://github.com/obra/superpowers) already does
  well. Foundry delegates to it.
- References to `gsd-*` tooling.
- Runtime dependencies. The kernel is Node standard library only, and stays that way.
- Version numbers, prices, action SHAs or legal citations that the author did not verify.
- Working exploit code. Security assets are defensive: classes of vulnerability, detection,
  remediation.

## Commits and releases

Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Versioning is
SemVer, per plugin. A change that alters an existing contract, gate behaviour or a frontmatter
requirement is breaking, even when no code changes.

## Reporting problems

Bugs and ideas: GitHub issues. Security: see [`SECURITY.md`](./SECURITY.md) — please do not open a
public issue for a vulnerability.
