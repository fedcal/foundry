# CHANGELOG template

Structure follows Keep a Changelog: newest first, one section per released version with its date,
grouped by change type. It is written for **humans upgrading**, not for auditors counting commits.

Rules:
- Entries in the six standard sections are **generated from commits**. Do not hand-edit that
  block; the next generator run will eat your prose.
- Curated prose goes in a `### Highlights` paragraph **above** the generated sections.
- Every breaking change carries a **migration instruction**, not just a description.
- Link every entry to its PR, and to its issue where one exists. During an incident, the changelog
  is the first answer to "what changed?".
- Commit the changelog **before** the tag, so the tag contains it.

---

```markdown
# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [<VERSION>] - <YYYY-MM-DD>

### Highlights

<One short paragraph, written by a human, for someone deciding whether to upgrade today.
What changed, who is affected, how long the upgrade takes. Delete the heading if there is
nothing worth saying - an empty ritual paragraph is worse than none.>

### Removed

- **BREAKING** Removed the `<FIELD>` field from `<ENDPOINT>` responses.
  **Migration:** use `<REPLACEMENT>`, populated since `<VERSION>`. Clients reading `<FIELD>`
  receive `null` from this release and the key disappears entirely in `<FUTURE-VERSION>`.
  ([#<PR>](<URL>))

### Changed

- **BREAKING** `<CONFIG-KEY>` now defaults to `<NEW>` (was `<OLD>`).
  **Migration:** set it explicitly to `<OLD>` in `<CONFIG-FILE>` to keep current behaviour.
  ([#<PR>](<URL>))
- `<COMPONENT>` now `<BEHAVIOUR>`. No action required. ([#<PR>](<URL>))

### Added

- `<FEATURE>` - `<ONE-LINE-DESCRIPTION>`. ([#<PR>](<URL>))

### Deprecated

- `<API>` is deprecated and will be removed in `<TARGET-VERSION>`, no earlier than
  `<YYYY-MM-DD>`. Use `<REPLACEMENT>`. Deprecation is announced here **and** emitted as a
  runtime warning, so nobody discovers it only when it is gone. ([#<PR>](<URL>))

### Fixed

- `<BUG>` - `<WHAT-WAS-WRONG>` `<WHEN-IT-HAPPENED>`. ([#<ISSUE>](<URL>))

### Security

- Fixed `<VULNERABILITY-CLASS>` in `<COMPONENT>`. `<AFFECTED-VERSIONS>` are affected;
  upgrade to `<VERSION>` or apply `<MITIGATION>`. ([<ADVISORY-ID>](<URL>))

### Operational notes

- Migration `<MIGRATION-ID>` is **expand-only** / **destructive** - state which.
- This release is **reversible** / **forward-only** - see the release notes.
- Feature flags introduced: `<FLAG>` (owner `<OWNER>`, removal by `<DATE>`).

[Unreleased]: <REPO-URL>/compare/v<VERSION>...HEAD
[<VERSION>]: <REPO-URL>/compare/v<PREVIOUS>...v<VERSION>
```

---

## Yanking a release

Never delete a tag: deletion breaks every consumer that pinned it and destroys the audit trail.
Publish the next patch and record the yank.

```markdown
## [<BAD-VERSION>] - <YYYY-MM-DD> [YANKED]

**Do not use.** `<WHAT-BREAKS>` under `<CONDITIONS>`. Fixed in `<FIXED-VERSION>`.
Consumers pinned to `<BAD-VERSION>` should upgrade immediately; consumers pinned by digest
are unaffected.
```

Also mark it deprecated in the package registry or container registry so tooling can see it,
not only humans.

---

## Generation

Generate from the commit range, then review before committing:

```bash
LAST=$(git describe --tags --abbrev=0)
git log "$LAST"..HEAD --pretty='- %s ([%h](<REPO-URL>/commit/%H))' --reverse
```

Group by conventional-commit type: `feat:` → Added, `fix:` → Fixed, `!`/`BREAKING CHANGE:` →
Removed or Changed with the **BREAKING** marker, security fixes → Security.

Whatever generator you use, keep two properties:
1. its output is deterministic for a given commit range, so a re-run does not shuffle entries;
2. the sections it owns are clearly delimited, so hand-written content is never inside them.

---

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| "Various bug fixes and improvements" | Tells a reader deciding whether to upgrade precisely nothing |
| A breaking change with no migration instruction | The reader has to reverse-engineer the diff |
| Raw commit subjects dumped verbatim | `fix: pr feedback` is not a changelog entry |
| Changelog written after tagging | The tag does not contain it, so the artefact and its notes disagree |
| Deprecation announced only in the changelog | Nobody reads it; emit a runtime warning too |
| Internal refactors listed under Added | Noise that trains readers to skip the file |
