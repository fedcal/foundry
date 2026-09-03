---
title: Gates
description: Every gate with its hook event and what it blocks, how enforcement levels change each one, and the override path through .foundry/overrides.json.
sidebar:
  order: 6
---

A gate is a hook that inspects an action and returns a decision. Every blocking gate names the rule
that fired and what to do instead, because a block with no way forward is just an obstacle.

## Every gate

### Destructive commands — `PreToolUse` on `Bash`

Eight regular expressions against the command string, in `guard-bash.mjs`. Each has an id you can
override.

| Gate id | Matches | Why it blocks |
|---|---|---|
| `rm-recursive-force` | `rm` with both `-r`/`-R` and `-f` in any order or combination | Recursive forced delete. Delete specific paths, or move them to a scratch directory first |
| `git-push-force` | `git push` with `--force` or `-f` — **not** `--force-with-lease` | Force push rewrites shared history. Use `--force-with-lease`, and never on the default branch |
| `git-reset-hard-remote` | `git reset --hard origin/…` or `upstream/…` | Discards every local commit and working change. Stash or branch first |
| `git-clean-force` | `git clean` with `-d`, `-f` or `-x` | Deletes untracked and ignored files, including `.env` files. List them with `git clean -n` first |
| `db-drop` | `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE`, `TRUNCATE TABLE`, case-insensitive | Destructive schema change. Route it through a reviewed migration |
| `chmod-777` | `chmod 777` | World-writable permissions. Grant the narrowest mode that works |
| `curl-pipe-shell` | `curl` or `wget` piped into `sh`, `bash` or `sudo sh` | Executes unreviewed remote code. Download, read, then run |
| `history-rewrite` | `git filter-branch`, `git filter-repo`, `bfg` | Rewrites the whole repository history. Coordinate with every collaborator first |

The block message names the rule, gives the reason, and prints the exact JSON to add to
`.foundry/overrides.json`.

These are pattern matches on the raw command string, not a shell parser. Both directions of
imprecision are real: a destructive command hidden behind a variable, an alias or a heredoc will not
match, and a `DROP TABLE` inside a migration file you happen to `cat` on the command line will.
The gate is a seatbelt, not a sandbox.

### Secrets — `PreToolUse` on `Write`, `Edit`, `NotebookEdit`

Ten detectors in `guard-write.mjs`, run against the content being written.

| Detector | Matches |
|---|---|
| `aws-access-key` | `AKIA` followed by 16 uppercase alphanumerics |
| `aws-secret-key` | `aws_secret_access_key` followed by 40 or more base64 characters — a raw AWS secret has no prefix, so it is only recognisable beside its key name |
| `github-token` | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` followed by 36 or more characters, or `github_pat_` followed by 40 or more |
| `anthropic-key` | `sk-ant-` followed by 20 or more characters |
| `openai-key` | `sk-proj-`, `sk-svcacct-` or `sk-admin-` followed by 20 or more characters, or the legacy `sk-` followed by 32 or more alphanumerics |
| `stripe-key` | `sk_live_`, `sk_test_`, `rk_live_` or `rk_test_` followed by 16 or more characters |
| `slack-token` | `xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, `xoxs-` followed by 10 or more characters |
| `private-key` | A `-----BEGIN … PRIVATE KEY-----` block, including RSA, EC, OPENSSH and PGP |
| `jwt` | Three base64url segments beginning `eyJ` |
| `connection-string` | A `postgres`, `postgresql`, `mysql` or `mongodb` URL with an inline password |

A match denies the write and asks for the value to move to an environment variable or a secret
manager. Three exemptions: files ending `.example`, `.sample` or `.template` are skipped; so is
anything under `foundry-core/hooks/`, so the detectors do not block edits to themselves; and three
credential values that AWS publishes as documentation examples — `AKIAIOSFODNN7EXAMPLE`,
`AKIAI44QH8DHBEXAMPLE` and the matching example secret key — are allowlisted **by value** in
`guard-write.mjs`'s `DOCUMENTED_EXAMPLES`, at any path and in any file. That last exemption exists
so the gate can be documented at all; it is also why those three strings are not usable as a
demonstration that the gate works.

**This gate has no override path.** `guard-write.mjs` does not consult `.foundry/overrides.json`
for secrets. The documented ways past it are to make the placeholder obviously fake — `REDACTED` —
or to use a `.example` file. Setting `secretScan: false` in `.foundry/config.json` turns all ten
detectors off at once, which is a project-wide decision, not a per-write one.

### Protected paths — `PreToolUse` on `Write`, `Edit`, `NotebookEdit`

Paths matching a glob in `protectedPaths` **escalate** rather than deny: you are asked to confirm.
The default set is `.github/workflows/**`, `**/*.lock`, `package-lock.json` and `db/migrations/**`;
each profile ships its own.

The message names the pattern that matched and why the area matters — CI, dependency integrity or
applied migrations.

### Completion claims — `Stop`

`stop-verify.mjs` reads the assistant's final message for claims like "all tests pass", "fixed the
bug", "build is green", "ready to ship", "done and tested". When it finds one, it scans back through
the transcript — at most the last 400 lines, and never past the user message that opened the turn —
for a Bash call running a test, build, lint or E2E command: `npm`, `pnpm`, `yarn`, `mvn`, `gradle`,
`cargo` or `make` combined with `test`, `verify`, `check`, `build`, `lint`, `e2e` or `ci`, or one of
`pytest`, `go test`, `dotnet test`, `ng test`, `bun test`, `node --test`, `./gradlew`, `./mvnw`,
`npx jest|vitest|playwright` on its own. A command that only prints or greps the name of a runner
does not count, and neither does a call whose result came back as an error.

If no such command completed successfully in the turn, the stop is denied:

```
Foundry gate `verify-before-claiming`: this turn states the work is complete or passing,
but no test, build or lint command completed successfully in it.
Run the project verification command and report its real output — including failures —
or restate the claim as unverified.
```

There is no override id. Turn it off with `verifyOnStop: false`. If the transcript cannot be read
at all the gate abstains, on the principle that it should never block on missing evidence of
evidence.

### Subagent returns — `SubagentStop`

`subagent-firewall.mjs` estimates the tokens in the subagent's final message and denies anything
over three times `handoffSummaryTokenBudget` — 900 tokens with the default of 300. The reply must
be the artifact path, a summary within budget, and any blocking question. See
[Orchestration](/foundry/en/concepts/orchestration/).

No override id. Every return is recorded as `subagent_return` in the metrics file whether it passes
or not.

### Contract validation — `PostToolUse` on `Write`, `Edit`

`validate-contract.mjs` validates `.json` files written under `.foundry/blackboard/` against the
contract named in their `schema` field. It is **not a gate**: `PostToolUse` runs after the write, so
the file already exists and the hook returns the violations as context for the agent to act on. It
is listed here because it is the mechanism people expect to be a gate. The blocking path for
contracts is `blackboard_write`, which validates before writing anything. See
[Contracts](/foundry/en/concepts/contracts/).

### Non-blocking hooks

These do not gate anything; they are listed so the hook set is complete.

| Hook | Event | What it does |
|---|---|---|
| `session-start.mjs` | `SessionStart` on `startup`, `resume`, `clear` | Injects the memory index, the runbook list and a one-line git summary. Truncates itself past `indexTokenBudget` (4000 tokens by default) |
| `prompt-context.mjs` | `UserPromptSubmit` | Injects at most 5 matching facts and any triggered runbook. Silent below 12 characters of prompt |
| `precompact-persist.mjs` | `PreCompact` | Asks for unrecorded decisions to be written to memory before the transcript is summarised |
| `session-end.mjs` | `SessionEnd` | Records one telemetry line. All `SessionEnd` hooks share a 1.5 s budget, so it does nothing else |

## What each enforcement level actually does

`enforcement` lives in `.foundry/config.json` and defaults to `gate`. The behaviour is not uniform
across gates, and the differences matter more than the name suggests.

| Gate | `gate` | `warn` | `off` |
|---|---|---|---|
| Bash rules (all eight) | deny | **ask** | no opinion |
| Secret detectors | deny | **deny** | no opinion |
| Protected paths | escalate | escalate | no opinion |
| `verify-before-claiming` | deny | deny (needs `verifyOnStop`) | not run |
| Subagent context firewall | deny | deny | not run |
| Contract validation | reports | reports | reports |

One row is worth reading twice: at `warn`, the secret detectors still hard-deny. Only the Bash
rules soften to a prompt, because a leaked credential is not recoverable by moving fast — it has to
be rotated.

`warn` deliberately does **not** switch off the completion check or the context firewall. Those two
are governed by their own settings, `verifyOnStop` and `handoffSummaryTokenBudget`. An earlier
version tied them to `enforcement === 'gate'`, which meant a project setting `verifyOnStop: true`
alongside `warn` got no verification at all and no indication of it — a configuration that lied.
To turn them off, turn off their own flag, or set `enforcement: off`.

Contract validation never reads `enforcement`, so it reports violations at every level including
`off`.

## Overrides

`.foundry/overrides.json` is created empty by `foundry init`:

```json
{
  "_comment": "Each override must state why it exists and when it expires. Expired overrides stop applying.",
  "overrides": []
}
```

Add an entry naming the gate, the reason and the expiry:

```json
{
  "overrides": [
    {
      "gate": "git-push-force",
      "reason": "Rewriting release/2.3 after a bad rebase; the branch is not shared yet",
      "expires": "2026-09-10"
    },
    {
      "gate": "protected-path",
      "reason": "Migrating every workflow to the new runner image, tracked in #482",
      "expires": "2026-09-03"
    }
  ]
}
```

How they behave:

- The **first** entry whose `gate` matches wins. Duplicate ids after the first are ignored.
- `protected-path` is a single id covering the whole protected set, not one id per pattern.
- An entry whose `expires` is in the past does not apply and the gate fires again as normal. This
  holds for every gate that reads overrides, `protected-path` included.
- Using an override records `gate_override_used`, with your stated reason, in
  `.foundry/metrics/events.jsonl`. Overrides are visible, not invisible.
- An entry with **no** `expires` does not apply either. A permanent override is not expressible,
  which is deliberate: an override that never lapses is a configuration change wearing an
  exception's clothes. Always set a date.

`foundry doctor` fails the check `no expired gate overrides still in the file` and names each stale
`gate`, which is how you find these before they matter.

## What is recorded

Every gate decision writes one line to `.foundry/metrics/events.jsonl`, gitignored:
`gate_blocked` with the gate id and tool, `gate_escalated` with the file, and `gate_override_used`
with the reason. Nothing leaves the machine.

```bash
grep '"kind":"gate_blocked"' .foundry/metrics/events.jsonl | tail -20
```

A gate that fires constantly is telling you something — either about the work, or about a rule that
is wrong for this project. Both are worth acting on.
