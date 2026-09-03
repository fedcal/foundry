---
name: version-bump
description: Decide the next version from the real diff rather than from the author's intent, generate a human-readable changelog from the commit history, and produce the migration notes a breaking change requires. Use before tagging a release, when reviewing whether a change is breaking, or when a release-please style bot proposes a version you do not trust. Not for publishing, tagging or signing artifacts.
user-invocable: true
argument-hint: "[--from <tag>] [--to HEAD] [--write-changelog]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: governance
  foundry.io: "git diff -> version decision (review.v1) + CHANGELOG + migration guide"
license: Apache-2.0
---

# Version bump from the diff

Commit messages state intent. Intent is frequently wrong: the most damaging breaking changes in
open source ship as `fix:`. This skill computes the version from **what changed**, then reports
the disagreement with what the commits claimed, so commit hygiene improves next cycle.

**Rule:** if you cannot demonstrate a change is non-breaking — with a test, a type check, or a
diff of the public surface — classify it as breaking. Over-bumping costs one integer.

## Step 1 — Establish the baseline

```bash
git fetch --tags --force
PREV=$(git describe --tags --abbrev=0)          # or --from
git log "$PREV"..HEAD --no-merges --format='%h%x09%s'
git diff --stat "$PREV"..HEAD
git log "$PREV"..HEAD --format='%(trailers:key=BREAKING CHANGE,valueonly)' | grep -v '^$'
```

Read the current version from the manifest, not from the tag alone — they drift:
`jq -r .version package.json` · `grep -m1 '^version' pyproject.toml Cargo.toml` ·
`mvn -q help:evaluate -Dexpression=project.version -DforceStdout` · `git describe --tags`.

If the repository has **no tags**, say so: the baseline is the initial commit, the project is
pre-1.0, and the whole comparison is labelled `first release`.

## Step 2 — Diff the public surface

This is the step that separates a real analysis from reading commit messages. Identify the
public surface first — export map, `__all__`, exported symbols, OpenAPI file, CLI parser,
documented config keys — then diff it mechanically where a tool exists:

| Ecosystem | Surface tool |
|---|---|
| TypeScript | `api-extractor run --local` and diff the `.api.md`, or `attw` for packaging shape |
| Python | `griffe check pkg -a "$PREV" -a HEAD`, or diff `__all__` and public signatures |
| Go | `go doc ./...` diff; `gorelease` for the module-level verdict |
| Rust | `cargo public-api diff "$PREV"..HEAD` |
| Java | `japicmp` or `revapi` against the previous artifact |
| HTTP API | `oasdiff breaking old.yaml new.yaml` |
| CLI | diff `--help` output for every subcommand |

When no tool is available, do it by hand and say so:

```bash
git diff "$PREV"..HEAD -- <public paths from CODEOWNERS / the export map>
git diff "$PREV"..HEAD -- '**/openapi*.y*ml' '**/*.proto' '**/schema*.json'
git diff "$PREV"..HEAD -- <config defaults, migration files, CLI parser>
```

Record every removed or renamed public symbol as evidence. A rename is a removal plus an
addition; there is no third option.

## Step 3 — Classify every change

Apply the breaking-change definition in the `release-communicator` agent (structural,
behavioural, performance/resource, and the "not breaking though it feels like it" list). Do not
restate it here — read it, and cite which clause each classification used.

Three checks that catch what a surface diff misses:

1. **Behavioural**: read the diff of validation, defaults, ordering, error types, and
   serialisation. Look specifically for tests that were *changed* rather than added —
   a modified assertion is a behaviour change until proven otherwise:
   ```bash
   git diff "$PREV"..HEAD -- '**/*test*' | grep -E '^-.*(assert|expect|should)' | head -50
   ```
2. **Performance**: run the project's benchmark on both refs if one exists. Two numbers or no
   claim. Default thresholds for "breaking": > 20% p95 regression, > 20% memory, or any change
   in asymptotic complexity on a documented operation.
3. **Packaging**: minimum runtime version, new required peer dependency, dropped platform,
   changed module format (CJS/ESM), changed default export. These break users who never touched
   your API.
   ```bash
   git diff "$PREV"..HEAD -- package.json pyproject.toml go.mod Cargo.toml \
     | grep -E '^[+-].*(engines|python_requires|requires-python|^\+go |rust-version|exports|main|module)'
   ```

## Step 4 — Decide the version

```
breaking present         -> MAJOR   (MINOR while 0.y.z, SemVer 2.0.0 §4)
else feature present     -> MINOR   (§7)
else fix present         -> PATCH   (§6)
else                     -> no release
```

Emit **both**: the version implied by commit metadata (Conventional Commits 1.0.0) and the
version implied by the diff. When they differ, the diff wins, and the disagreement is reported
with the specific commits that were mislabelled — that feedback is half the value of this skill.

Pre-releases follow §9 (`1.2.0-rc.1` < `1.2.0`); never introduce a break between an rc and the
final. Build metadata (§10) is ignored for precedence.

## Step 5 — Changelog

Follow Keep a Changelog 1.1.0: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`,
newest first, ISO 8601 date, comparison link.

Draft, then **rewrite every line** — a generated log is a starting point, never the output:

```bash
git log "$PREV"..HEAD --no-merges --format='%s%x09%h%x09%an' | sort
gh pr list --state merged --search "merged:>=$(git log -1 --format=%cs "$PREV")" \
  --json number,title,author,labels
git log "$PREV"..HEAD --format='%(trailers:key=Co-authored-by,valueonly)' | sort -u
```

Rules (details and worked examples in `references/changelog-style.md`):

- One entry per user-visible change, not per commit; zero user-visible effect ⇒ no entry.
- Effect first, then reason, then the action the reader must take.
- Breaking entries lead their section, start with `**Breaking:**`, carry the one-line migration
  and a link to the guide anchor.
- Credit contributors from PR authorship and `Co-authored-by:` trailers.
- No internal identifiers; no raw commit subjects; no marketing.
- Security entries: GHSA id, severity band, patched versions, advisory link. Never exploit detail.

## Step 6 — Migration notes (majors only)

Render `${CLAUDE_SKILL_DIR}/templates/migration-guide.md` to `docs/migration/<from>-to-<to>.md`.
Every breaking change from Step 3 gets a section; a break with no migration section blocks the
release.

Each section needs all five: a **detection command** the reader runs to know if they are
affected; **before ⇒ after** examples that both compile; the **mechanical rewrite** and the case
it gets wrong; a **verification command**; and the **rollback** statement, including whether
rollback is impossible after a data migration.

## Step 7 — Output contract

Write `review.v1` to `.foundry/blackboard/<wave>/version-bump.json` with
`dimension: "semver"`, `target: "<prev>..<head>"`, one `finding.v1` per classified change:

- `severity`: `critical` for a silent breaking change (no error at the call site — the caller
  gets wrong results), `high` for a loud break, `medium` for behavioural drift, `low`/`info`
  otherwise.
- `standard`: the SemVer clause applied, e.g. `SemVer 2.0.0 §8`.
- `evidence[]`: the surface-diff command and its output, the changed test assertion, the two
  benchmark numbers.
- `failureScenario`: what a real consumer's code does after upgrading without changes.

`metrics`: `{ previous, proposedFromDiff, proposedFromCommits, breaking, features, fixes,
mislabelledCommits }`. `verdict` is `block` when a breaking change has no migration section.

Then hand off to `release-communicator` for the changelog prose, deprecation notices and
advisory publication.

## Exit criteria

- [ ] Baseline tag resolved, or "no tags / first release" stated explicitly.
- [ ] Public surface diffed with a tool, or manually with the paths listed in the report.
- [ ] Changed test assertions inspected and each one explained as intended or breaking.
- [ ] Packaging/runtime-requirement diff inspected.
- [ ] Performance claims carry two measurements and the benchmark command, or no claim is made.
- [ ] Both versions reported (diff vs commits) with the mislabelled commits named.
- [ ] Every breaking change has a changelog entry **and** a migration section.
- [ ] Changelog contains no raw commit subject and no internal identifier.
- [ ] Migration guide has a detection command, a verification command and a rollback statement.
- [ ] `review.v1` validates via `mcp__plugin_foundry-core_foundry__contract_validate`.
- [ ] If `superpowers` is installed, `superpowers:verification-before-completion` was run;
      otherwise this list was walked manually and the report says so.

## What this skill deliberately does not cover

- **Tagging, signing, building or publishing.** No `git tag`, no `npm publish`, no
  `gh release create`. Ops vertical, human credentials.
- **Deciding whether the break is acceptable** — that authority is in `GOVERNANCE.md`; this
  skill states the cost.
- **Writing the code that implements a deprecation shim or a codemod.**
- **Backporting to maintenance branches** — it identifies which lines need one.
- **Registry mechanics**: dist-tags, yanking, staging repositories.
- **Vulnerability scoring or advisory publication** — `security-advisory` and
  `release-communicator`.
- **Marketing release announcements.**

## References

- `templates/migration-guide.md` — the migration document skeleton.
- `references/changelog-style.md` — entry rules with before/after examples.
- Breaking-change definition: the `release-communicator` agent, Step 1.
