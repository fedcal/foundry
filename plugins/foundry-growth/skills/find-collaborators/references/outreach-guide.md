# Outreach: what gets a reply, and what is refused

One person, one message, written for them. The whole guide reduces to a single test: **if the
message would still make sense with another name at the top, it is not finished.**

## Part 1 — the five lines that get a reply

In this order, because the order is what makes the message readable in fifteen seconds.

1. **Evidence you read their work.** The actual pull request, paper section, talk point or design
   decision, and what you took from it. Not "I love your work", which is a sentence you could have
   written without reading anything — and that is the whole point of the line.
2. **What you are doing**, one concrete line, with a link they can check in thirty seconds. Not a
   pitch. A link that loads and explains itself is worth more than three sentences of description.
3. **The gap, named honestly**, including the unattractive part — no budget, pre-alpha, a licence
   they may dislike. Naming it here costs you the people who would have left anyway.
4. **One small bounded ask.** Fifteen minutes; an opinion on one design choice; a look at one PR; a
   pointer to someone better suited. "Would you like to collaborate?" asks for a decision they have
   no information to make, so the honest answer is silence.
5. **An explicit exit.** "If this isn't for you, no reply needed." This costs nothing and removes
   the social debt that is the actual reason many good messages go unanswered.

## Part 2 — the hard limits, checkable before sending

These are budgets you impose on yourself, not observed laws about how readers behave. Every one of
them is here because it can be checked mechanically before anything is sent, which is the only
property that makes a limit worth stating.

| Limit | Why | How to check |
|---|---|---|
| ≤ 150 words | A message long enough to postpone is a document, and it competes with everything else in the reader's queue | `wc -w` on the draft |
| Exactly one ask | Two asks is zero asks | Count the question marks and the imperatives |
| One named artifact of theirs, with its URL | It is the whole first line, and it is the proof this is not bulk | Every draft contains a URL that is not yours |
| Rewritten per person | See Part 4 | The near-duplicate check below |
| Zero fabricated urgency | No invented deadline, no "closing Friday" that is not true | The claim ledger in the skill's Step 10 |
| Zero fabricated social proof | No uncounted user numbers, no non-user logos, no "several have joined" meaning one maybe | The claim ledger |
| Zero unsubstantiated superiority claims | "Faster than X" requires the benchmark artifact, linked | The claim ledger |

### The near-duplicate check

Each draft is one file in the session scratch directory the skill's Step 6 names —
`.foundry/scratch/<session>/outreach/<handle>.md` — precisely so this check can run. Diff every
pair. **Two drafts that differ only in the name and the evidence line are the same message**, and
sending them is the mass outreach refused in Part 5.

```bash
cd .foundry/scratch/<session>/outreach || exit 1
for a in *.md; do
  for b in *.md; do
    [ "$a" \< "$b" ] || continue
    n=$(diff <(tr -s ' \n' '\n' < "$a") <(tr -s ' \n' '\n' < "$b") | grep -c '^[<>]')
    printf '%4d  %s  %s\n' "$n" "$a" "$b"
  done
done | sort -n | head -20
```

Read the counts. A pair whose differing-token count is in single digits is one message with two
names on it. Rewrite one of them or drop the candidate. `wc -w *.md` in the same directory checks
the 150-word cap on all drafts at once.

## Part 3 — anti-patterns that guarantee silence

- **The compliment with no object.** "Big fan of your work" without naming the work.
- **The wall.** Four paragraphs of context before the ask. If the ask is in paragraph four, it does
  not exist.
- **The unbounded ask.** "Can we jump on a call to explore synergies?" — no scope, no end, no reason
  for them to be the person.
- **The reversed frame.** "This is a great opportunity for you." They will decide that.
- **The manufactured deadline.** Invented scarcity is a lie about a checkable fact, told to someone
  who may well check it, and it is refused on that ground before any question of whether it works.
- **The inflated position.** Numbers nobody counted, a funding round not committed in writing, an
  advisor who has not advised. Every one of these is checkable by the recipient, and once one is
  found to be false the true parts of the message stop counting too.
- **The vanishing exit.** No stated way to decline turns a small request into an obligation, and
  people resolve obligations by not answering.
- **The follow-up that repeats the ask.** Follow up **at most once**, after a stated interval, and
  only with new information — the thing shipped, the paper posted, the question answered. Never a
  third time.
- **The channel hop.** Re-contacting on a second channel to route around a non-answer converts a
  neutral non-reply into a negative impression, permanently. Silence is an answer: record
  `no-reply` and move on.

## Part 4 — verify the person's situation before writing, not after

Everything you believe about a person from an artifact is a fact about the past. Before drafting,
fetch and read in this session: their own current page or profile; the date of their most recent
public activity in the relevant area; and any stated contact preference or boundary. Record each
with `situationChecked: YYYY-MM-DD` and the URL.

Never assert from memory that a person is available, is between jobs, is looking for this kind of
work, works at a particular place, lives in a particular timezone, or would be interested. Where
their own page says they are not open to this, the row closes as `respectedStatedBoundary` and no
message is sent. That is a completed outcome.

## Part 5 — refused by name

These are refused even when the caller argues they are efficient. Efficiency is not the ground of
the refusal: each one either contacts a person through a route they did not open, or sends them a
message written for nobody in particular while claiming otherwise.

- **Scraped or purchased contact lists**, in any form.
- **Addresses harvested from commit metadata**, `git log` output, conference attendee lists,
  membership directories or profile pages, for the purpose of contacting people who did not publish
  them for that.
- **Unsolicited bulk mail.**
- **Mass-automated identical messages**, including a template with merge fields for the name and one
  "personalised" line.
- **Sending to more than a handful of people without per-person rewriting.**
- **Routing around a stated boundary** — a "not looking" line, a "no recruiters" note, a form they
  asked you to use instead.

If the caller has already built such a list, record it in the document as a `risk.v1` with
`category: people` and emit a `handoff.v1` to `foundry-legal:privacy-engineer` — do not use it, and
do not run it in parallel with the honest shortlist "to compare".

The lawfulness questions here are real and are **not yours to answer**: the lawful basis for
processing contact data (GDPR Art. 6), the duty to inform people whose data you did not get from
them (GDPR Art. 14), and the rules on unsolicited communications (Directive 2002/58/EC Art. 13) all
belong to `foundry-legal:privacy-engineer`. Name the instrument, hand it over, do not interpret it
here, and continue with the evidence-derived shortlist.

## Part 6 — the honest trade-off, stated plainly

Where this guide's advice looks weaker than the aggressive version, that is deliberate: it is the
smallest honest version of the tactic, and its ceiling on volume is genuinely lower. Say that out
loud rather than dressing it up.

What you must **not** claim is that five researched messages convert better than five hundred
templated ones. Neither you nor the caller has measured that, and asserting it would be the same
species of unbacked performance claim the rest of this guide refuses to let into a draft. Recommend
the researched version for the reasons you can actually stand behind: every sentence in it is true,
it does not require a contact list you are not entitled to, and it is still available to you the
second time you need it — in a field where the people you want talk to each other.
