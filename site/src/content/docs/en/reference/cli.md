---
title: CLI
description: Every foundry subcommand, its flags and arguments, and the exact shape of what it prints.
sidebar:
  order: 1
---

The CLI is a Node.js script shipped as `plugins/foundry-core/bin/foundry.mjs`. It has zero runtime
dependencies and every subcommand is safe to re-run.

:::caution[There is no bare foundry command]
Claude Code prepends a plugin's `bin/` **directory** to PATH. It creates no name shims and strips
no extension, and the only file in Foundry's `bin/` is `foundry.mjs` — so what lands on PATH is
`foundry.mjs`, never `foundry`. The invocation that always works is the explicit one:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs" doctor   # from a plugin asset
node plugins/foundry-core/bin/foundry.mjs doctor      # from a repository checkout
```

Every example on this page is written `foundry <command>` for readability. Substitute one of the
two forms above, or define a `foundry` alias in your own shell pointing at the installed
`bin/foundry.mjs`.
:::

## Project root resolution

Every subcommand resolves the project root the same way: it starts from `CLAUDE_PROJECT_DIR` if
set, otherwise the current working directory, and walks up until it finds a directory containing
`.foundry/` or `.git/`. If neither is found it falls back to the starting directory.

`foundry help` prints the resolved root, which is the quickest way to check you are operating on
the project you think you are.

## Commands

```
foundry init                  create or repair .foundry state in this project
foundry doctor                check state, memory, runbooks and artifacts
foundry memory index          rebuild the memory index
foundry memory search <q>     search stored facts
foundry memory prune          list expired, superseded and malformed facts
foundry tokens                report what this project's memory costs per session
foundry runbooks              list available runbooks
foundry validate <id> <file>  validate a JSON artifact against a contract
foundry profile [name]        list or apply a project profile
```

`runbook` is accepted as an alias for `runbooks`. `help`, `--help` and `-h` all print the usage
block above. An unrecognised command prints `Unknown command "<name>".`, then the usage block, and
exits `1`.

---

## `foundry init`

No arguments.

Creates the `.foundry/` tree (`scratch/`, `memory/`, `memory/facts/`, `runbooks/`, `blackboard/`,
`metrics/`), writes `.foundry/config.json` and `.foundry/overrides.json` if they do not exist,
appends `.foundry/scratch/`, `.foundry/metrics/` and `.foundry/blackboard/` to `.gitignore` if
missing, and builds the memory index. Blackboard artifacts are therefore local to the machine and
the session: they hold intermediate output — code excerpts, raw findings — and are not meant to
travel in a pull request.

Existing files are never overwritten, so re-running it repairs rather than resets.

```
Initialised Foundry state in .foundry
Next: seed memory with the `foundry-init` skill, then run `foundry doctor`.
```

On a project that already had `.foundry/`, the first word is `Repaired` instead of `Initialised`.

## `foundry doctor`

No arguments.

Runs eleven checks and prints one line each, prefixed with `  ok  ` or ` FAIL `. A failing check
adds a second indented line with the detail. (Ten, when `config.json` is missing or unparseable:
the type check then has nothing to inspect and is skipped.)

| Check | Fails when |
|---|---|
| `.foundry` state directory exists | the directory is missing |
| `config.json` present and parses as JSON | the file is missing, or is not valid JSON — in which case every setting in it is being ignored |
| every setting in `config.json` has the right type | a setting parses but has the wrong type, e.g. `"protectedPaths": "**/*.lock"` where an array is expected |
| enforcement level is valid | `enforcement` is not `gate`, `warn` or `off` |
| active fact count | never — informational |
| index within budget | facts had to be dropped to fit `indexTokenBudget` |
| no duplicate fact titles | two active facts share a title, case-insensitively |
| every decision and risk records its reasoning | a `decision` or `risk` fact has no `**Why:**` line |
| runbooks document rollback | a runbook mentioning deploy, migrate, release, delete or drop has no `## Rollback` section |
| no expired gate overrides still in the file | an override in `.foundry/overrides.json` has an `expires` date in the past |
| every blackboard artifact validates against its contract | an artifact is unparseable, has an unknown or missing `schema`, or fails validation |

```
  ok   .foundry state directory exists
         /home/me/project/.foundry
  ok   config.json present and parses as JSON
  ok   every setting in config.json has the right type
  ok   enforcement level is valid ("gate")
  ok   12 active facts (3 expired or superseded)
  ok   index within budget (~1840/4000 tokens)
  ok   no duplicate fact titles
 FAIL  every decision and risk records its reasoning
         fact-0007, fact-0011
  ok   4 runbooks, all mutating ones document rollback
  ok   no expired gate overrides still in the file
  ok   every blackboard artifact validates against its contract

1 check(s) failed.
```

Exit code is the number of failures capped to `1`; `0` when everything passes, in which case the
final line is `All checks passed.`

## `foundry memory`

```
foundry memory [index|search <query>|prune]
```

The subcommand defaults to `index` when omitted. Anything else prints
`Usage: foundry memory [index|search <query>|prune]` and exits `1`.

### `foundry memory index`

Rebuilds `.foundry/memory/INDEX.md` and reports how much of the budget it used.

```
12/15 facts listed, ~1840 tokens, 3 omitted.
```

Omitted facts are not deleted; they are simply left out of the always-loaded index and remain
retrievable through `memory_search`.

### `foundry memory search <query>`

All remaining arguments are joined with spaces and used as the query. Returns at most 10 hits.

```
fact-0004  [decision/high]  Persistence layer uses Flyway, not Liquibase
fact-0009  [constraint/medium]  The reporting database is read-only for the API
```

Prints `No match.` when nothing scores above the threshold.

### `foundry memory prune`

Lists candidates. **Nothing is deleted.**

```
Prune candidates (nothing is deleted automatically):

  expired:
    - fact-0002 — expired 2026-06-30
  superseded:
    - fact-0005 — superseded by a newer fact
  missing reasoning:
    - fact-0011 — add a **Why:** line

Retire a fact by setting `expires`, not by deleting it: the history of a decision is part of its value.
```

Sections with no entries are omitted entirely.

## `foundry tokens`

No arguments. Reports what the project's memory configuration costs per session.

```
Foundry token accounting

  memory index (always loaded)   ~1840 tokens  (budget 4000)
  facts, retrieved on demand     ~9210 tokens across 15 facts
  runbooks, retrieved on demand  ~6400 tokens
  blackboard artifacts           ~24800 tokens (never loaded wholesale)

  eager loading would cost       ~40410 tokens per session
  index-first costs              ~1840 tokens per session
  saving                         ~38570 tokens per session (95%)

Estimates use ~4 characters per token. For billed usage see /cost and /usage.
```

The `saving` line is printed only when there is something to load. The percentage is
`1 - index / eager`, rounded.

## `foundry runbooks`

No arguments. Lists every runbook with its slug padded to 28 characters, its title, and its trigger
on a second indented line when one is declared.

```
deploy-production            Deploy to production
                             trigger: deploy, release to prod
rotate-api-keys              Rotate third-party API keys
```

With no runbooks:

```
No runbooks. Create one with the `runbook` skill after any task worth repeating.
```

## `foundry validate <schema-id> <path-to-json>`

Both arguments are required. `<schema-id>` is a contract id such as `finding.v1`; `<path-to-json>`
is a path to the artifact.

```
$ foundry validate finding.v1 .foundry/blackboard/audit/appsec-reviewer.json
VALID against finding.v1
```

On failure, output goes to stderr and the exit code is `1`:

```
INVALID against finding.v1:
  - missing required property "failureScenario"
  - severity: must be one of critical, high, medium, low, info
```

With a missing argument: `Usage: foundry validate <schema-id> <path-to-json>`, exit `1`.
With an unknown contract: `Unknown contract "x". Available: adr.v1, compliance-check.v1, …`,
exit `1`.

## `foundry profile [name]`

With no argument, lists the profiles found in `profiles/` with the id padded to 26 characters:

```
Available profiles:

  angular-spring-enterprise  Full-stack enterprise product: Angular frontend, Spring Boot services, relational database, strict gates.
  full                       All twelve plugins. Use to explore Foundry; in a real project pick a narrower profile to keep discovery cheap.
  oss-library                A public library or tool: governance, documentation, semantic versioning, contributor workflow.
  pa-italia                  Software for the Italian public sector: AgID guidelines, accessibility obligations, reuse, procurement evidence.
  startup-mvp                Move fast without setting fire to the future: lighter gates, economics on, heavy process off.

Apply one with: foundry profile <id>
```

With a name, it merges the profile into `.claude/settings.json` — registering the `foundry`
marketplace, unioning `enabledPlugins`, and unioning the `allow`, `ask` and `deny` permission
lists — then merges the profile's `foundryConfig` into `.foundry/config.json`.

```
Applied profile "angular-spring-enterprise".
  plugins: foundry-core, foundry-dev, foundry-quality, foundry-ops, foundry-pmo, foundry-legal
  settings: .claude/settings.json

Restart Claude Code, or run /reload-plugins, for the change to take effect.
```

An unknown name prints `No profile "<name>".` and exits `1`.

### Profiles

| Profile | Plugins | `enforcement` |
|---|---|---|
| `angular-spring-enterprise` | core, dev, quality, ops, pmo, legal | `gate` |
| `oss-library` | core, oss, research, quality, dev | `gate` |
| `pa-italia` | core, legal, dev, quality, pmo, oss, economics | `gate` |
| `startup-mvp` | core, dev, economics, research | `warn` |
| `full` | all twelve | `gate`, with `indexTokenBudget: 6000` |

## Limits

- Permission merging is additive. `foundry profile` never removes an entry you already had, which
  means applying two profiles in sequence leaves the union of both.
- Token figures are estimates at roughly four characters per token, not tokenizer output.
- `foundry profile` writes `.claude/settings.json`; it does not install plugins. Claude Code
  installs them when it next loads the settings.
