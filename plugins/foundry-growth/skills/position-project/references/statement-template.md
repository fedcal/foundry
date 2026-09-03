# The positioning statement, with worked examples

## The template

> For **\<audience situation\>** who **\<trigger: what they are doing when the problem bites\>**,
> \<project\> is a **\<category the reader already has a slot for\>** that **\<the change it
> produces\>**. Unlike **\<the nearest real alternative, named\>**, it **\<the differentiating
> property, demonstrable from the repository\>**.

Compress to a single sentence of **≤ 25 words** for public use. The long form above is the working
draft — keep it in `docs/growth/positioning.md` because it is where the compressed sentence is
audited from.

Five slots, five failure modes:

| Slot | Fails when | Fix |
|---|---|---|
| audience situation | it is a demographic ("developers", "startups") | describe what they are doing, with what |
| trigger | it is a permanent state rather than a moment | name the moment the problem becomes urgent |
| category | it is invented ("a positioning intelligence layer") | borrow a category the reader already owns |
| change | it lists features | say what is different for the user afterwards |
| differentiator | it is a non-differentiator (fast, secure, simple) | use a property the alternative genuinely lacks |

## Worked example 1 — bad, and its rewrite

**Bad.** "A powerful, easy-to-use framework that helps teams of all sizes ship better software
faster with best-in-class tooling and an amazing developer experience."

What is wrong, slot by slot: no audience (teams of all sizes is everyone); no trigger; invented
value in "better" and "faster" with no measurement; "powerful", "easy-to-use", "best-in-class" and
"amazing" all fail the inversion test — no project claims the opposite. Substitution test: it is
true of every framework ever published. Evidence test: five load-bearing words, zero pointers.

**Rewrite.** "For a maintainer whose repository holds plugins written by different authors, Foundry
is an asset contract plus a CI validator that fails a pull request when an asset drifts."

Now: the audience is a situation; the category ("contract plus validator") is one the reader
already has; the change is a failing pull request, which is observable; the differentiator is
mechanical enforcement, which either exists in the repository or does not.

The first draft of that rewrite said "eleven plugins". The number was cut, and this is worth
dwelling on because it is the trap this skill is mostly about: it was true when someone wrote it,
it is a decoration rather than a load-bearing word, nothing in the sentence needs it, and the day
a twelfth plugin lands the sentence is quietly wrong everywhere it was copied. A count belongs in
the body next to the command that produces it — `ls plugins/ | wc -l`, with the date — not in a
sentence that outlives the count.

## Worked example 2 — bad, and its rewrite

**Bad.** "The fastest vector database. Trusted by hundreds of teams. 10x cheaper than the
alternatives."

Three separate fabrication risks. "Fastest" is a superiority claim requiring a published benchmark
with method, hardware, dataset, version and date — cut it unless that artifact exists and is
linked. "Trusted by hundreds of teams" is a user count; if nobody counted, it is invented social
proof and is refused outright. "10x cheaper than the alternatives" is a comparative price claim
about named third parties, which goes stale weekly and is the kind of statement that attracts an
advertising-claims complaint — hand the wording to foundry-legal and the figure to
foundry-economics, and until both come back, it does not appear in copy.

**Rewrite.** "A vector store that runs in one process with no cluster to operate, for a team of
fewer than five who need similarity search inside an existing service."

The claim shrank and became checkable. That trade is the point of the skill.

## Worked example 3 — good, and why

"For an engineer who has just been told to make an internal service auditable, this library emits
a signed, append-only event log that a non-engineer can read without database access."

Passes the substitution test: a general logging library does not produce something a non-engineer
reads without database access. Passes the evidence test: signed, append-only and the human-readable
view are all demonstrable by pointing at a file and running a command. Passes the inversion test:
plenty of tools deliberately do not do this.

## Worked example 4 — good under bad conditions (no users, no benchmark)

"An experimental single-file static-site generator for someone who wants their whole build to be
one readable script rather than a dependency tree. No plugins, no ecosystem, no users yet."

Naming the absence — no users yet — costs nothing with the reader who was going to discover it in
a minute anyway, and buys the credibility that carries every other sentence in the document. This
is the smallest honest version of the tactic, and it is the one to prefer.

## The three tests, applied

Run all three and write the result of each into `docs/growth/positioning.md`.

**Substitution.** Replace the project name with each of the two nearest alternatives from the
alternatives table. Read the sentence aloud. If it remains true, the sentence is describing the
category and not the project. Rewrite until both substitutions produce a false statement.

**Evidence.** Underline every load-bearing word. For each, name the row from step 1 or step 2 that
backs it and the file path or command behind that row. A word backed by an `absent` row is
removed. A word backed by an `overstated` row is rewritten to the demonstrable size. There is no
third option, and in particular there is no hedging an unbacked word into "helps you" or
"designed to".

**Inversion.** State the opposite of each adjective. "Insecure by default." "Slow." "Hard to use."
If no competent project would claim the inverse, the adjective differentiates nothing and is
consuming words the differentiator needs.

## Derived formats

All four derive from the one hierarchy, and none may add a claim the hierarchy does not carry.

- **One sentence** — the claim verbatim. Bio line, directory entry, repository description.
- **One paragraph, ≤ 60 words** — claim, then one clause per pillar, then the sharpest non-goal.
- **Three bullets** — the pillars, each ≤ 12 words, each with its proof point available on request.
- **"What it is not"** — the non-goal list verbatim, unsoftened. Publishing it is the single
  cheapest credibility purchase available, and it pre-empts the review that says "I thought it did
  X".
