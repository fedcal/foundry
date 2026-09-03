# Alternatives analysis, including "do nothing"

The alternative is whatever your audience does today instead of using your project. It is usually
not a competitor, and the analysis fails whenever it only contains competitors.

## The four classes — enumerate at least one of each

1. **Direct substitute.** Another tool aimed at the same job. Find them the way your audience
   would: the package registry for the obvious keyword, the GitHub topic, the "alternatives to"
   pages, the issue threads where someone asks "what do people use for this".
2. **Indirect substitute.** A general tool bent to the job — a spreadsheet, a shell script, a cron
   job, a paid human doing it by hand. This is often the real incumbent and it is nearly always
   cheaper to keep than to replace.
3. **Build it in-house.** For a technical audience this is a live option every time. Its cost is
   the engineer-weeks plus the maintenance nobody costs at decision time.
4. **Do nothing.** Living with the problem. See the rubric below. Omit this row and the document
   is arguing against the wrong opponent.

## Runtime verification — the binding rules

Everything in the table is a fact about the outside world, so nothing in it may come from memory.

- **Fetch now.** Open the alternative's actual page, repository or registry entry in this session
  and read it. Record the exact URL and the date checked as `YYYY-MM-DD`.
- **Never state from recollection**: a price or tier, a feature list, a limit or quota, a licence,
  a maintenance status, a star or download count, a funding round, a roadmap item, a company size.
  All of these change, and a public document that is wrong about a competitor is a correction you
  will be issuing in the competitor's own comment thread.
- **When a fetch is impossible**, write the literal string `unverified — no source fetched` in the
  cell and keep the row. An empty verified table is a working document; a full remembered one is a
  liability.
- **Re-verification has a shelf life.** Anything in this table older than 90 days is stale and must
  be re-fetched before it is quoted in public copy. Put that date in the document.
- **Licence and trademark care.** Do not reproduce a competitor's logo, marketing copy or
  screenshots. Naming a competitor factually is normal; comparative advertising has rules that
  differ by market — that question goes to foundry-legal, not to this table.

## The table

One row per alternative:

| Field | Content |
|---|---|
| name | the alternative as its audience names it |
| class | direct / indirect / in-house / do-nothing |
| source | URL fetched, or `unverified — no source fetched` |
| checked | `YYYY-MM-DD` |
| honest case for it | the steelman — see below |
| when it is the right choice | at least one real scenario where the reader should pick it |
| what it costs the user | effort, money, lock-in, operational burden — qualitative here; figures go to foundry-economics |
| where we differ | one property, demonstrable from step 1 of the skill |
| evidence for that difference | file path, command, or fetched source |

## Steelman before you differentiate

Write the case **for** each alternative before writing the case against it, and write it well
enough that a happy user of that alternative would agree with it. Then name at least one scenario
in which the reader should choose it over your project. A comparison with no such scenario is a
sales sheet, and readers discount all of it, including the true parts.

The differentiation that survives this is worth something. The differentiation that only works
against a strawman collapses on contact with the first person who already uses the strawman — and
that person is disproportionately likely to be the one commenting publicly.

## The do-nothing rubric

Doing nothing wins by default because it costs zero effort, carries zero risk of a new dependency
and requires no one's approval. Score it honestly against these five questions and put the answers
in the document:

1. **How painful is the status quo, and to whom?** Name the person who feels it, not the
   organisation. Pain nobody personally feels does not move.
2. **How often does the pain occur?** A monthly annoyance loses to a daily one regardless of
   severity. State the frequency you actually observed or the fact that you did not observe it.
3. **Is there a forcing event?** An audit, a deadline, an outage, a regulation, a migration, a new
   hire. Without one, most readers stay where they are and the honest positioning acknowledges it
   rather than pretending urgency exists. Manufacturing a deadline or scarcity to supply the
   missing forcing event is refused outright — it is fabricated urgency, and it is the exact
   failure this whole skill exists to prevent.
4. **What does switching cost?** Learning time, migration, integration, the risk of being the only
   person on the team who understands it, and the cost of reversing the decision later.
5. **What is the smallest first step?** If the reader cannot try it in under an hour without
   deleting what they have, do-nothing keeps winning no matter how good the claim is. If the
   smallest step is large, that is a positioning finding, and often a product finding to hand to
   foundry-dev.

If do-nothing wins on this rubric for your stated audience, the positioning document must say so.
The correct response is to change the audience, the scope or the product — not to write more
persuasive copy at a reader who is rationally staying put.

## Using `--against`

`--against <alternative>` forces a named row into the table. Use it for the comparison the user
keeps encountering in the wild, even when you judge it a poor comparison — especially then, since
"we are not really in that category, and here is what we are in" is a positioning answer, and
refusing the comparison in private does not stop the audience from making it in public.

## What this analysis does not decide

Pricing, willingness to pay, market sizing, unit economics and any figure with a currency symbol
belong to **foundry-economics**. Comparative-advertising wording, competitor trademark use and
anything approaching a legal claim belongs to **foundry-legal**. Which features to build in
response to the analysis belongs to **foundry-dev** and **foundry-pmo**. This table produces the
argument; those verticals own the numbers, the wording risk and the roadmap.
