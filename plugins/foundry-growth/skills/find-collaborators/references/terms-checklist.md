# Collaboration terms: the questions to settle before work starts

These are **questions to answer**, not clauses to sign. What you produce from them is a plain-language
record of what both people understand themselves to have agreed — the thing whose absence causes the
argument that arrives once the work is worth arguing about. It is not a contract, and it must not be
written to look like one.

Every question below is answered in writing before the collaboration scales past the trial.
**"TBD" on any of them is a blocking finding, not a note.** An unanswered question here is not a
gap in paperwork; it is the specific future argument, already scheduled.

## 1. Ownership

- Who owns the output — jointly, split by contribution, or held by one person or entity?
- If jointly: what can either person do with it alone, without asking?
- Does anything either side brings in *already* belong to someone else — an employer, a university,
  a previous client, a funder?
- If the collaboration stops next month, who holds what exists at that moment?

*Prevents:* the argument that starts the day the thing acquires enough value to be worth having.

## 2. Licence and inbound contributions

- Which licence does the work ship under? Read the SPDX License List identifier out of the
  repository rather than remembering it: `ls LICENSE* NOTICE CITATION.cff` and
  `grep -rn --exclude-dir=.git -m1 "SPDX-License-Identifier" . | head`. If nothing comes back, the
  answer is `not declared` — which is itself a finding, not a licence to assume one.
- Are inbound contributions covered by a Developer Certificate of Origin sign-off (`git commit -s`),
  by a CLA, or by nothing decided yet? Record what applies to *this person's* contributions. Which
  of the two the project requires in general is a governance decision and belongs to
  `foundry-oss:governance-architect`. If the DCO's version number is going into the document, fetch
  the current published text and record the date rather than quoting a version from memory.
- Could the licence need to change later — dual licensing, relicensing, a commercial edition — and
  would this collaborator's consent be required for that?
- Does anything being brought in carry an incompatible licence?

*Prevents:* a contribution that cannot be relicensed, shipped, or accepted at all.

## 3. Credit

- Exactly what form: co-author, co-maintainer, a `CITATION.cff` entry, a named CRediT contributor
  role, a byline, a thanks line, or nothing?
- Where does it appear — the repository, the paper, the site, the talk, the release notes?
- Is it permanent, or does it lapse if they stop?
- If the work is published academically, what is the author order, and who decides it?

*Prevents:* the credit dispute, which is about respect, never resolves cleanly, and outlasts the
project.

## 4. Decision rights

- Who decides what? Name the areas, not the people's seniority.
- What is the tiebreak when you genuinely disagree — one person's call in their area, a coin, a
  named third person, or "we don't do it"?
- Which decisions must be joint, without exception?
- Which decisions has one of you already reserved before this conversation (Step 3 of the skill)?

*Prevents:* deadlock on the first genuinely contested call, which arrives sooner than expected.

## 5. Time and commitment

- Hours per week each, stated as a number, for a stated period.
- What happens when the number is not met — a conversation, a re-scope, an end?
- Are there periods already known to be unavailable (a thesis deadline, a release at a day job, a
  planned absence)?
- Response expectation: within a day, within a week, or best-effort?

*Prevents:* the slow, unspoken resentment of two different definitions of "committed".

## 6. Money

- Does any money flow? **Answer this even when the answer is "none"** — especially then.
- If yes: how much, on what trigger, invoiced how, paid within how long?
- If equity or revenue share: on what, vesting on what, and what happens if they leave? The numbers
  themselves belong to `foundry-economics:cost-engineer` and `business-case-analyst`; this record
  only captures what was agreed.
- If none now: is there a future condition under which there would be, and is that condition
  written down or merely hoped?

*Prevents:* the assumption of eventual payment that was never agreed by anyone but the person
holding it.

## 7. Stop-work

- If one person stops for a month — illness, a job, a family situation — does the work pause,
  transfer, or continue without them?
- Who holds the credentials, the domain, the package registry account, the signing key? What happens
  to access if someone is unreachable?
- Is there anything only one person can do, and what is the plan for the week that person is not
  there?

*Prevents:* a project held hostage by an absence nobody planned for, which is a `risk.v1` with
`category: people` the moment it exists.

## 8. Exit

- How does either side leave: how much notice, in what form?
- What do they take, what do they leave, and what do they keep the right to reuse?
- What may either say publicly about the collaboration afterwards?
- Do the credit and licence answers above survive the exit, or lapse with it?

*Prevents:* the exit that damages the project on the way out, and the one that leaves nobody able to
say what happened.

## How to ask these without making it a negotiation

- Ask them **before the trial**, not after. Someone who reacts badly to a direct question about
  ownership will react far worse to the situation the question was about.
- Ask them as *your* uncertainty, not as a test: "I'd rather write down now what happens if one of
  us stops, because I've had that go badly."
- Write the answers down in the same session and share the record. A remembered agreement is not an
  agreement; both people remember the version that suited them.
- Re-open the list whenever the shape changes — money enters, a third person joins, the licence
  moves, someone's availability changes.

## Where this stops and `foundry-legal` starts

The moment any of the following appears, you stop writing and emit a `handoff.v1`, saying plainly
that what exists so far is a shared understanding and not a legal instrument. The first four go to
`foundry-legal:licence-analyst`; the last two go to `foundry-legal:privacy-engineer`:

- The agreement is meant to be **signed**.
- An **employer's IP clause**, a university IP policy, or a funder's terms enter the conversation.
- Anyone wants a **CLA, an NDA, an IP assignment, or a contractor agreement** drafted.
- The question is whether someone is an **employee or a contractor** in their jurisdiction.
- A **contact list containing personal data** exists, or consent for contacting people is in
  question, or a record is to be retained for someone who declined.
- Money plus endorsement meet and a **disclosure obligation** may apply.

Do not draft around any of these, do not produce a "simple version to start with", and do not copy a
template found elsewhere. A document that looks signable and is not reviewed is worse than no
document, because both people will rely on it.
