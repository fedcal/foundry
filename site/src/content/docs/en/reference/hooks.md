---
title: Hooks and gates
description: Every Foundry hook — event, matcher, what it blocks, the exact message it returns and the documented override path.
sidebar:
  order: 3
---

`foundry-core` registers nine hook scripts across eight events in `plugins/foundry-core/hooks/hooks.json`. All of them use
hook *exec form* (`command` + `args`, never a shell pipeline), so they run unmodified on Linux,
macOS and Windows.

Four of them can block. The rest inject context or record a metric.

## All hooks

| Event | Matcher | Script | Timeout | Blocking |
|---|---|---|---|---|
| `SessionStart` | `startup\|resume\|clear` | `session-start.mjs` | 15 s | no |
| `UserPromptSubmit` | — | `prompt-context.mjs` | 20 s | no |
| `PreToolUse` | `Bash` | `guard-bash.mjs` | 15 s | **yes** |
| `PreToolUse` | `Write\|Edit\|NotebookEdit` | `guard-write.mjs` | 15 s | **yes** |
| `PostToolUse` | `Write\|Edit` | `validate-contract.mjs` | 20 s | no |
| `SubagentStop` | — | `subagent-firewall.mjs` | 15 s | **yes** |
| `Stop` | — | `stop-verify.mjs` | 25 s | **yes** |
| `PreCompact` | — | `precompact-persist.mjs` | 20 s | no |
| `SessionEnd` | — | `session-end.mjs` | 5 s | no |

Every guard reads `.foundry/config.json`. When `enforcement` is `off`, every guard returns no
opinion immediately. When it is `warn`, `guard-bash` downgrades a denial to an `ask`; the secret
detectors still deny. `subagent-firewall` and `stop-verify` are governed by their own settings —
`handoffSummaryTokenBudget` and `verifyOnStop` — and are switched off only by `enforcement: off`.

---

## Gate: destructive Bash commands

`PreToolUse` on `Bash`. Eight named rules, each with a stated reason and a way out.

| Rule id | Blocks | Why |
|---|---|---|
| `rm-recursive-force` | `rm -rf` in any flag order | Recursive forced delete. Delete specific paths, or move them to a scratch directory first. |
| `git-push-force` | `git push --force` or `-f` (but not `--force-with-lease`) | Force push rewrites shared history. Use `--force-with-lease`, and never on the default branch. |
| `git-reset-hard-remote` | `git reset --hard origin/…` or `upstream/…` | Discards every local commit and working change. Stash or branch first. |
| `git-clean-force` | `git clean` with `-d`, `-f` or `-x` | Deletes untracked and ignored files, including `.env` files. List them with `git clean -n` first. |
| `db-drop` | `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE`, `TRUNCATE TABLE` | Destructive schema change. Route it through a reviewed migration. |
| `chmod-777` | `chmod 777` | World-writable permissions. Grant the narrowest mode that works. |
| `curl-pipe-shell` | `curl … \| sh` or `wget … \| bash`, with or without `sudo` | Executes unreviewed remote code. Download, read, then run. |
| `history-rewrite` | `git filter-branch`, `git filter-repo`, `bfg` | Rewrites the whole repository history. Coordinate with every collaborator first. |

The message is always the same shape:

```
Foundry gate `git-push-force` blocked this command.
Force push rewrites shared history. Use --force-with-lease, and never on the default branch.

If it is genuinely required, add an override to `.foundry/overrides.json`:
{"overrides":[{"gate":"git-push-force","reason":"<why>","expires":"<YYYY-MM-DD>"}]}
```

The decision is `deny` under `enforcement: gate` and `ask` under `enforcement: warn`.

## Gate: secrets and protected paths

`PreToolUse` on `Write`, `Edit` and `NotebookEdit`. Two separate gates in one script.

### Credential detection — hard deny

Runs only when `secretScan` is `true`. Three exemptions:

- files ending in `.example`, `.sample` or `.template` are skipped;
- so is anything under `foundry-core/hooks/`, which contains the patterns themselves;
- and three credential values published by vendors purely as documentation examples
  (`DOCUMENTED_EXAMPLES` in `guard-write.mjs`: `AKIAIOSFODNN7EXAMPLE`, `AKIAI44QH8DHBEXAMPLE` and
  the matching AWS example secret key) are allowed **by value**, at any path. Writing one of them
  anywhere in the project does not fire the gate.

| Rule id | Detects |
|---|---|
| `aws-access-key` | AWS access key id (`AKIA…`) |
| `aws-secret-key` | AWS secret access key, recognised beside its `aws_secret_access_key` key name |
| `github-token` | GitHub token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) |
| `anthropic-key` | Anthropic API key (`sk-ant-…`) |
| `openai-key` | OpenAI-style API key (`sk-proj-…`, `sk-svcacct-…`, `sk-admin-…`, or the legacy `sk-…`) |
| `stripe-key` | Stripe secret or restricted key (`sk_live_`, `sk_test_`, `rk_live_`, `rk_test_`) |
| `slack-token` | Slack token (`xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, `xoxs-`) |
| `private-key` | `-----BEGIN … PRIVATE KEY-----` block |
| `jwt` | JWT (`eyJ….….…`) |
| `connection-string` | Database URL with an inline password |

```
Foundry blocked this write: it contains what looks like a GitHub token.
Move the value to an environment variable or a secret manager and reference it by name.
If this is a placeholder, make it obviously fake (e.g. "REDACTED") or use a .example file.
```

This gate has **no override**. If the value is a placeholder, make it obviously fake or move it to
a `.example` file; if it is real, it should not be in a tracked file at all.

### Protected paths — escalate

Paths matching `config.protectedPaths` escalate to the user rather than denying. Defaults:
`.github/workflows/**`, `**/*.lock`, `package-lock.json`, `db/migrations/**`.

```
`.github/workflows/ci.yml` matches the protected pattern `.github/workflows/**`.
Changes here affect CI, dependency integrity or applied migrations. Confirm this is intended.
```

Overridable with the gate id `protected-path`.

## Gate: context firewall on subagent returns

`SubagentStop`, no matcher. Active at every enforcement level except `off`.

Measures the subagent's returned message. The target is `handoffSummaryTokenBudget` (default 300);
the hard limit at which it denies is **three times** that, so 900 tokens by default. Every return
is recorded as a `subagent_return` metric regardless of whether it passed.

```
Foundry context firewall: this subagent returned ~1420 tokens, over the 900-token hard limit
(target: 300).

Write the full output to the blackboard with the `blackboard_write` tool of the `foundry` MCP
server, then reply with only:
- the artifact path
- a summary of at most 300 tokens
- any blocking question

Do not paste file contents, diffs or long listings into your reply.
```

There is no per-rule override. Raise `handoffSummaryTokenBudget` in `.foundry/config.json`, or set
`enforcement` to `off`.

## Gate: verify before claiming

`Stop`, no matcher. Active when `verifyOnStop` is `true` and `enforcement` is not `off`.

The hook does nothing unless the last assistant message contains a completion claim: *all tests
pass*, *tests are passing*, *everything works*, *it works now*, *fixed the bug*, *fixed the issue*,
*build is green*, *build passing*, *verified*, *ready to merge*, *ready to ship*, *ready to
deploy*, *fully working*, *done and tested*.

If it does, the hook reads at most the last 400 lines of the transcript — stopping at the user
message that opened the turn — looking for a `Bash` call matching a verification pattern: `npm`,
`pnpm`, `yarn`, `mvn`, `gradle`, `cargo` or `make` combined with `test`, `verify`, `check`, `build`,
`lint`, `e2e` or `ci`; or `pytest`, `go test`, `dotnet test`, `ng test`, `bun test`, `node --test`,
`./gradlew`, `./mvnw` or `npx jest|vitest|playwright` on its own. A command that merely echoes,
greps or commits the name of a runner is excluded, and a call whose `tool_result` came back with
`is_error: true` — a failed run, or one the user rejected at the permission prompt — is not
evidence.

```
Foundry gate `verify-before-claiming`: this turn states the work is complete or passing, but no
test, build or lint command completed successfully in it.
Run the project verification command and report its real output — including failures — or restate
the claim as unverified.
```

If the transcript cannot be read, the hook returns no opinion. It never blocks on missing evidence
of evidence.

Disable with `"verifyOnStop": false` in `.foundry/config.json`.

## Contract validation

`PostToolUse` on `Write` and `Edit`. Non-blocking by event type: it returns
`additionalContext`, which the model reads and acts on.

It only inspects `.json` files under `.foundry/blackboard/`. Four messages, in order of checking:

| Situation | Message |
|---|---|
| Not parseable JSON | `Foundry: <file> is not valid JSON (<error>). Blackboard artifacts must be parseable JSON — rewrite it.` |
| No `schema` field | `Foundry: this blackboard artifact has no \`schema\` field. Every artifact must declare its contract id (e.g. "finding.v1") and \`producedBy\`.` |
| Unknown contract | `Foundry: unknown contract "<id>". Available contracts: adr.v1, compliance-check.v1, …` |
| Fails validation | `Foundry: <file> violates <schema>. Fix it before continuing:` followed by one `- ` line per violation |

Violations are recorded as a `contract_violation` metric; a clean artifact records
`contract_valid`. This is the loop that lets an agent correct itself with no human involved.

## Context injection

### `SessionStart`

Matcher `startup|resume|clear`. Does nothing if `.foundry/` does not exist. Otherwise injects, in
this order: the memory index; the list of runbooks with their triggers and the instruction to
follow rather than improvise; the git branch, the number of uncommitted files and the last commit;
and a closing line telling the model to retrieve full facts through `memory_search` rather than
reading `.foundry/memory/facts/`.

If the assembled context exceeds `indexTokenBudget` — 4000 tokens by default — it is truncated to
`indexTokenBudget * 4` characters (16000 by default) with
`(truncated to protect the session token budget)` appended. The threshold follows the configured
budget rather than a fixed number, so raising `indexTokenBudget` raises it too.

### `UserPromptSubmit`

Skips prompts shorter than 12 characters. Runs a keyword search over facts (at most 5, minimum
score 3) and matches runbook triggers against the prompt text. Injects nothing when neither
matches.

```
## Relevant project memory
- **fact-0004** (decision, high): Persistence layer uses Flyway, not Liquibase
  Chosen for the plain-SQL migration format the team already reads.
These are recorded project facts. If the request contradicts one, say so before acting.

## Runbook applies
- `deploy-production` — Deploy to production. Follow it; do not improvise an alternative path.
```

This is keyword-based and offline by design, because the `UserPromptSubmit` timeout is 30 seconds
and every prompt pays it.

### `PreCompact`

Does not block; it instructs. Compaction summarises the transcript, and anything not written down
as a fact is effectively forgotten.

```
Foundry compaction instruction (auto trigger; project memory holds 16 facts).
Preserve verbatim in the summary, because they cannot be recovered from the code afterwards:
every decision taken in this session and the reasoning behind it; every constraint or convention
agreed; every risk identified; every approach that was tried and rejected, with why it failed.
[...]
```

The channel matters here. `PreCompact` is **not** a member of the `hookSpecificOutput` union, so a
hook that answers with that envelope fails the runtime's schema validation, is marked
`outcome: "error"` and delivers nothing at all — silently, since the JSON itself is well-formed.
The supported channel is plain stdout, which the runtime joins into the custom instructions handed
to the compaction summariser. So this hook writes prose, and it addresses the summariser rather
than the agent.

### `SessionEnd`

Appends one `session_end` metric line with the end reason and session id. `SessionEnd` hooks share
a 1.5-second budget across all plugins, so this does the minimum and never touches the network.

## Environment hooks

Foundry registers none. The `WorktreeCreate` event exists and Foundry deliberately leaves it alone:
a hook there aborts worktree creation on any non-zero exit, which is a heavy failure mode for a
convenience. What that means in practice for worktrees is in
[Orchestration](/foundry/en/concepts/orchestration/).

---

## Overrides

Rule-based gates read `.foundry/overrides.json`, created by `foundry init`:

```json
{
  "_comment": "Each override must state why it exists and when it expires. Expired overrides stop applying.",
  "overrides": [
    { "gate": "git-push-force", "reason": "Rewriting a botched release tag on a private fork", "expires": "2026-09-15" }
  ]
}
```

- `gate` is the rule id from the tables above, or `protected-path`.
- An override with an `expires` date in the past stops applying. It does not need to be removed to
  become inert, but `foundry doctor` will flag it as clutter.
- Using an override records a `gate_override_used` metric with the reason, so the audit trail
  survives the session.

Overridable gate ids: the eight Bash rules, and `protected-path`.

Not overridable per rule: credential detection (fix the value instead), the context firewall
(raise `handoffSummaryTokenBudget`), and `verify-before-claiming` (set `verifyOnStop: false`).

## Turning gates off entirely

| Want | Change |
|---|---|
| Softer Bash gates — prompt instead of deny | `"enforcement": "warn"` |
| No guards at all | `"enforcement": "off"` |
| Keep gates, drop secret scanning | `"secretScan": false` |
| Keep gates, drop the completion check | `"verifyOnStop": false` |
| Different protected paths | replace `protectedPaths` |
| Larger subagent returns | raise `handoffSummaryTokenBudget` |

`enforcement: off` disables all four guards. `warn` softens only the Bash rules; it does not
switch off the completion check or the context firewall, because those have their own settings and
a level called "warn" should not silently disable a gate whose own flag says it is on. Context
injection, contract validation and metrics are unaffected by `enforcement` and always run.
