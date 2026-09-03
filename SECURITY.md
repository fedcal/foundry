# Security policy

## Reporting a vulnerability

Report privately through **GitHub Security Advisories** on this repository
(`Security` → `Report a vulnerability`). If that is not available to you, contact the maintainer
through https://federicocalo.dev.

Please do not open a public issue for a vulnerability.

Include: what the issue is, how to reproduce it, which files or components are affected, and the
impact you believe it has. A proof of concept helps; a weaponised exploit is not required and is
not wanted.

## What to expect

| Stage | Target |
|---|---|
| Acknowledgement | within 3 working days |
| Initial assessment with a severity | within 7 working days |
| Fix or documented mitigation for high and critical issues | within 30 days |
| Public advisory | after a fix is available, crediting you unless you prefer otherwise |

This is a personal open source project, not a funded security team. These are honest targets, not
a contractual SLA.

## Scope

In scope:

- the kernel: `plugins/foundry-core/lib/`, `mcp/`, `hooks/`, `bin/`;
- gate bypasses — a way to make `guard-bash`, `guard-write`, `subagent-firewall` or `stop-verify`
  fail open when they should block;
- contract validation bypasses that let a non-conforming artifact through;
- anything in this repository that causes credential disclosure, arbitrary file write outside the
  project, or command execution the user did not authorise.

Out of scope:

- vulnerabilities in Claude Code itself — report those to Anthropic;
- vulnerabilities in third-party MCP servers this repository merely documents;
- the deliberate design decision that gates can be overridden through `.foundry/overrides.json`:
  overrides are explicit, recorded and expiring, and that is the intended behaviour;
- advice quality. A prompt that gives imperfect guidance is a bug, not a vulnerability.

## A note on what Foundry is

Foundry configures an AI agent that runs commands on your machine. Its gates reduce the chance of a
destructive action; they do not make an agent safe to run unattended on a system you care about.
Read the hooks in `plugins/foundry-core/hooks/` before trusting them — they are short, and they are
meant to be read.
