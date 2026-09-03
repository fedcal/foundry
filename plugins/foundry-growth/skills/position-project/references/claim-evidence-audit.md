# The claim–evidence audit

The last pass before anything is published. Every word that asserts something about quality,
quantity, comparison, adoption, safety or urgency gets a row in an audit table, an evidence
pointer, and a status. The rule the whole audit exists to enforce: **an unbacked word is cut, not
hedged.** Hedging converts a false claim into an unfalsifiable one, which is worse — it survives
review and still misleads the reader.

## Step A — find the words mechanically, not by eye

Reading your own copy for overclaims fails, because you know what you meant. Grep for the triggers
first, then audit what comes back.

```bash
grep -nEi '\b(fastest|fatest|best|leading|only|first|most|#1|world-class|enterprise-grade|best-in-class|state-of-the-art|revolutionary|seamless|effortless|blazing|10x|[0-9]+x)\b' docs/growth/positioning.md
grep -nEi '\b(faster|cheaper|better|simpler|safer|more secure|more reliable|outperforms|beats|unlike (every|all))\b' docs/growth/positioning.md
grep -nEi '\b(trusted by|used by|loved by|thousands|hundreds|[0-9,]+ (users|teams|companies|developers|downloads|stars))\b' docs/growth/positioning.md
grep -nEi '\b(secure|compliant|GDPR|SOC ?2|ISO ?27001|production-ready|battle-tested|zero (downtime|bugs))\b' docs/growth/positioning.md
grep -nEi '\b(limited (time|spots)|only [0-9]+ (left|remaining)|ends (today|soon)|last chance|founding (member|price))\b' docs/growth/positioning.md
grep -nEi '\b(name is (free|available|unused)|trademark(ed)?|no one else uses)\b' docs/growth/positioning.md
```

Every hit becomes a row. Zero hits is a legitimate result and must be recorded as
`0 trigger matches` rather than skipped silently — that record is what makes the audit rerunnable
by someone who does not trust you.

Add by hand anything the grep cannot see: an implied comparison ("finally, a tool that…"), an
implied scale ("teams rely on it"), an implied endorsement (a logo, a screenshot of a chat, a
quoted stranger), and any number without a unit.

## Step B — the audit table

One row per trigger, in `docs/growth/positioning.md`:

| Field | Content |
|---|---|
| word / phrase | verbatim, with the line it appears on |
| kind | comparative / superlative / quantity / adoption / safety / performance / urgency |
| evidence pointer | a repository path, a command whose output can be read, a fetched URL, or a measurement with method and date |
| tier | see the ladder below |
| status | `backed` / `qualified` / `unbacked` |
| resolution | kept verbatim / rewritten to *(exact new wording)* / **cut** |

## Step C — the evidence strength ladder

Strongest to weakest. A claim may only be stated as strongly as its tier allows.

| Tier | Evidence | What it licenses |
|---|---|---|
| 1 | A command in this repository whose output the reader can reproduce (`node scripts/validate-assets.mjs`, a test name, a CI job) | a plain factual statement |
| 2 | A file or artifact in this repository the reader can open (a schema, a benchmark result with method, hardware, version and date) | a plain factual statement, with the artifact linked inline |
| 3 | An external source fetched in this session, with URL and `YYYY-MM-DD` date checked | a statement attributed to that source and dated |
| 4 | A counted list of real named users who consented in writing to be named | an adoption statement with the exact count |
| 5 | Someone's recollection, an unlinked figure, a number whose method is unknown, "everyone knows" | **nothing** — the claim is cut |

Two consequences worth stating plainly. A benchmark without method, hardware, version and date is
tier 5, not tier 2 — the number exists but nothing can be concluded from it. And an adoption
figure that was estimated rather than counted is tier 5 no matter how confident the estimate is.

## Step D — the three statuses

- **`backed`** — tier 1–4 evidence, and the wording does not claim more than the tier supports.
  Keep it, and put the pointer next to it in the published copy, not only in the audit table.
- **`qualified`** — the evidence is real but narrower than the sentence. Rewrite the sentence down
  to the evidence and record the exact new wording. "Faster" with a single-machine benchmark
  becomes "on the benchmark in `bench/README.md`, 2.1× faster than X at n=10⁶, measured
  2026-08-27" — longer, checkable, and it survives the reader who runs it.
- **`unbacked`** — no evidence of any tier. **Cut the word.** Not "arguably", not "designed to be",
  not "built for", not "helps you". Those phrasings are the same claim with the falsifiability
  removed; a reader who checks treats all of them as the original claim, and is right to.

The document does not ship while a single row reads `unbacked`. That is exit criterion 9 of the
skill and it does not degrade to a warning.

## Step E — the refusal list

These are refused outright, in writing, whoever asks and whatever the deadline. Producing one
voids the whole positioning document, because a reader who finds one correctly discounts
everything else in it.

- An invented testimonial, or a real quote attributed to someone who did not consent to it.
- A logo of an organisation that is not a user, or is a user but has not agreed to be named.
- "Trusted by N teams" / "N downloads" / "N stars" where N was not counted from a real list.
- A benchmark number that was not run, or run under conditions not stated.
- A case study, a customer story or a "before/after" that did not happen.
- A deadline, a countdown, a waitlist position or a scarcity claim that is not real.
- A fabricated founding date, team size, funding status or roadmap commitment.
- A comparison against a competitor's numbers taken from memory rather than fetched today.

When asked for one of these, say which item on this list it is, say no, and offer the smallest
honest version instead — the counted four users, the one benchmark you actually ran, the absence
of users stated plainly. The honest version converts worse and it is still the right answer,
because the fabricated version fails at exactly the moment the reader starts to matter.

## Step F — hand-offs, which are mandatory

The audit routes, it does not decide, whenever a row touches one of these.

| Trigger in a row | Owner |
|---|---|
| Any figure with a currency symbol, a price, a saving, an ROI, a break-even, a projection | `foundry-economics:business-case-analyst`, `foundry-economics:cost-engineer` |
| A grant, subsidy or public-funding eligibility statement | `foundry-economics:funding-analyst` |
| A comparative claim naming a competitor; an advertising or endorsement claim; a sponsorship or affiliate disclosure | `foundry-legal` |
| "GDPR-compliant", "SOC 2", "ISO 27001", "certified", "audited", or any named standard asserted as achieved | `foundry-legal` — a compliance status is a `compliance-check.v1` produced by an assessment, never an adjective chosen by a writer |
| Any contact list, mailing list, scraped address or consent question | `foundry-legal` |
| A performance number that has to be measured before it can be quoted | the agent that measures it (e.g. `foundry-quality:performance-engineer`); positioning cites a measurement, it never generates one |

Never write the legal or the financial conclusion inside the positioning document, and never cite
a statute, directive or article number you have not read in this session. Name the question, name
the owner, and leave the claim out of the copy until it comes back.

## Step G — shelf life

Every tier-3 and tier-4 row carries the date it was checked. Anything older than **90 days** is
stale: it may stay in the working document marked `stale`, and it may not appear in public copy
until re-verified. Put the next review date in `docs/growth/positioning.md` and name the owner, or
the audit silently expires and the copy keeps running on it.

## A worked table

| Word | Kind | Evidence pointer | Tier | Status | Resolution |
|---|---|---|---|---|---|
| "the only asset validator that…" | superlative | no search performed | 5 | `unbacked` | **cut** |
| "fails the build on a contract violation" | performance | `node scripts/validate-assets.mjs`, exit 1 path | 1 | `backed` | kept verbatim |
| "used by every plugin in the repository" | quantity | `ls plugins/ \| wc -l` → 12, counted 2026-08-28 | 1 | `backed` | rewritten to *"used by all 12 plugins in this repository (`ls plugins/ \| wc -l`, 2026-08-28)"* — the bare number goes stale, the number plus its command does not |
| "trusted by teams worldwide" | adoption | none; nobody counted | 5 | `unbacked` | **cut** |
| "faster than X" | comparative | one laptop run, no method recorded | 5 | `unbacked` | **cut**; re-run properly or drop the axis |
| "GDPR-compliant" | safety | none; no assessment exists | 5 | `unbacked` | **cut**; handed to `foundry-legal` |
