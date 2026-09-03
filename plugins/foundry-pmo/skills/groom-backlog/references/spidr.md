# SPIDR — splitting oversized items

Try the patterns in order. The first that yields two **independently valuable or independently
learnable** slices wins. Stop there; do not apply every pattern to every item.

## S — Spike

Split the learning from the building.

**Use when** the estimate ratio `pessimistic / optimistic` ≥ 3, or nobody can name the
verification method, or the item depends on behaviour of a system nobody here has used.

**Shape:**

```
#301  Spike: measure bulk import throughput on 1 M rows (timebox 6 h)
      Deliverable: a note in docs/spikes/ stating rows/sec, memory ceiling, and whether
      streaming is required. NOT production code.
#302  Bulk import of up to 1 M rows  [blocked by #301, re-estimate after]
```

Rules: a spike is **timeboxed** and its deliverable is knowledge. It ends when the box ends, with
whatever was learned. A spike that produces a half-finished feature is not a spike, it is
unreviewed code. Never let a spike carry an estimate for the work that follows — the whole point
is that the estimate does not exist yet.

## P — Path

Split by alternative flows through the same story.

**Use when** the description contains "or", "unless", "except", "if the user has…".

```
Before: "User completes checkout, or is offered retry if the card is declined,
         or is redirected to 3-D Secure step-up."

After:  #310 Checkout succeeds on first authorisation      (happy path)
        #311 Checkout offers retry after a soft decline
        #312 Checkout completes through 3-D Secure step-up
```

Order: happy path first. It proves the pipe end-to-end and every other path reuses it.

## I — Interface

Split by channel or surface.

**Use when** several clients or surfaces consume the same behaviour.

```
#320 Create a refund from the admin web UI
#321 Create a refund via the public API
#322 Create a refund from a bulk CSV upload
```

Watch for the false version of this split: "backend" and "frontend" are not two interfaces, they
are two halves of one. If the slice cannot be demonstrated to a user, it is a task on the parent.

## D — Data

Split by subset of data: types, formats, locales, tenants, volumes.

**Use when** the item says "all", "any", or enumerates formats.

```
Before: "Import product data from any supplier feed."
After:  #330 Import CSV feeds (UTF-8, comma-delimited)
        #331 Import XML feeds
        #332 Import feeds above 100 MB via streaming
        #333 Support non-UTF-8 encodings (latin-1, windows-1252)
```

The first slice must be the one that covers the most real traffic, not the one that is easiest.
Check with data before choosing:

```bash
gh issue list --state all --search "import feed" --json number,title,body | head -c 2000
```

## R — Rules

Split by business rule, one clause at a time.

**Use when** the item embeds a policy with several clauses.

```
Before: "Apply VAT correctly."
After:  #340 Apply the standard rate by billing country
        #341 Apply reduced rates for the listed product categories
        #342 Apply reverse charge for validated EU B2B VAT numbers
        #343 Apply exemptions for registered non-profits
```

Each slice needs its own criteria and, usually, its own test fixtures. This is the pattern most
often skipped, and the one that most often prevents a two-week item.

## Rules that keep splits honest

1. **Independent value or independent learning.** A slice that is only a layer is a checklist
   item on the parent, not an issue.
2. **Own criteria per slice.** If the parent's criteria were copied to every slice, the split was
   cosmetic and the items will all finish at the same time — which is the problem you were
   solving.
3. **Two levels maximum.** Three levels means the parent is a milestone: hand it to the `roadmap`
   skill instead of splitting further.
4. **Close the parent explicitly** as superseded, listing the children, unless the tracker
   supports a real parent/child relation.
5. **Re-estimate after splitting.** The sum of the slices is usually larger than the original
   estimate. That difference was always there; the split revealed it. Report it as a finding, not
   as a regression.

## Anti-patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| Horizontal split (DB / API / UI) | no slice is demonstrable or shippable | vertical slice through all layers |
| Split by developer | ownership, not value | split by rule, path or data |
| Split into "phase 1 / phase 2" with no content | renames the problem | name what is in each phase, or admit it is one item |
| Splitting to hit a size label | items shrink, work does not | if it genuinely cannot split, say so and plan for a long-running item with interim checkpoints |
| Endless slicing | 40 one-hour items, all coupled | stop at two levels; coupling means the boundary is wrong |
