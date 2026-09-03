# Funding types: what each demands, what fits, what disqualifies

**This file deliberately contains no amounts, no equity ranges, no named funds, no named investors
and no deadlines.** Every one of those is specific to a programme and to a moment in time, and
quoting one from memory is the characteristic way a fundraising document becomes wrong without
anyone noticing. Amounts and criteria are fetched from the specific funder's own page at the time
of use and recorded with the date checked, as step 4 of the skill requires.

What this file gives you instead is the part that is structural and does not go stale: what each
kind of money *is*, what it *demands in return*, the shape of project it fits, and the
disqualifiers that should stop you before you spend three months on it.

---

## Reading the table

For each type, four fields:

- **Demands** — what the funder needs from you, beyond a good idea, before they can say yes.
- **Fits** — the shape of project this money is designed for.
- **Disqualifiers** — conditions under which pursuing this type wastes months. One hit is not
  fatal; it must be written down in `readiness.md` and answered, not ignored.
- **Costs you** — the part founders discover afterwards.

---

## Bootstrap / self-funded

**Demands.** Nothing from anyone else — which is why it is the baseline every other option is
compared against, and why step 1 of the skill asks for it explicitly.

**Fits.** Projects whose next milestone is reachable with the time and money already available;
projects whose main constraint is focus rather than capital; anything where the founder's own
learning is a primary goal.

**Disqualifiers.** A genuine, dated hard deadline imposed from outside (a market window you can
evidence, a contractual date, an expiring dataset licence). A required upfront cost that cannot be
staged — hardware, certification, a licence — where staging has actually been tried and failed.

**Costs you.** Time, and the opportunity cost of everything not done. That cost is real and should
appear in step 1 in weeks, so the comparison against raising is honest in both directions.

---

## Revenue / customer-funded

**Demands.** A buyer who will pay before the thing is finished — which means a specific problem, a
specific budget holder, and a scope small enough to deliver. A paid pilot is the cheapest possible
validation and the strongest possible evidence row for any later raise.

**Fits.** Tools with an identifiable commercial user; consulting-adjacent products; anything where
the first ten users are reachable by name.

**Disqualifiers.** The product is genuinely unusable before a large fixed investment. The users are
not the buyers and the buyers are unreachable at this stage. The intended user base cannot pay by
construction (students, researchers with no budget line, hobbyists) — that is a signal to look at
grants, sponsorship or community funding rather than to price harder.

**Costs you.** Early customers shape the roadmap. That is usually good and occasionally fatal;
either way it is a strategic commitment, not free money.

---

## Grant / public funding

**Demands.** Eligibility as defined by the programme's own text — entity type, location, sector,
project stage, consortium composition, co-financing. A work plan expressed in the programme's
vocabulary (work packages, deliverables, milestones). Evidence that the project produces the
*public* outcome the programme exists to buy: research output, open source, regional development,
training, accessibility, climate impact. Reporting capacity after the award.

**Fits.** Research-shaped work; open source and public-good infrastructure; projects with a
non-commercial or pre-commercial phase; work whose value is real but whose payer is diffuse.

**Disqualifiers.** The eligibility text excludes your entity type or location — read it, do not
infer it. The reporting burden exceeds the award's usefulness (this is a judgement, and it is
routinely underestimated). The project must pivot to fit the call: rewriting the project to match a
call is how teams win money for work they did not want to do. No capacity for the administrative
load, which is `foundry-economics:funding-analyst`'s domain and must be resourced before applying.

**Costs you.** Scope becomes contractual. Timelines become contractual. A portion of the team's
capacity moves permanently to reporting.

---

## Angel

**Demands.** A person's belief in you, usually earned before the pitch and often through your
public work rather than the deck. A credible use of funds and a plausible path to a return, stated
without pretending it is certain. Clean ownership and a structure that a later investor will not
have to unpick.

**Fits.** Early projects with a founder whose track record is legible; domains where the angel's own
experience makes them a better judge than a fund would be.

**Disqualifiers.** No existing relationship and no public artifact that could create one — cold
angel outreach on a project with no visible work behind it converts poorly and burns the
introduction. Ownership is unclear, or contributors' rights were never settled. You cannot state
what would make this a bad investment; an angel who hears no risks hears no analysis.

**Costs you.** A relationship with an individual whose money you now hold, and who will be present
for the bad quarters as well as the good ones.

---

## Venture capital

**Demands.** A credible argument that the project can become very large, fast — not merely good,
profitable or beloved. Evidence of a market that is expanding, a mechanism by which growth
compounds, and a team the fund believes can execute at that speed. Every claim will be diligenced;
see `diligence-readiness.md`.

**Fits.** Projects with a large addressable market and a structural reason growth accelerates rather
than staying linear.

**Disqualifiers.** The honest ceiling of the business is a good, sustainable company — that is a
success, and it is not venture-shaped, and saying so is the most useful thing this reference does.
Growth is fundamentally linear in headcount. The founders do not want the obligations that come with
the money. Traction cannot be evidenced at all: the evidence index is nearly all gap rows.

**Costs you.** Dilution, a board, a growth obligation that outranks your own preferences about the
project, and a clock. Optionality is the thing you sell; the money is what you get.

---

## Sponsorship

**Demands.** An audience or an artifact a sponsor wants to be near, described in numbers you have
actually measured. A clear statement of what the sponsor receives and, equally, what they do not
receive — editorial control especially. Disclosure of the sponsorship wherever it appears.

**Fits.** Open source projects with real usage; publications, events, newsletters, podcasts;
maintainers whose work others depend on commercially.

**Disqualifiers.** The audience numbers cannot be evidenced — sponsorship conversations die on this
faster than any other, and inventing a number here is fraud, not marketing. The sponsor's
expectations would compromise the project's independence and no boundary has been agreed in writing.
Disclosure obligations have not been checked: that is `foundry-legal`'s call, not yours.

**Costs you.** An ongoing relationship with expectations, renewal cycles, and a permanent question
about influence that must be answered by visible boundaries.

---

## Corporate / strategic

**Demands.** A named internal champion with a budget and a problem. Alignment with a strategy that
already exists inside the company — you will not create one. Procurement, security review, legal
review, and patience for all three.

**Fits.** Infrastructure a company already depends on; projects that solve a problem the company has
priced; work adjacent to an existing product line.

**Disqualifiers.** No internal champion — a company as an abstraction never buys anything. The
strategic value depends on exclusivity you are not willing to grant. The procurement cycle is longer
than your runway; that is arithmetic, and `foundry-economics` owns the arithmetic.

**Costs you.** Roadmap gravity toward one large partner, and a dependency whose loss is
concentrated rather than diversified.

---

## Community funding (recurring donations, crowdfunding)

**Demands.** People who already benefit and can be reached honestly — usually built by
`build-audience` long before the ask. A concrete statement of what the money sustains. Transparency
about what was received and what it did.

**Fits.** Widely used open source; public-good work with visible beneficiaries; projects with an
existing readership.

**Disqualifiers.** No existing audience — a campaign is a conversion mechanism, not an acquisition
one. The amount needed exceeds what the audience size can plausibly produce, which is arithmetic to
be done before launching, not discovered during. Manufactured scarcity or a fake deadline is being
considered to drive urgency: that is refused outright by the skill's honesty rules.

**Costs you.** A public obligation to report on spending, and a support relationship with every
contributor.

---

## The comparison that actually decides it

Rank the candidate types by a single question: **which demand can this project satisfy today with
evidence it already has?** The type whose demands map onto real rows in `evidence-index.md` is the
type to pursue. A type whose demands map onto gap rows is a type to pursue *later*, after the gaps
are closed — and "later, after we can evidence X" is a `RAISE-LATER` verdict, which is a real
answer, not a deferral.
