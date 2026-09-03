# Diligence readiness: the data room, and the questions

Two halves. **Part A** is the data-room checklist that `docs/growth/fundraising/data-room.md` is
built from — every item gets `HAVE` (with a path or link that resolves), `MISSING`, or
`NOT APPLICABLE` with a reason, and no blanks. **Part B** is the question set rehearsed in
`docs/growth/fundraising/diligence-rehearsal.md`.

The reason to assemble the room before the first conversation is not tidiness. It is that the gaps
you find while assembling it are the same gaps a funder finds later, when finding them is
expensive and when finding them looks like concealment rather than incompleteness.

**Scope boundary, stated once.** Several items below are legal or financial artifacts. This file
tells you whether the item exists and where it lives. It does not tell you what the item should
say. Ownership, licensing, securities and personal-data questions go to `foundry-legal`; the
financial model and unit economics go to `foundry-economics:business-case-analyst` and
`cost-engineer`; grant administration artifacts go to `foundry-economics:funding-analyst`. Marking
an item `MISSING` and routing it is the correct output. Drafting it here is not.

---

## Part A — data-room checklist

Not every item applies to every funding type. `NOT APPLICABLE` is a legitimate state and must carry
its reason; it is `NOT APPLICABLE` that is being audited here, not the absence itself.

### Identity and ownership

- **D-01 Legal entity** — whether one exists, its form and country, or an explicit "no entity yet".
- **D-02 Ownership record** — who owns what, including anything promised verbally and not
  documented. A verbal promise that is not written down is a `MISSING`, not a `HAVE`.
- **D-03 Prior instruments** — any loan, convertible, grant condition, or agreement that constrains
  future funding or ownership.
- **D-04 IP assignment** — who owns the code and the assets, including work written while employed
  elsewhere or by contributors who never signed anything. Route to `foundry-legal`.
- **D-05 Open source licence inventory** — the project's own licence and the obligations inherited
  from dependencies. Route to `foundry-legal:licence-analyst`.
- **D-06 Trademark and name** — whether the name has been checked for conflict. An unchecked name is
  `MISSING`, not `NOT APPLICABLE`.

### The product itself

- **D-07 Working artifact** — the URL, repository or build a stranger can reach without you.
- **D-08 Install or onboarding path** — the documented route from zero to working, verified to run
  in this session, not remembered. `plan-launch` owns the verification procedure.
- **D-09 Architecture and dependency overview** — one document, current. `foundry-research` owns
  writing it; this item only records whether it exists.
- **D-10 Known-issues and roadmap** — the honest version, including what is broken.

### Evidence and measurement

- **D-11 Metrics definitions** — what a user, an active user, a customer, a pilot and a
  conversion mean *here*. A definition produced under questioning reads as a definition chosen to
  flatter; write it before anyone asks.
- **D-12 The evidence index** — `docs/growth/fundraising/evidence-index.md`, with every figure's
  source and measurement date.
- **D-13 Raw exports** — the actual files behind every quoted figure, dated, so a reader can
  recompute rather than trust.
- **D-14 Instrumentation description** — how each figure is collected, what it excludes (bots,
  internal traffic, the team's own usage), and since when.
- **D-15 The cut list** — claims removed for want of evidence, with dates. Keeping this visible is
  a credibility asset, not an embarrassment.

### Commercial

- **D-16 Customer or user agreements** — contracts, terms, any exclusivity already granted.
- **D-17 Revenue record** — invoices issued and paid, if any. "Any" includes zero, stated plainly.
- **D-18 Pipeline** — conversations in progress, each with the other party's real status. Three
  unanswered emails is not a pilot, and calling it one is the misrepresentation most often found.
- **D-19 Pricing** — what is charged and on what basis, or an explicit "not priced yet".
- **D-20 Financial model** — owned by `foundry-economics:business-case-analyst`. Record its path or
  mark `MISSING` and route it; do not rebuild it here.
- **D-21 Cost base and runway inputs** — owned by `foundry-economics:cost-engineer`. Same rule.

### People

- **D-22 Who works on this, and on what basis** — employees, contractors, volunteers, and the
  hours each actually gives.
- **D-23 Advisors** — only those who have agreed in writing, with the date they agreed. Anyone else
  is removed from every artifact.
- **D-24 References** — people willing to be contacted, each with recorded consent to be contacted
  and the date it was given. No consent record, no reference.
- **D-25 Key-person dependency** — what stops if one named person leaves.

### Compliance and risk

- **D-26 Data-protection posture** — what personal data is processed, on what basis, and where.
  Route to `foundry-legal:privacy-engineer`.
- **D-27 Security posture** — what has been tested and by whom, or an honest "nothing formal yet".
- **D-28 Regulatory exposure** — any sector rule, certification or approval the project touches.
  Route to `foundry-legal`.
- **D-29 Outstanding legal questions** — the list raised to `foundry-legal`, each with the date
  raised and either the answer or `BLOCKED`. An unanswered legal question is an item in the room,
  not a footnote.
- **D-30 Grant obligations, if any are already held** — reporting duties and their owner. Route to
  `foundry-economics:funding-analyst`.

**Scoring.** Record `HAVE / MISSING / NOT APPLICABLE` counts in `readiness.md`. There is no target
ratio and no pass mark here: a small pre-entity project legitimately marks a third of this list
`NOT APPLICABLE`. What is audited is that **no item is blank** and that **no item is marked `HAVE`
without a path or link that resolves**.

---

## Part B — the questions

Answer each in writing, in ≤ 5 sentences, in the funder's terms. Every numeric answer cites its
`E-xx` id. Label each answer `SOLID` / `THIN` / `NO ANSWER` and count the labels.

**At least three answers must be an honest "we don't know" or "we don't have that", followed by
what you would do to find out and by when.** A rehearsal in which every answer is strong was
written as marketing. The three-answer floor exists to force the rehearsal to find the real gaps
before the funder does.

The general rule underneath all twenty: **an honest "I don't know, and here is how I'd find out" is
survivable. A confident invention is not** — it is checked, and when it fails it retroactively
devalues every other number you gave, including the true ones.

### The existence questions

- **Q-01 What does the money buy that time does not?**
  Honest structure: name the decision it unblocks and what being twelve months later costs in this
  specific situation. *Evasion cost:* "we'd grow faster" tells the reader you have not modelled the
  alternative, which invites them to model it for you.

- **Q-02 What happens if you raise nothing?**
  There must be an answer that is not "we stop". If the honest answer really is "we stop", say it —
  and understand that it reframes the conversation from investment to rescue.

- **Q-03 Why this kind of money and not another?**
  Show the types you excluded and the demand or disqualifier that excluded each
  (`funding-type-comparison.md`). *Evasion cost:* not having considered the alternatives reads as
  not understanding what this money demands in return.

- **Q-04 Why hasn't this worked yet?**
  Honest structure: what was tried, what was learned, what changed as a result, what would have to
  be true for the next attempt to differ. *Evasion cost:* an answer blaming timing or the market
  while reporting no learning is worse than admitting a mistake outright.

### The evidence questions

- **Q-05 How many users do you have, and what is a user?**
  Give the number, the definition, the source and the date. If the definition is generous, say so
  before being asked. *Evasion cost:* a number whose definition shifts between two slides ends the
  conversation permanently.

- **Q-06 How do you know they came back?**
  Retention by named cohort, or an explicit "we have not measured that yet, here is when we will".
  This is the question at which most evidence indexes run out; plan for it rather than improvising.

- **Q-07 Which of these users would be upset if the project disappeared tomorrow?**
  Answerable by name or not at all. "All of them" is not an answer.

- **Q-08 How did they find you, and is it repeatable?**
  If every user came from one post or one personal network, say that. A non-repeatable channel is a
  fact about the project's stage, not a flaw to conceal.

- **Q-09 Has anyone paid?**
  Invoice count, amount, renewal status — or a clean "no". A paid pilot is the strongest single row
  in an evidence index; an unpaid conversation described as a pilot is the weakest possible line to
  be caught on.

- **Q-10 What do your users actually do with it, and how do you know?**
  Cite instrumentation (D-14) or the conversations you actually had, with dates. Inferred usage
  must be labelled as inferred.

### The argument questions

- **Q-11 Who are the real alternatives, including doing nothing?**
  Name them accurately, including their strengths. *Evasion cost:* a competitor described unfairly
  tells the reader you either have not looked or are willing to misrepresent — and they have often
  spoken to that competitor.

- **Q-12 What stops a larger player from doing this?**
  Acceptable honest answers include "nothing structural; we would be faster and more focused for a
  while". Inventing a moat is checked immediately and is not recoverable.

- **Q-13 What is the biggest risk to this?**
  Name the one a diligent reader would find independently. Naming it yourself is a credibility gain;
  making them find it is a loss twice over.

- **Q-14 What are your projections and what breaks them?**
  Present the single assumption that most changes the answer. The model belongs to
  `foundry-economics`; the argument around it is yours. Never present a projection unlabelled.

- **Q-15 Why this team?**
  A checkable fact, not an adjective. See link 6 in `deck-argument-structure.md`.

### The structural questions

- **Q-16 Who owns the code and the company?**
  Answer from D-02 and D-04. Any unresolved contributor or ex-employer question is disclosed here
  rather than discovered later; discovery converts an administrative problem into a trust problem.

- **Q-17 Who else is in the round, or has said no?**
  Say the truth. Manufactured competing interest is checked between funders who talk to each other
  routinely, and it is unrecoverable. "Nobody yet" is a fact, not a verdict.

- **Q-18 What personal data do you hold, and on what basis?**
  Answer from D-26, and route the substantive question to `foundry-legal:privacy-engineer` rather
  than ruling on it yourself. "We have asked our adviser and are waiting" is a legitimate answer.

- **Q-19 What have you deliberately decided not to do?**
  A project with no exclusions has no strategy. This is where `position-project`'s "what it is NOT"
  is quoted directly.

- **Q-20 What would make you walk away from this?**
  A founder with no answer either has not thought about it or is not being candid. Both readings
  cost you.

---

## How to label an answer

| Label | Meaning |
|---|---|
| `SOLID` | Answered in ≤ 5 sentences, every figure carrying an `E-xx` id, and you would be comfortable if the reader verified every part of it independently. |
| `THIN` | True, but resting on one data point, one conversation, or a figure you would rather not have probed. Write down what would make it solid. |
| `NO ANSWER` | You do not have it. Say so, say what you would do to find out, and give a date. This is a legitimate outcome and it becomes a gap row in the evidence index. |

`NO ANSWER` counts are reported in `readiness.md` and each one becomes a `finding.v1` in the
`review.v1` artifact. They are not a failure of the rehearsal — they are its product.

---

## What an evasive answer actually costs

Diligence is not a quiz; it is a consistency check across the deck, the data room, the references
and the founders' separate accounts of the same events. The cost of an evasion is therefore never
local. A single figure that does not reconcile makes every other figure worth re-checking, and the
reader has neither the time nor the obligation to do that re-checking — so they stop.

This is why the skill's rule is **cut, not soften**. A cut claim costs you one line. A softened
claim keeps the same unsupported assertion in the room with a hedge attached, and it is discovered
at exactly the moment when discovery is most expensive.
