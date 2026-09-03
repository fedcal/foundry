---
title: Profiles
description: What each of the five profiles selects, exactly what applying one changes on disk, and how to write your own.
sidebar:
  order: 3
---

A profile answers one question: for this kind of project, which plugins, which permission rules and
which enforcement level? It is a single JSON file, applied with one command.

```bash
foundry profile              # list
foundry profile oss-library  # apply
```

## The five profiles

| Profile | Plugins | Enforcement | Index budget | Chosen because |
|---|---|---|---|---|
| `angular-spring-enterprise` | core, dev, quality, ops, pmo, legal | `gate` | 4000 | A full-stack enterprise product carries CI, database migrations and production config that must not change silently, plus GDPR and accessibility duties that are not optional. |
| `oss-library` | core, oss, research, quality, dev | `gate` | 3000 | A public library lives or dies on governance and documentation. `LICENSE` and `NOTICE` are protected because changing them has legal consequences for every downstream user. |
| `pa-italia` | core, legal, dev, quality, pmo, oss, economics | `gate` | 5000 | Italian public-sector software must produce an audit trail. Accessibility is a legal obligation, not a quality goal, and ADRs are evidence for procurement. The largest index budget of the five, because compliance context is worth carrying. |
| `startup-mvp` | core, dev, economics, research | `warn` | 2500 | Speed matters more than ceremony, but the mistakes that are not recoverable by moving fast — leaked secrets, destroyed history — still stop you. |
| `full` | all twelve | `gate` | 6000 | For exploring Foundry. In a real project a narrower profile keeps routing cheap. |

### Permissions each profile sets

| Profile | Pre-approved | Asks first | Denied |
|---|---|---|---|
| `angular-spring-enterprise` | `mvn`, `./mvnw`, `gradle`, `./gradlew`, `npm run`, `npx ng`, read-only git, `Read`/`Glob`/`Grep` | `git push`, `docker push`, `kubectl apply`, `terraform apply` | reading `.env*`, `**/secrets/**`, `*.pem`, `*.p12` |
| `oss-library` | `npm run`, `npm test`, `npx`, `gh issue`, `gh pr`, read-only git, `Read`/`Glob`/`Grep` | `npm publish`, `gh release`, `git push`, `git tag` | reading `.env*` |
| `pa-italia` | `Read`/`Glob`/`Grep`, read-only git | `git push`, `gh release` | reading `.env*`, `**/dati-personali/**` |
| `startup-mvp` | `npm`, `npx`, all of `git`, `Read`/`Glob`/`Grep`, `Write`, `Edit` — with `defaultMode: acceptEdits` | `git push` | reading `.env*` |
| `full` | `Read`/`Glob`/`Grep` only | `git push` | reading `.env*` |

### Protected paths each profile adds

`protectedPaths` do not deny a write; they escalate it to you for confirmation.

| Profile | Protected |
|---|---|
| `angular-spring-enterprise` | `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `**/src/main/resources/db/migration/**`, `**/application-prod.*` |
| `oss-library` | `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `LICENSE`, `NOTICE` |
| `pa-italia` | `.github/workflows/**`, `**/*.lock`, `**/accessibility-statement*`, `docs/adr/**` |
| `startup-mvp` | `.github/workflows/**`, `**/*.lock` |
| `full` | the built-in default: `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `db/migrations/**` |

:::note[What warn actually softens]
`warn` softens the Bash rules from a denial to a prompt, and nothing else. At `warn`,
`startup-mvp` still hard-denies secret writes, still escalates protected paths, still verifies
completion claims and still enforces the subagent context firewall — the last two are governed by
`verifyOnStop` and `handoffSummaryTokenBudget`, not by the enforcement level. The exact matrix is
in [Gates](/foundry/en/concepts/gates/).
:::

## What applying a profile actually changes

`foundry profile <id>` touches exactly two files.

**`.claude/settings.json`** — merged, never replaced:

- `extraKnownMarketplaces.foundry` is set to the GitHub source `fedcal/foundry`.
- `enabledPlugins` gains `<plugin>@foundry` for each plugin in the profile, as a set union.
- `permissions.allow`, `.ask` and `.deny` gain the profile's entries, as set unions.
- `permissions.defaultMode` is overwritten if the profile declares one.

**`.foundry/config.json`** — rewritten as the current effective configuration merged with the
profile's `foundryConfig`. Keys the profile does not mention keep their current values.

Then it prints the plugin list and reminds you to restart or run `/reload-plugins`.

### What it does not do

- It does not install or download plugins. It records which plugins should be enabled; the
  marketplace still has to be reachable.
- It never removes anything. Permissions and enabled plugins are merged in, so switching from
  `full` to `startup-mvp` leaves the other eight plugins enabled. To narrow, edit
  `.claude/settings.json` by hand.
- `foundry profile <id>` applies `plugins`, `permissions` and `foundryConfig`, then prints
  `notes`, `recommendedMcpServers` and `jurisdictionPacks` for you to act on. Those three are
  advice, not automation: no MCP server is installed and no jurisdiction pack is enabled for you.

## Write your own

Profiles are files under `profiles/` in a checkout of the Foundry repository. `foundry profile`
resolves that directory three levels above the CLI (`bin/../../../profiles`), so a custom profile
must live in the same checkout as the installed plugin. There is no user-level profile directory,
and no way to point the command elsewhere.

Create `profiles/data-platform.json`:

```json
{
  "id": "data-platform",
  "name": "Data platform",
  "description": "Batch and streaming pipelines: schema changes are the risk, not the UI.",
  "plugins": ["foundry-core", "foundry-dev", "foundry-quality", "foundry-ops"],
  "foundryConfig": {
    "enforcement": "gate",
    "indexTokenBudget": 3500,
    "protectedPaths": [
      ".github/workflows/**",
      "**/*.lock",
      "dbt/models/**/schema.yml",
      "airflow/dags/**"
    ]
  },
  "permissions": {
    "allow": ["Bash(dbt:*)", "Bash(python -m pytest:*)", "Read(**)", "Glob(**)", "Grep(**)"],
    "ask": ["Bash(dbt run:*)", "Bash(airflow dags trigger:*)", "Bash(git push:*)"],
    "deny": ["Read(./.env)", "Read(./.env.*)"],
    "defaultMode": "default"
  }
}
```

`id`, `description` and `plugins` are the three fields the CLI requires: `id` and `description` are
printed by `foundry profile` with no argument, and `plugins` is mapped over unconditionally, so a
profile without it throws rather than failing cleanly. `foundryConfig` and `permissions` are
optional.

Apply and verify:

```bash
foundry profile data-platform
foundry doctor
```

Two rules worth holding to when you design one. Put a path in `protectedPaths` when a wrong change
is expensive but sometimes correct — the gate asks, it does not refuse. Put a command in
`permissions.ask` when the action is irreversible outside the repository: publishing, tagging,
deploying, applying infrastructure.
