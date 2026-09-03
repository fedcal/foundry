# Duplicate detection

## The asymmetry that sets the policy

- A surviving duplicate costs about one minute of grooming per session.
- A wrongly closed issue loses information permanently: the reporter's context, the reproduction
  detail nobody else had, and — worse — the reporter's willingness to file the next one.

Therefore: detect mechanically, **confirm with a human**, never auto-close.

## Signals, in order of reliability

### 1. Explicit reference

Someone already wrote "duplicate of #N", "same as #N", or "see #N". Highest confidence.

```bash
gh issue list --state open --limit 500 --json number,title,body \
| jq -r '.[] | select((.body // "") | test("(?i)(duplicate of|same as|dupe of) *#[0-9]+"))
         | "\(.number)\t\(.title)"'
```

### 2. Shared referenced artifact

Two issues naming the same file path, endpoint, error string, stack frame or `REQ-NNNN`. Very
high precision for bug reports, because two people rarely quote the same stack frame by accident.

```bash
gh issue list --state open --limit 500 --json number,body \
| jq -r '.[] | . as $i | ($i.body // "") | [scan("REQ-[0-9]{4}")][] | "\($i.number)\t\(.)"' \
| sort -k2 | awk '{c[$2]=c[$2]" #"$1} END {for (k in c) if (split(c[k],a," ")>1) print k, c[k]}'
```

### 3. Title similarity

Normalise, then compare token sets.

Normalisation: lowercase → strip punctuation → remove stop words (`the a an of to for in on is
are be with when` and the project's own filler like `bug`, `issue`, `feature request`) → stem
crudely by trimming trailing `s`/`es`/`ing` → sort tokens.

Jaccard similarity = `|A ∩ B| / |A ∪ B|`. Flag pairs at **≥ 0.7**. Below that, precision collapses
and the reviewer stops reading the list, which is the real failure mode.

```bash
gh issue list --state open --limit 500 --json number,title \
| jq -r '.[] | "\(.number)\t\(.title | ascii_downcase | gsub("[^a-z0-9 ]"; "")
         | gsub(" +(the|a|an|of|to|for|in|on|is|are|be|with|when) +"; " "))"' \
| sort -k2
```

Sorted normalised titles put near-identical items adjacent, which is usually enough to spot the
pairs by eye at this scale.

### 4. Reporter-and-window heuristic

Same reporter, same label, within 7 days. Catches accidental resubmits and double-filing from a
support handoff. Low volume, high precision.

### 5. Full-text search before creating anything

The cheapest prevention. Run it before every `gh issue create`:

```bash
gh issue list --state all --search "<3-5 distinctive terms>" --json number,title,state,closedAt
```

Search `--state all`: the most valuable hit is often a **closed** issue explaining why the thing
was not done, which turns a duplicate into a decision record.

## The confirmation protocol

Present each candidate pair as a row a reviewer can decide in seconds:

| Keep | Close | Signal | Evidence | Unique content in the closing issue |
|---|---|---|---|---|
| #204 | #318 | title Jaccard 0.82 | "checkout fails expired card" / "expired cards fail at checkout" | repro on Safari 17, screenshot |
| #150 | #402 | same REQ-0042 + same endpoint | both name `POST /payments/authorise` | none |

Then, on confirmation:

1. **Transfer the unique content first.** Copy the extra reproduction detail, environment, or
   screenshot into the surviving issue. Losing it is the actual cost of deduplication.
2. Cross-link both ways.
3. Close with a reason, never bare.

```bash
gh issue comment 204 --body "Also reported in #318 — adds Safari 17 repro:
<pasted detail>"
gh issue close 318 --reason "not planned" \
  --comment "Duplicate of #204. Safari 17 repro copied across. Reopen if the behaviour differs."
```

## When two issues look identical but are not

Check these before merging — each is a real distinction that similarity scoring erases:

- **Different environments.** Same symptom, different platform or version, often different cause.
- **Different severity for different users.** One is an annoyance, the other blocks a paying
  customer. Keep both; they will be prioritised differently.
- **Symptom vs. cause.** Several symptom reports may share one root cause. Keep the symptom
  issues open and link them to a cause issue — closing them early loses the ability to verify
  that every reporter's case was actually fixed.
- **Recurrence after a fix.** A regression is a new issue, not a reopened duplicate: it has a
  different cause, a different fix and belongs to a different release.

## Prevention beats detection

- Issue **forms** (`.github/ISSUE_TEMPLATE/*.yml`) with required structured fields make
  artifact-based matching far more reliable than prose matching.
- A small, well-known `area:` label set concentrates related issues where people will see them.
- Keep the backlog small. Duplicates are a symptom of a backlog nobody can read; a 900-item
  backlog guarantees them no matter how good the detection is.
