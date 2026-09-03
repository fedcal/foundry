# Migrating from {{FROM_VERSION}} to {{TO_VERSION}}

<!-- If rollback is impossible after this upgrade, that sentence goes here, in bold,
     before anything else. -->

**Time budget:** about {{TIME_ESTIMATE}} for a typical codebase. Longer if you {{WORSE_IF}}.

## Am I affected?

```bash
{{DETECTION_COMMAND}}
```

No output means nothing below applies to you: upgrade and run your tests.

## Summary of breaking changes

| # | Change | Automatic fix | Section |
|---|---|---|---|
| 1 | {{CHANGE_1}} | {{CODEMOD_1}} | [#1](#1-change_1_anchor) |

## 1. {{CHANGE_1}}

**Why:** {{REASON_1}}

**Before**

```{{LANG}}
{{BEFORE_1}}
```

**After**

```{{LANG}}
{{AFTER_1}}
```

**Mechanical rewrite:** {{REWRITE_1}}

**Where the mechanical rewrite is wrong:** {{REWRITE_CAVEAT_1}}

<!-- Every section needs this line. A migration that claims no caveats has not been tested
     against a real consumer. -->

## Automation

```bash
{{CODEMOD_COMMAND}}   # --dry-run first
```

Known limits: {{CODEMOD_LIMITS}}. Semantic changes are never fully automatable; review the diff.

## Verify the migration is complete

```bash
{{VERIFY_COMMAND}}    # must exit 0 / return no matches
{{TEST_CMD}}
```

{{STARTUP_CHECK_NOTE}}

## Rollback

{{ROLLBACK_STEPS}}

Data written by {{TO_VERSION}} {{ROLLBACK_DATA_NOTE}}.

## Staying on {{FROM_MAJOR}}

{{OLD_LINE_SUPPORT}} — see the supported versions table in [SECURITY.md](../../SECURITY.md).

## Something not covered here?

Open an issue with the `type:docs` label. Gaps in this guide are bugs in this guide.
