<div align="center">

# Foundry

**The senior-engineering stack for Claude Code.**

Twelve plugins. One kernel. Governed memory, contracts between agents, gates that explain
themselves, and a token budget you can measure.

[Documentation](https://fedcal.github.io/foundry) ·
[Italiano](./README.it.md) ·
[Authoring contract](./AUTHORING.md) ·
[federicocalo.dev](https://federicocalo.dev)

[![Validate](https://github.com/fedcal/foundry/actions/workflows/validate.yml/badge.svg)](https://github.com/fedcal/foundry/actions/workflows/validate.yml)
[![Licence](https://img.shields.io/badge/licence-Apache--2.0-blue.svg)](./LICENSE)

</div>

---

## Install

```bash
/plugin marketplace add fedcal/foundry
/plugin install foundry-core@foundry
```

`foundry-core` is the kernel, is required, and is enabled on install. Add the verticals you need —
**every vertical ships `defaultEnabled: false`, so installing one is not enough: enable it too, or
none of its agents and skills load.**

```bash
/plugin install foundry-dev@foundry        # architecture, Angular, Spring Boot, data, security, UX
/plugin enable  foundry-dev@foundry
/plugin install foundry-quality@foundry    # test strategy, performance, observability, SRE
/plugin enable  foundry-quality@foundry
/plugin install foundry-ops@foundry        # CI/CD, containers, Kubernetes, IaC, releases
/plugin enable  foundry-ops@foundry
```

Or apply a profile, which picks the plugins, permissions and enforcement level together:

```bash
foundry.mjs profile angular-spring-enterprise
```

Available profiles: `angular-spring-enterprise`, `oss-library`, `pa-italia`, `startup-mvp`, `full`.

Claude Code puts each plugin's `bin/` **directory** on the `PATH` its Bash tool sees, so the kernel
CLI answers to its file name, `foundry.mjs`. If you would rather type `foundry`, alias it once:

```bash
alias foundry='foundry.mjs'
```

## The problem it solves

A capable coding agent still forgets what you decided last week, re-reads the same files every
session, claims work is finished without running it, and produces confident output that nobody
checked. Adding more prompts does not fix that. Foundry fixes it with mechanism:

| Failure | Mechanism |
|---|---|
| Decisions are forgotten between sessions | Four-tier memory; only a 4000-token index is loaded, the rest is retrieved on demand |
| Subagents return walls of text and blow the budget | A `SubagentStop` gate rejects returns over the handoff budget and demands an artifact instead |
| Agents hand each other unstructured prose | Eleven versioned JSON Schemas; a `PostToolUse` hook returns violations to the author |
| "All tests pass" without running the tests | A `Stop` gate blocks completion claims with no verification command in the turn |
| Secrets and destructive commands slip through | `PreToolUse` gates with named rules and documented, expiring overrides |
| Nobody knows what a session costs | Model routing per agent, a context firewall, and `foundry.mjs tokens` |

## What is in it

```
foundry-core        kernel: memory, contracts, orchestration, gates, MCP server, CLI
foundry-research    domain research, technology evaluation, documentation engineering
foundry-dev         architecture, protocols, integrations, security, UX/a11y, Angular, Spring, data
foundry-quality     test strategy, contract and E2E testing, performance, observability, SRE
foundry-ai          RAG pipelines, LLM evaluation, agent architecture, prompt engineering
foundry-data        exploratory analysis, model training and evaluation, MLOps
foundry-ops         GitHub Actions, containers, Kubernetes, Terraform, cloud and PaaS, releases
foundry-pmo         roadmap, backlog, requirements, risk, GitHub operations, reporting
foundry-economics   cost engineering, FinOps, AI spend, business cases, funding
foundry-legal       compliance engine plus jurisdiction packs: global, EU/IT, North America, UK/APAC/LATAM
foundry-growth      positioning, launch, audience, fundraising narrative, personal brand, collaborators
foundry-oss         governance, RFC process, triage, semantic versioning, security advisories
```

Every vertical declares `dependencies: [foundry-core]`, so installing one pulls the kernel.

## How it works

### Governed memory

```
.foundry/
├── scratch/          T0  session-local, gitignored
├── memory/facts/     T1  atomic durable facts, one file each
├── memory/INDEX.md   T1  the only file loaded by default, capped at 4000 tokens
├── runbooks/         T2  procedures someone will repeat
└── blackboard/       ..  validated artifacts agents hand to each other
docs/adr/             T3  architecture decisions, permanent and public
```

Facts are written through the MCP tool `memory_write`, which deduplicates, assigns ids and
maintains supersedes chains. They are read through `memory_search`, which returns only what
matches. Nothing reads the fact files directly — that is the whole point.

### Contracts between agents

```jsonc
// .foundry/blackboard/audit/appsec-reviewer.json
{
  "schema": "review.v1",
  "producedBy": "appsec-reviewer",
  "target": "src/main/java/com/acme/auth",
  "dimension": "security",
  "verdict": "block",
  "summary": "One confirmed high finding: /api/login has no rate limit or lockout.",
  "findings": [
    {
      "schema": "finding.v1",
      "producedBy": "appsec-reviewer",
      "id": "F-1",
      "severity": "high",
      "title": "No lockout or rate limit on the login endpoint",
      "summary": "Credentials can be brute-forced at full request rate.",
      "failureScenario": "An attacker sends 10k requests/min to /api/login; no lockout occurs.",
      "confidence": "high",
      "standard": "OWASP ASVS 5.0 V6 Authentication; CWE-307"
    }
  ]
}
```

A review wraps its findings; each finding stands on its own contract. `failureScenario` is required
by the schema, so a finding without one is speculation and the contract refuses it — the agent gets
the validation error back and corrects itself, with no human in the loop.

### Orchestration

Three mechanisms, chosen deliberately rather than interchangeably:

- **in-session fan-out** for 2–6 specialists you want to steer between waves;
- **dynamic workflows** (`workflows/*.js`) when the item list is discovered at runtime — audit
  sweeps, migrations, per-file review — deterministic and rerunnable;
- **headless fan-out** (`claude -p`) for CI and work larger than one session's context.

Agents that write files concurrently run with `isolation: worktree`; read-only agents never do.

## Requirements

- Claude Code **2.1.x** or later (the plugin schema used here — `dependencies`, `workflows/`,
  hook `if` conditions, 31 hook events — is 2.1-era).
- Node.js **20+** for the kernel. There are no other runtime dependencies, and `npm install` is
  never required to use Foundry.
- Optional: [superpowers](https://github.com/obra/superpowers). Foundry delegates test-driven
  development, systematic debugging and completion verification to it, and degrades gracefully
  when it is absent.

## Contributing

Read [AUTHORING.md](./AUTHORING.md) first — it is normative, and CI enforces it. Then
[CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
node scripts/validate-assets.mjs                    # every asset against AUTHORING.md
node --test 'plugins/foundry-core/test/*.test.mjs'  # kernel unit tests
cd site && npm ci && npm run build                  # the documentation site
```

## Licence

[Apache-2.0](./LICENSE). See [NOTICE](./NOTICE).

Foundry is an independent open source project. It is not affiliated with, endorsed by, or
sponsored by Anthropic.
