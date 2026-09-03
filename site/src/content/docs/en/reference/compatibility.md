---
title: Compatibility
description: Which Claude Code version Foundry targets, which plugin schema fields it depends on, and how to check your setup.
sidebar:
  order: 6
---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Claude Code | **2.1.x or later** | The plugin schema used here is 2.1-era |
| Node.js | **20 or later** | For the kernel: CLI, MCP server, hooks |
| `superpowers` | optional | Foundry delegates to it and degrades gracefully when absent |

There are no other runtime dependencies. `npm install` is never required to use Foundry — every
executable file uses only the Node.js standard library.

`AUTHORING.md` was verified against the official Claude Code documentation on **2026-08-27** for
Claude Code **2.1.247**. That is the version the assets were written against.

## Schema fields Foundry depends on

Foundry does not use the whole plugin schema. It uses these parts, and a Claude Code version
missing any of them will not run it correctly.

| Field or feature | Where | Why Foundry needs it |
|---|---|---|
| `dependencies` in `plugin.json` | every vertical | Each vertical declares `foundry-core`, so installing one pulls the kernel |
| `bin/` added to PATH | `foundry-core` | Puts `bin/foundry.mjs` within reach. Claude Code adds the directory, not a shim, so the name on PATH is `foundry.mjs` — see [CLI](/foundry/en/reference/cli/) |
| `mcpServers` merged from `.mcp.json` | `foundry-core` | Registers the `foundry` MCP server |
| `hooks` merged from `hooks/hooks.json` | `foundry-core` | Registers the nine hook entries |
| `workflows/` | `foundry-core` | Three dynamic workflows |
| `outputStyles` from `output-styles/` | `foundry-core` | Three output styles |
| `metadata` free-form object | every plugin | Carries `foundry.vertical` and `foundry.contracts` |
| `defaultEnabled` | every plugin | `true` on the kernel, `false` on every vertical |
| Agent `effort` | every agent | Effort routing is half the token economy |
| Agent `isolation: worktree` | ops, research | Parallel writers need isolated checkouts |
| Agent `memory: project` | most agents | Persistent cross-session agent memory |
| Skill `context: fork` and `agent:` | `compliance-scan` and others | Runs a skill through a named agent in its own context |
| Skill `disable-model-invocation` | `foundry-init` | User-invocable only |
| Hook `if` conditions | authoring contract | Documented for asset authors |
| `SubagentStop` hook event | `foundry-core` | The context firewall |
| `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` | hooks, `.mcp.json` | Path resolution |

The MCP server declares protocol version `2025-06-18` and implements `initialize`, `ping`,
`tools/list`, `tools/call`, `resources/list` and `resources/read`. It does not implement prompts,
sampling or subscriptions.

## How to check

### Claude Code

```
/help
```

The version is shown in the header. Foundry needs 2.1.x or later.

### Node.js

```bash
node --version
```

If this prints anything below `v20`, the CLI, the hooks and the MCP server will fail. Nothing else
in Foundry depends on Node.

### Foundry itself

```bash
foundry doctor
```

`foundry` is not itself a command on PATH: Claude Code adds the plugin's `bin/` directory without
creating a shim, so the executable is `foundry.mjs`. Call it explicitly with
`node "${CLAUDE_PLUGIN_ROOT}/bin/foundry.mjs" doctor`, or alias it. If even that fails,
`foundry-core` is not installed — restart Claude Code or run `/reload-plugins`.

`foundry doctor` checks state, memory, runbooks, overrides and blackboard artifacts, and exits
non-zero if anything fails. See [CLI](/foundry/en/reference/cli/) for the full check list.

### Plugins and MCP

```
/plugin
```

Lists installed plugins and whether each is enabled. `foundry-core` should be present and enabled;
every vertical you installed should be listed with `foundry-core` satisfied as a dependency.

```
/mcp
```

Should list a server named `foundry`. If it is missing, `.mcp.json` was not merged — check that
`foundry-core` is enabled, not merely installed.

### Assets, if you are contributing

```bash
node scripts/validate-assets.mjs
```

Validates every asset against `AUTHORING.md`, including the model and effort enums and the
500-line skill body limit.

## Versioning

All twelve plugins and the marketplace itself are at **0.1.0**. Verticals declare
`"dependencies": [{ "name": "foundry-core", "version": "^0.1.0" }]`, so a `0.1.x` kernel satisfies
a `0.1.x` vertical.

Contracts are versioned independently of the plugins, by filename: `finding.v1`, `adr.v1` and so
on. A breaking change to a contract adds `*.v2` and leaves `*.v1` in place, so an older agent keeps
validating.

## Known limits

- Foundry is tested against the plugin schema as documented on 2026-08-27. A newer Claude Code that
  changes hook payload field names — `last_assistant_message`, `transcript_path`, `worktree_path`,
  `reason`, `agent_type` — would silently degrade the gates that read them, since a hook that
  cannot read its input returns *no opinion* rather than blocking.
- The `Stop` gate parses the transcript file as JSON lines. A change to that format disables the
  gate rather than breaking the session.
- Foundry registers no `WorktreeCreate` hook, so nothing links Foundry state into a worktree.
  Committed `.foundry/` content arrives through git; `.foundry/blackboard/` is gitignored and
  therefore per-worktree. `.worktreeinclude` copies file by file and skips symlinks, so a listed
  directory containing any arrives incomplete.
- Foundry is an independent open source project. It is not affiliated with, endorsed by, or
  sponsored by Anthropic, and it makes no guarantee about future Claude Code releases.
