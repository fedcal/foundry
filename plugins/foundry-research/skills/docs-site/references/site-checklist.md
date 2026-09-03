# Documentation site checklist

Copy this into the audit artifact and fill it in. Every row needs a measurement, not an
impression. `unmeasured` is an acceptable value and is more useful than a guess.

| # | Check | Measurement | Pass condition | Severity if failed | Result |
|---|---|---|---|---|---|
| 1 | Audience coverage | audiences × entry points matrix | no empty row | high | |
| 2 | Quadrant purity | count of pages mixing quadrants; count of empty quadrants | 0 mixed, 0 empty (or justified) | medium | |
| 3 | Navigation depth | max nesting in nav config; sections without a landing page | ≤ 3, and 0 | medium | |
| 4 | Reference generated | count of hand-maintained option/flag/endpoint tables | 0 | critical | |
| 5 | Build strictness | clean-clone build, warnings as errors, no network | exit 0, 0 warnings | high | |
| 6 | Link integrity | link checker exit code | 0 broken internal links | high | |
| 7 | Executable examples | runnable blocks executed / runnable blocks | 100% | high | |
| 8 | Prose gates | prose linter exit code | 0 violations, config committed | medium | |
| 9 | Accessibility | automated WCAG 2.2 AA scan + keyboard pass | 0 automated failures | high | |
| 10 | Search | zero-result query log exists and is reviewed | yes, with a cadence | medium | |
| 11 | Versioning | selector, banner, canonical, migration guide, redirect map | all present | high | |
| 12 | Ownership & freshness | CODEOWNERS coverage %, `last_reviewed` coverage %, stale report | 100%, 100%, scheduled | critical | |

## Commands

### Inventory
```bash
find docs site content -type f \( -name '*.md' -o -name '*.mdx' -o -name '*.rst' -o -name '*.adoc' \) 2>/dev/null | sort
wc -l $(find docs -name '*.md' 2>/dev/null) | sort -n | tail -20
git log -1 --format='%cs' -- docs/
```

### Fossils — pages untouched for a long time
```bash
git ls-files docs/ | while read -r f; do
  printf '%s  %s\n' "$(git log -1 --format='%cs' -- "$f")" "$f"
done | sort | head -40
```

### Orphans — files not referenced by any other file
```bash
for f in $(git ls-files 'docs/**/*.md'); do
  base=$(basename "$f" .md)
  grep -rqlE "\(.*${base}(\.md)?[)#]" docs/ || echo "ORPHAN $f"
done
```

### Hand-maintained reference tables (check 4)
```bash
# markdown tables whose first column looks like a CLI flag or an env var
grep -rlnE '^\|\s*(`?--?[a-z][a-z0-9-]+`?|`[A-Z][A-Z0-9_]{2,}`)\s*\|' docs/ | sort
# hand-written HTTP endpoint tables
grep -rlnE '^\|\s*`?(GET|POST|PUT|PATCH|DELETE)\b' docs/ | sort
```

### Freshness metadata (check 12)
```bash
total=$(git ls-files 'docs/**/*.md' | wc -l)
missing=$(grep -Lr 'last_reviewed:' docs/ --include='*.md' | wc -l)
echo "last_reviewed coverage: $(( (total - missing) * 100 / total ))% ($missing missing)"
grep -Lr 'last_reviewed:' docs/ --include='*.md' | head -40
```

### Ownership coverage (check 12)
```bash
test -f CODEOWNERS || test -f .github/CODEOWNERS || echo "NO CODEOWNERS FILE"
grep -nE '^\s*docs/' CODEOWNERS .github/CODEOWNERS 2>/dev/null
```
List the docs subtrees that no `CODEOWNERS` pattern matches. That list is the finding; a
coverage percentage without the list is not actionable.

### Banned prose (check 8), if no linter is configured yet
```bash
grep -rniE '\b(simply|just |easily|obviously|of course|blazing|seamless|world-class|cutting-edge|click here|read more|and/or|should work)\b' \
  docs/ --include='*.md' | head -60
```
This is a stopgap for measuring the gap, not a replacement for a committed linter config.

### Runnable examples (check 7)
```bash
# total fenced blocks by language
grep -rhoE '^```[a-z]+' docs/ --include='*.md' | sort | uniq -c | sort -rn
# blocks explicitly marked for CI execution — adjust the marker to the project's convention
grep -rc 'test=true' docs/ --include='*.md' | grep -v ':0$' | wc -l
```
Report the ratio. If the project has no execution marker convention, that absence is the
finding, and defining one is a wave-1 task.

## Reading the results

Three failure shapes recur, and each has a different fix:

**The abandoned garden** — high fossil count, orphans, no `CODEOWNERS`, no stale report.
The content is often fine; the ownership is missing. Fix ownership and freshness first
(check 12). Rewriting pages here is wasted work, because they will rot again by the same
mechanism.

**The drifting reference** — hand-maintained flag and endpoint tables (check 4 fails), no
generation step, examples not executed. Readers are being actively misled, which is worse than
missing documentation because it is trusted. This outranks everything else.

**The unbuildable site** — build requires undocumented setup or network access, no preview on
pull requests, contribution path over four clicks. The docs may be correct today and cannot be
corrected tomorrow. Fix the pipeline (checks 5, 6, and the contribution flow) before adding
content.

## Severity assignment

Use the reader's experience, not the effort to fix:

| Severity | The reader … |
|---|---|
| `critical` | is told something false, or cannot find the page at all |
| `high` | wastes significant time or gives up on the task |
| `medium` | is slowed down or has to read twice |
| `low` | notices an inconsistency |
| `info` | would not notice; recorded for the maintainers |

Every finding needs a `failureScenario` describing a real reader hitting the gap: who they
were, what they were trying to do, and what happened instead. A finding without one is a
preference.
