# Changelog entry style

Structure per Keep a Changelog 1.1.0. This file is about the **sentences**, which is where
changelogs actually fail.

## The shape of an entry

`<effect on the user>` — `<reason, if not obvious>` — `<what they must do, if anything>`

The reader is deciding two things: *do I need this release* and *what will break*. Every entry
serves one of those.

## Rewrites

| Commit subject | Changelog entry |
|---|---|
| `fix: handle nil in resolver` | Fixed a crash when a config file contains an empty section; such files now load with defaults instead of exiting 1. |
| `feat: add retry option` | `client.request()` accepts `retries` (default `0`, previous behaviour). Retries use exponential backoff capped at 30 s and are not applied to non-idempotent methods. |
| `perf: optimise parser` | Parsing a 10 MB document is 3.1× faster (2.4 s → 0.77 s, `bench/parse.js`, Node 22, M2). Memory use is unchanged. |
| `refactor!: move utils` | **Breaking:** `@pkg/utils` is now `@pkg/core/utils`. Update your imports; `npx @pkg/codemod v3-imports` does it automatically. |
| `chore: bump deps` | *(no entry — unless a dependency bump fixes a vulnerability, which goes under Security)* |
| `fix: validate email stricter` | **Breaking:** addresses without a top-level domain (`user@localhost`) are now rejected by `validateEmail()`. Pass `{ allowLocal: true }` to keep the old behaviour. |

The last row is the important one: it shipped as `fix:` and it is a major.

## Sections

Use exactly the Keep a Changelog names. Order inside a section: breaking first, then by how many
users are affected.

```markdown
## [2.0.0] - 2026-08-27

### Removed
- **Breaking:** `legacy_mode` config key, deprecated since 1.4.0 (2025-11-02). Use `compat.level`
  instead — see the [migration guide](docs/migration/1.x-to-2.0.md#legacy_mode).

### Changed
- **Breaking:** `parse()` returns `Result` instead of throwing. [Migration](docs/migration/1.x-to-2.0.md#parse).
- Log lines are JSON by default. Set `LOG_FORMAT=text` to restore the previous output.

### Added
- `--watch` on `build`, rebuilding on change in about 120 ms for a 500-file project. Thanks @handle.

### Fixed
- Timestamps in `export --csv` no longer shift by the local UTC offset (#812).

### Security
- Path traversal in the archive extractor, allowing writes outside the destination directory.
  Fixed in 2.0.0 and backported to 1.9.4. GHSA-xxxx-xxxx-xxxx, CVSS 7.5 (high). Reported by @finder.

[2.0.0]: https://github.com/owner/repo/compare/v1.9.3...v2.0.0
```

## Rules

- **Never a raw commit subject.** If an entry begins with `fix:` or `feat:`, it was not written.
- **One entry per user-visible change**, not per commit.
- **No entry with no user-visible effect.** Internal refactors belong in the diff.
- **Numbers for performance claims**, with the benchmark command and the machine.
- **Deprecations name the removal version and date**, not "in a future release".
- **Security entries** carry GHSA id, severity band, patched versions and the advisory link, and
  no exploit detail.
- **Credit contributors** by handle; take them from PR authors and `Co-authored-by:` trailers.
- **No internal identifiers** (private tracker ids, sprint names) that a reader cannot resolve.
- **Unreleased section** at the top during development, converted on release — never invented
  after the fact from memory.

## Length test

A reader should classify the release — safe patch, worth reading, will break me — in under
60 seconds. If yours takes longer, you are describing implementation instead of consequences.
