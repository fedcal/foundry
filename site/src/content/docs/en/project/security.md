---
title: Security
description: What is in scope for a Foundry security report, what is not, and how to report it.
sidebar:
  order: 2
---

[`SECURITY.md`](https://github.com/fedcal/foundry/blob/main/SECURITY.md) in the repository is the
authoritative policy. This page summarises it.

## Reporting

Report privately, not in a public issue. Use GitHub's private vulnerability reporting on the
[repository](https://github.com/fedcal/foundry) — the *Security* tab, *Report a vulnerability*.

Include, where you can:

- what an attacker gains;
- the exact steps or the input that triggers it;
- the affected file and version;
- whether it requires the user to already have accepted a tool call.

The last point matters more here than in most projects: Foundry runs inside Claude Code, where the
user is already granting a model the ability to run commands. A report should say what Foundry adds
to that exposure.

## What is in scope

| Area | Examples |
|---|---|
| Guard hooks | A destructive command pattern that bypasses `guard-bash`; a credential format that slips past `guard-write`; a way to make a gate return *allow* when it should deny |
| Path handling | Escaping `.foundry/blackboard/` through a crafted `wave` or `agent` argument to `blackboard_write`; writing outside the project root |
| The MCP server | Reading a file outside the project through `contract_validate`'s `path` argument or a resource URI; crashing the server in a way that disables the gates |
| Contract validation | An artifact that validates but should not, in a way that lets a downstream agent act on unchecked data |
| Overrides | Making an expired override apply, or an override apply to a gate it does not name |
| Worktree preparation | Linking or writing outside the intended worktree |
| Supply chain of this repository | Anything in a workflow under `.github/workflows/` that could execute untrusted input with elevated permissions |

## What is not in scope

- **The behaviour of the model.** Prompt injection against Claude, an agent being talked into a bad
  decision, or a model producing insecure code are Claude Code and model concerns, not Foundry
  vulnerabilities. Report those to Anthropic.
- **Advice quality.** An agent giving a wrong architectural, legal or security recommendation is a
  bug, not a vulnerability. Open a normal issue.
- **Jurisdiction pack accuracy.** Every pack ships with `lastReviewed: null` and unverified
  citations, by design and by declaration. A wrong citation is an accuracy issue; open a normal
  issue with the official text.
- **The gates being bypassable by the user.** `enforcement: off` and `.foundry/overrides.json`
  exist deliberately. A user disabling their own gates is the documented behaviour, not a
  vulnerability.
- **Third-party plugins**, including `superpowers`. Report those upstream.

## Design decisions relevant to security

Some behaviours look like weaknesses and are deliberate. They are documented so that a report can
be about whether the trade-off is right, rather than about whether it exists.

| Behaviour | Reason |
|---|---|
| A hook that cannot read its input returns *no opinion* rather than denying | A malformed payload must not deadlock a session. The failure mode is permissive by choice. |
| The `Stop` gate reads only the last 400 transcript lines | A bounded read on every turn. Verification much earlier in a very long turn may be missed. |
| Credential detection has no override | If it is real, it should not be in a tracked file; if it is a placeholder, make it obviously fake. |
| Protected paths escalate rather than deny | Editing CI or a lockfile is legitimate; doing it unnoticed is not. |
| `.foundry/metrics/` is gitignored | Event logs record queries and gate reasons and stay on the machine that produced them. |

## Supported versions

Foundry is at **0.1.0**. Fixes land on the current release; there is no long-term-support branch.

## Disclosure

Reports are acknowledged and handled privately. A fix is published as a release together with a
GitHub Security Advisory, crediting the reporter unless they ask otherwise.

`foundry-oss` ships the `security-advisory` skill that runs this same process — intake, CVSS
scoring, fix and backport planning, embargo, GHSA publication, CVE request and reporter credit —
for projects that adopt Foundry.

## Licence and independence

Apache-2.0. Foundry is an independent open source project. It is not affiliated with, endorsed by,
or sponsored by Anthropic.
