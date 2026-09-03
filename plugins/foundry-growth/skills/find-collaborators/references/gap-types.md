# Gap-definition worksheet

Fill this in before a single name is looked at. The output is one sentence naming **exactly one**
gap type with a consequence someone else could test. Everything downstream — who you look for,
where the evidence trail runs, what you can honestly offer, and which arrangement fits — is decided
here, which is why getting it wrong is invisible until the collaboration is months old.

## Part 1 — the four gaps, side by side

| | **Skill** | **Capacity** | **Credibility** | **Access** (a.k.a. domain) |
|---|---|---|---|---|
| What is missing | You cannot do the work at all | You can do it; there are not enough hours | The work is fine; nobody believes it yet | A domain, dataset, institution or market you cannot enter |
| Evidence it is the real gap | A named task nobody here can start; a branch abandoned mid-way; an ADR blocked pending expertise | A backlog of tasks you can describe *precisely*, ageing; lead time rising while scope is flat | Silence or rejection despite a working artifact; "who else uses this?"; a submission bounced on standing, not content | You cannot obtain the data, reach the users, or get the meeting, and no amount of your own effort changes that |
| Who it attracts | Specialists who want an interesting problem in their specialty | People who want steady, well-specified work, or a first credit | Recognised people in the field; advisors; co-authors | Insiders with standing in that domain |
| Arrangement that fits | Defined-scope contract, or co-maintainer of one subsystem | Contractor, part-time contributor, paid or credited | Advisor or co-author **with real involvement** | Named partner with an explicit mutual benefit, or an institutional agreement |
| Failure when misdiagnosed | You add capacity and still cannot start | You recruit a specialist who is bored by known work and leaves | You acquire a logo instead of a collaborator — see Part 4 | You buy expertise about a door you still cannot open |
| Trial that tests it | The hardest slice of the missing skill, not the easiest | A representative batch of the actual backlog, timed | A real review or a co-written section, with their name on it | One concrete introduction, dataset request or meeting, with a date |

## Part 2 — the discriminating questions

Run these in order. The first "no" usually names the gap.

1. **If you were given six uninterrupted months and no other duties, could you do this work
   yourself?** No → **skill**. Yes → continue.
2. **Can you write the outstanding tasks down precisely enough that a competent stranger could
   start on Monday?** Yes, and there are too many of them → **capacity**. No → back to 1; you may
   be calling a skill gap a capacity gap because the work is unspecified rather than plentiful.
3. **Does a working artifact already exist that people are declining or ignoring, without naming a
   technical defect?** Yes → **credibility**.
4. **Is there a resource — data, users, a room, a market — that no amount of your own work
   obtains?** Yes → **access**.

Two frequent confusions worth naming:

- **Capacity dressed as skill.** "We need a DevOps person" when what exists is forty small,
  well-understood tasks. The tell is that you can write the tasks down. Hire for the tasks.
- **Credibility dressed as capacity.** "We need more people" when the real blocker is that nobody
  believes the artifact. Adding hours to an unbelieved artifact produces a larger unbelieved
  artifact.

## Part 3 — the sentence

> Without a collaborator who **[the specific capability, stated as something they have already
> done in public]**, **[named path, task or deadline]** **[the measurable consequence]**.

It must fail the following four tests to be finished:

- Could this sentence describe five different projects? Then it is generic. Name the path.
- Does the consequence contain a number or a date? If not, nobody can tell later whether the gap
  closed.
- Is the capability stated as something *already done in public*? "Senior engineer" is not
  searchable; "has shipped and maintained a published design system" is — it names the artifact you
  will look for in Step 4 of the skill.
- Would a candidate reading it understand what they would be walking into, including the
  unattractive part? If not, you will be having that conversation later, with more sunk on both
  sides.

## Part 4 — the honesty constraint specific to the credibility gap

This is the gap most likely to produce something dishonest, so it is fenced hardest.

- **An advisor who does not advise is fabricated social proof.** A name or a logo on a page,
  attached to someone with no actual involvement, is exactly the invented endorsement the skill's
  rule 2 refuses. If they are listed, the document must record what they actually did and when.
- **Never present interest as commitment.** "In talks with" that means one unanswered email is not
  a fact about the project and gets cut, not softened.
- **Never buy standing.** Paid endorsement presented as organic, ghost-written testimonials, and
  co-authorship offered for a name rather than for work are refused here. Where money and
  endorsement meet, a disclosure obligation may apply; naming that possibility is the job, and
  deciding it is `foundry-legal:privacy-engineer`'s.
- **The honest small version wins.** One person who genuinely reviewed the work and will say so in
  their own words outranks five names on a page, and it is the version that survives someone asking
  them about it.

## Part 5 — recording the decision

Write the chosen gap into `docs/growth/collaborators.md` **with the evidence commands and their
output**, and record it as a `decision` fact through the `foundry` MCP tool `memory_write` so the
next wave does not re-open it. Never edit `.foundry/memory/facts/` by hand.

If two gaps are genuinely real, rank them and search for one. A person who closes two gaps at once
exists but cannot be searched for on purpose; you will find them by accident or not at all, and
designing the search around that hope is how you end up with a shortlist of generalists and an
unclosed gap.
