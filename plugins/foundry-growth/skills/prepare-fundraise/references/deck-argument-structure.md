# The deck as an argument, not a template

A deck is a **chain of reasoning** that a sceptical reader walks in order. Each link makes exactly
one claim; that claim is backed by a row in `evidence-index.md` or by an assumption labelled as an
assumption; and the next link is only reachable if the previous one landed.

Templates fail because they hand you eleven boxes to fill, and a box that has nothing true to put
in it gets filled anyway. That is the mechanism by which invented traction enters a deck without
anyone deciding to lie. **A link with no evidence and no labelled assumption is deleted from the
deck.** A shorter chain that holds is stronger than a complete one that breaks at link 5.

This file gives, per link: its **job**, the **one claim** it may make, the **evidence** it needs,
and the **failure mode** — the thing that actually kills that link in a real meeting — plus the
observable symptom that tells you it has already happened.

---

## The chain

```
1 Who and what  →  2 The problem  →  3 Why now  →  4 What exists  →  5 Evidence of use
      →  6 Why this team  →  7 How the money comes back  →  8 The risk you name
      →  9 The ask  →  10 The appendix that proves 1–9
```

Link 7 is written differently for each funding type — a grant reviewer, a sponsor and an equity
investor are asking three different questions there. Everything else is common. See
`funding-type-comparison.md` for what each type demands, and adapt link 7 to it.

---

## Link 1 — who and what

**Job.** Let the reader place the project in one sentence so that everything after it has somewhere
to attach.

**One claim.** "We build X for Y." Nothing else. Not the market, not the vision, not the raise.

**Evidence.** The positioning statement produced by `position-project`. If that file does not
exist, stop and run that skill — you cannot argue for capital before you can state what the thing
is and who it is for.

**Failure mode.** The category-invention opener ("we are building the operating system for …").
The reader cannot place it, so they spend links 2–4 trying to work out what it is instead of
evaluating whether it should exist.

**Symptom.** The first question you are asked is "so, what does it actually do?"

---

## Link 2 — the problem

**Job.** Make the reader believe someone real has this problem today, and that it costs them
something.

**One claim.** A named situation: who hits it, how often, and what they do instead right now.

**Evidence.** The current alternative, described accurately — including "they do nothing", which is
the most common competitor and the one most often left out. Any number here (frequency, cost of the
workaround, size of the affected group) carries an `E-xx` id or is cut. A market-size figure is not
a problem statement and does not substitute for one.

**Failure mode.** The problem is asserted at the level of an industry rather than a person, so it
is unfalsifiable and therefore unpersuasive. Its cousin: a problem statement written backwards from
the product, describing the absence of your feature rather than a difficulty someone has.

**Symptom.** You cannot name three people or organisations who have this problem, without checking.

---

## Link 3 — why now

**Job.** Explain why this is possible or necessary now, and was not three years ago.

**One claim.** One change — a technical capability that became available, a cost that fell, a rule
that changed, a behaviour that shifted — stated with the source that shows it changed and the date.

**Evidence.** A fetched, dated source for the change. If the change is inside your own project (you
built something that did not exist), that is evidence too, and it is `E-xx`-backed.

**Failure mode.** Manufactured urgency. If nothing changed, **say nothing changed** — "this has
been possible for a while and nobody has done it well; here is why we think that is" is a
survivable answer, and it is the truth. An invented inflection collapses on the first probing
question and takes links 2 and 4 down with it, because the reader now suspects everything.

**Symptom.** The "why now" reason would have been equally true five years ago.

---

## Link 4 — what exists

**Job.** Move the reader from "this should exist" to "this does exist".

**One claim.** What is built and working today, in the present tense.

**Evidence.** Something the reader can reach: a URL, a repository, a recording, a demo they can run.
Present tense is reserved for what is running; anything planned is written in the future tense and
labelled as planned, on the same line. Mixing the two tenses is the most common accidental
misrepresentation in a deck and it is caught in the first diligence pass.

**Failure mode.** A roadmap presented as a product. The reader discovers the gap later, and the
discovery reprices everything you said before it.

**Symptom.** The demo requires you to drive it, or to explain what the reader is looking at.

---

## Link 5 — evidence of use

**Job.** Show what happened when the thing met people who are not you.

**One claim.** The strongest statement your evidence index actually supports — and no stronger.

**Evidence.** `E-xx` rows only, each with its measurement date, and each with its unit defined
(what counts as a user, an active user, a customer, a pilot). Absence is stated, not skipped: "we
have not measured retention beyond 30 days" is a legitimate line on a slide and it is far better
than a retention curve nobody produced.

**Failure mode.** The vague quantifier — "several teams", "growing steadily", "strong early
traction". Each one reads as a countable fact that was not counted, and a reader who has seen a
hundred decks reads it as exactly that. The rule from the skill applies here first: where the
evidence does not exist, **the claim is cut, not softened.**

**Symptom.** A sentence on the slide would change meaning if you replaced its adjective with a
number, and you cannot supply the number.

---

## Link 6 — why this team

**Job.** Give a checkable reason these particular people are the ones doing this.

**One claim.** A specific, verifiable fact about the team's relationship to the problem — prior
work that can be read, a domain background that can be confirmed, time already spent.

**Evidence.** Links to artifacts that exist: shipped work, publications, a repository history, a
role that can be verified. `audit-personal-brand` owns building those artifacts; this link only
cites them.

**Failure mode.** Adjectives ("passionate", "world-class", "deeply technical"). They occupy the slot
where a checkable fact should be, and their presence signals that no checkable fact was available.

**Symptom.** The slide would be equally true for a different team working on a different problem.

---

## Link 7 — how the money comes back

**Job.** Answer the question the specific funder type is actually asking. Written differently per
type, and this is where using a generic template does the most damage.

| Funder type | The question this link must answer |
|---|---|
| Grant / public | What public outcome does this produce, and how will it be evidenced and reported? |
| Sponsorship | What does the sponsor get, what do they explicitly not get, and how is the relationship disclosed? |
| Angel / venture | How does this become large enough to matter, and what mechanism makes growth compound? |
| Corporate / strategic | Which existing internal priority does this serve, and who owns that priority? |
| Community / recurring | What does the money sustain, and how is spending reported back? |
| Debt / revenue-based | Out of which receipts is this repaid, and what happens if they do not arrive? |

**Evidence.** Any figure in this link that is a projection is **labelled as a projection** on the
same line, with the assumption it hinges on and the file path of the model it came from. The model
belongs to `foundry-economics:business-case-analyst`; if that model does not exist, this link says
`UNMODELLED` and names the numbers it needs. Do not improvise a financial model in a deck.

**Failure mode.** A revenue curve with no visible assumption, or a grant narrative that describes
commercial upside to a reviewer who is buying a public outcome. Both are answers to a question
nobody asked.

**Symptom.** You cannot state, in one sentence, which single assumption most changes the number.

---

## Link 8 — the risk you name yourself

**Job.** Demonstrate that you have already found the weakest part of your own argument.

**One claim.** The one risk that would most change the decision, stated plainly, with what you are
doing about it and what would tell you it is materialising.

**Evidence.** None required — this link is an act of analysis, not of measurement. But it must name
a risk a diligent reader would independently find, not a decorative one ("we might grow too fast",
"execution risk").

**Failure mode.** Omitting the link. The reader finds the risk anyway, ten minutes later, and now
they are weighing whether you missed it or hid it. Both readings are worse than having said it.

**Symptom.** Your named risk is one you would be comfortable seeing in a press release.

---

## Link 9 — the ask

**Job.** State what is being asked for and what it buys.

**One claim.** The amount or the resource, the period or milestone it funds, and the specific
decision from step 1 of the skill that it unblocks.

**Evidence.** The amount traces to a cost model by file path, or it is marked `UNMODELLED`. The
milestone is the next rung of evidence, not a vague stage name — "we will be able to evidence X,
which we cannot evidence today".

**Failure mode.** An amount with no derivation, which invites the reader to derive it for you and
conclude it was chosen for roundness. Its cousin: an ask that funds "growth" rather than a named
blocked decision.

**Symptom.** The number would look equally plausible one third larger or one third smaller.

---

## Link 10 — the appendix

**Job.** Hold the proof, so links 1–9 can stay short.

**Contents.** The evidence index itself; unit definitions; the raw exports behind every quoted
figure; the assumptions behind every projection; the fetched funder-criteria quotes with their
dates. A reader who wants to check you must be able to, in one step, without asking.

**Failure mode.** Using the appendix as an overflow for material that could not survive in the main
chain. If a claim was cut for lack of evidence, it is cut from the appendix too — it belongs on the
cut list in `data-room.md`, not hidden at the back.

---

## Three tests to run on the finished chain

1. **The backward pass.** Start at link 9 and walk backwards asking "why should I believe that?" of
   each link. Every answer must be the link immediately before it, or an `E-xx` id. If an answer is
   "because it is obvious", that link is unsupported.

2. **The deletion test.** Delete each link in turn and ask whether the argument still reaches the
   ask. A link whose removal changes nothing is decoration and should stay deleted. A link whose
   removal breaks the chain is load-bearing and therefore needs its evidence checked twice.

3. **The source pass.** Extract every number in the deck mechanically and match it against the
   index:

   ```bash
   S=.foundry/scratch/fundraise && mkdir -p "$S"
   grep -hoE '[0-9][0-9,.]*%?' \
     docs/growth/fundraising/deck-outline.md docs/growth/fundraising/narrative.md \
     | sort -u > "$S/figures"
   while read -r n; do
     grep -Fq -- "$n" docs/growth/fundraising/evidence-index.md || echo "UNSOURCED: $n"
   done < "$S/figures"
   ```

   `grep -F` matters: without it a figure such as `1.5` matches `195` in the index and a real
   unsourced number passes. The exit condition is zero `UNSOURCED` lines. Slide numbers and dates
   appear as noise in this output; clear them by eye rather than loosening the grep, because
   loosening it is exactly how a real unsourced figure gets through.

---

## What this file does not cover

Slide design, visual layout, colour and typography; the wording of an email that carries the deck;
the financial model behind link 7 (`foundry-economics:business-case-analyst`); the substantiation
rules that apply to comparative or superiority claims in advertising and investor material, which
are legal questions owned by `foundry-legal`. Flag those; do not resolve them here.
