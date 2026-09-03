# Readiness checklist

Run every check against a **pristine tree**, never the working copy:

```bash
tmp=$(mktemp -d) && git archive HEAD | tar -x -C "$tmp" && echo "$tmp"
```

`git archive HEAD` contains exactly the tracked files at HEAD — no untracked scratch files, no
gitignored config, no local cache. That difference is the whole point: most "it works for me"
launches fail because the maintainer's tree carries something the stranger's does not.

If `git archive HEAD` fails — no commit on the branch, a shallow or partial clone, `tar` rejecting
the stream — the gate has not run. Record the failure and stop; the working copy is not a
substitute, because the difference between the two trees is the thing being measured.

Record for every check: the command, the exit status, the observed output, the date in ISO 8601.
A check whose output was not read in this session is not green — it is unrun.

## Blocking checks

A single RED here produces the verdict **NOT READY — POSTPONE**. There is no aggregate score and
no trading a green check against a red one.

### B1 — the documented install command actually runs

Do not run the command you remember writing. Extract the literal commands from the README and run
those, in `$tmp`:

```bash
awk '/^```/{f=!f; next} f' "$tmp/README.md" | grep -nE '^[[:space:]]*(/plugin|git|node|npm|npx) '
```

The extracted lines are of two kinds and they are verified differently. Sort them before running
anything.

**Shell lines** (`git`, `node`, `npm`, `npx`) run in `$tmp`. **Pass:** exit 0, or the README marks
the line explicitly as illustrative and not executable. **Red:** any non-zero exit, or a
path, flag or file the line names that does not exist at HEAD.

**Claude Code slash commands** (`/plugin marketplace add …`, `/plugin install …`) are not shell
commands and will fail if you pipe them to a shell — running them that way and recording the
failure is a false red, which is as bad as a false green. Verify them by executing them in a
session, and when that is not possible in this run, check statically that what they name resolves:
every plugin id in an `/plugin install <name>@<marketplace>` line appears in
`$tmp/.claude-plugin/marketplace.json`, and every `source` in that file resolves to a directory
containing `.claude-plugin/plugin.json`. Record which of the two verifications you did. **Red:**
the command fails in session, or it installs a plugin id the marketplace file does not contain.

### B2 — a stranger reaches a first result

A person who has never used the project follows `$tmp/README.md` unaided to the first working
output. **Pass:** they arrive, and every stopping point is recorded with a date. **Red:** they do
not arrive, or no walkthrough happened.

If no such person is available, run it yourself in an environment with no project-specific
variables and label the evidence `self-run, not a stranger` in the plan. That label travels with
the evidence; it is not a formality, it is the honest confidence level.

### B3 — the project's own gates pass at HEAD

For this repository, the three checks `CLAUDE.md` declares mandatory before a commit:

```bash
(cd "$tmp" && node scripts/validate-assets.mjs)
(cd "$tmp" && node --test 'plugins/*/test/*.test.mjs')
(cd "$tmp/site" && npm ci && npm run build)
```

**Pass:** all three exit 0. **Red:** any non-zero exit. If the site build cannot run because
`npm ci` has no network, that is RED, not skipped — a launch that points at documentation nobody
verified builds is precisely the failure this gate exists to catch.

### B4 — there is a way to report a problem

```bash
ls "$tmp/.github/ISSUE_TEMPLATE/" "$tmp/SECURITY.md" "$tmp/CODE_OF_CONDUCT.md"
```

**Pass:** at least one issue template exists; every URL in `.github/ISSUE_TEMPLATE/config.yml`
returns a success status when fetched today; `SECURITY.md` names a reporting route; and that
route is recorded in the plan as `route: <address or URL>, confirmed reachable by: <name>, on:
<YYYY-MM-DD>`. The confirmation is a line in the plan or the check is not green — "someone will
see it" is an assumption, and the launch window is the worst time to discover it was wrong.
**Red:** issues are disabled with no stated alternative, a config URL does not resolve, the
security contact is a placeholder, or nobody confirmed the route.

### B5 — the licence and attribution are present and coherent

```bash
ls "$tmp/LICENSE" "$tmp/NOTICE"
grep -h '"license"' "$tmp"/plugins/*/.claude-plugin/plugin.json | sort -u
```

**Pass:** `LICENSE` exists, `NOTICE` exists, and every `plugin.json` declares the same licence the
root `LICENSE` grants — for this repository, `Apache-2.0`. **Red:** missing file, or any manifest
disagreeing with the root licence. Strangers evaluating whether they may use the project stop at
this, and a mismatch discovered publicly during a launch is expensive to correct.

### B6 — the version being announced exists and is coherent

The first two commands read the pristine tree; the third must run in the real repository, because
`$tmp` was extracted from an archive and has no `.git`:

```bash
grep -n '^## ' "$tmp/CHANGELOG.md" | head -5
grep -h '"version"' "$tmp"/plugins/*/.claude-plugin/plugin.json | sort -u
git tag --list --sort=-v:refname | head -5
```

**Pass:** the version named in the announcement has a `CHANGELOG.md` entry, matches the manifests,
is a valid SemVer 2.0.0 version, and the release it points at is already published. **Red:** any
disagreement, a version string SemVer 2.0.0 does not accept, or an announcement scheduled ahead of
the release. Publishing mechanics for this repository are owned by the
`publish-release` runbook — read it with the `foundry` MCP tool `runbook_get`; this check only
verifies the announcement will not point at something that does not exist yet.

### B7 — no unsubstantiated claim is already published

```bash
grep -rniE 'fastest|the only|best[- ]in|used by [0-9]|[0-9]+x (faster|cheaper)|trusted by' \
  "$tmp"/README*.md "$tmp"/site/src/content/docs 2>/dev/null
```

`grep` exits 1 when it finds nothing; that empty result is the pass, not an error. Read the hits
rather than the exit status.

Triage each hit before judging it. A hit counts only when it is a claim this project makes about
itself to a reader; the same words inside a worked example, a quoted fixture or a description of
someone else's constraint do not. Record the triage decision per hit — a check that silently drops
inconvenient hits is worth nothing.

**Pass:** every counted hit has an evidence artifact in the repository, recorded in the step 5
claim ledger. **Red:** any counted hit without one. The pattern is a net, not a definition — a
superiority claim phrased in words it does not match is still a claim, and translated copy
(`README.it.md`, `site/src/content/docs/it/`) carries the same obligation as the English. Fix the source file before the launch, not after somebody
asks for the number in public.

## Non-blocking checks

These do not postpone a launch. Record them, decide explicitly, and note the decision.

- **N1 — the first screenful.** Does `README.md` state who it is for and what it replaces above
  the fold, before installation instructions? Weak framing costs conversion but does not break
  anything.
- **N2 — a demonstrable artifact.** A command a reader can run in under a minute, or a short
  recording. Absent is survivable; fabricated output is not.
- **N3 — response capacity.** Estimate the questions the response window can absorb, against the
  number of maintainers actually available that day.
- **N4 — link integrity.** Every link in `README.md` and in the announcement copy resolves today,
  checked today. Dead links are the most common self-inflicted launch-day embarrassment.
- **N5 — a stated non-goal.** A visible "what this is not" section deflects the most expensive
  category of misdirected first impression.

## What a red gate produces

Not silence, and not a softened green. It produces:

1. `docs/growth/launch-plan.md` opening with **NOT READY — POSTPONE** and the date of the gate.
2. One remediation task per red check, each with the failing command and its output quoted.
3. A re-gate date, and no defended launch date.

Postponement is a result. A launch defended over a red gate spends the audience's single first
impression on a broken first-run path, and that impression does not come back.
