# The surface audit, per surface class

The audit is a procedure, not an impression. Two people running it on the same person on the same
day should produce the same table, and the same person running it six months later should produce
a diff. Everything below is written so that both hold.

## Two passes, and who runs which

The audit is run twice with different instruments. Every recorded row names the pass it came from,
because they answer different questions and neither substitutes for the other.

**Pass A — what you run, in session.**

1. `WebSearch` every query in the set below. Record up to ten results per query: rank, title, URL,
   and whether the person controls that page.
2. `WebFetch` **every** result you record. Do not judge from the snippet — a snippet may not match
   the page currently served. A result you could not fetch is recorded as `NOT FETCHED` with the
   reason, never summarised from its snippet.
3. Where a platform's own search is reachable, run the same queries against it and record those
   rows separately from the web-search rows. Where fetching it is blocked, say so per surface
   rather than inferring what it would have returned.
4. State the instrument's limit in the deliverable: `WebSearch` returns an unpersonalised result
   set that varies by region and by day. It is closer to a stranger's view than a signed-in browser
   and it is not the same thing. Never write "this is what everyone sees".

**Pass B — what the person runs, out of session.** A clean browser profile, no session, no
extensions, no saved history, from the region the audience is in. Same query list, verbatim. They
paste back anything Pass A did not surface. This is the pass that catches personalisation and
region skew, and until it arrives its rows are absent — never estimated, never back-filled from
Pass A.

Record the run date and the exact query strings for both. Without them the next run is a new
opinion rather than a diff.

## The query set

Run all of these, substituting the person's details:

```
"<full name>"
"<full name>" <primary field>
"<full name>" <current employer or best-known project>
"<handle>"                                  # for each handle they have ever published under
<full name> <city>                          # local hiring and meetup audiences search this way
"<distinctive project name>"
"<full name>" <the specific technology the DECISION turns on>
```

Enumerate the handles from the repository rather than from memory:

```bash
git log --all --format='%an <%ae>' | sort -u
git log --all --format='%an' | sort | uniq -c | sort -rn | head
```

## Homonyms and handle collisions

Note every unrelated person or organisation that ranks for the same queries, with their rank. Your
audience meets them first, and a strong homonym changes the recommended action: the fix is a
disambiguating page you own and consistent use of one qualified name, not louder posting.

**Record the collision, not the person.** A homonym did not ask for this audit. One row each —
rank, URL, and "unrelated" — is the whole entry. Do not research them further, do not characterise
them, and do not copy claims, allegations or anything else about them into the deliverable; that
is profiling a third party, which this skill refuses (see the SKILL.md § when not to use this).
Where a collision is severe enough to change the recommendation, the recordable fact is about your
own audit — "queries for `<name>` return an unrelated party above every surface I control, so the
disambiguating page ranks ahead of any profile edit" — and that is sufficient to prioritise the
action without holding a file on anyone.

## What to record per surface class

Each class has a different job, so each has a different failure. Record the same seven columns for
all of them (see the SKILL.md table), and additionally check the class-specific item below.

| Surface class | Its one job | Class-specific check |
|---|---|---|
| Search result you do not control | Sets the first impression before any of your copy is read | Is it accurate, and is it correctable by contacting the owner? |
| Code host profile and pinned set | Prove the work exists and is yours | Does the pinned set argue for the DECISION, or is it whatever was pinned years ago? |
| A site on a domain you own | The canonical record no platform can rank away or revoke | Does every other surface link back to it? |
| Professional network profile | Be legible to people who search by role and keyword | Do the dates and titles match the CV exactly, character for character? |
| Long-form venue | Demonstrate judgement at length | Is the most recent piece still something you would defend? |
| Short-form / social | Distribution only — where people find the artifact | Does the profile link resolve to a current page? |
| Video or recording host | Third-party proof a talk happened | Is the recording reachable without an account? |
| Community forum or Q&A | Durable, linkable proof of helpfulness | Is the account joined to the same identity as the rest? |
| CV / résumé PDF in circulation | The one artifact where dates and titles must be exactly checkable | Which version is actually in circulation, and is it the current one? |

**Never assert how any of these platforms ranks, limits or displays anything.** Those rules change
without notice and are not knowable from this repository. Open the page now, read the current
text, and write `(checked <URL> on YYYY-MM-DD)` next to whatever you concluded from it. A
conclusion inherited from a check older than the person's decision date is re-checked, not reused.

## Staleness, measured rather than felt

For each surface record a last-updated signal and its source:

```bash
gh api users/<login>/repos --paginate \
  --jq '.[] | select(.fork==false) | [.name,.pushed_at] | @tsv' | sort -k2 | head
curl -s -I "<url>" | grep -i '^last-modified'      # often absent; then use dated content on the page
```

A surface is `STALE` when its newest dated content predates the oldest claim it makes. That is a
mechanical test, and it is the test to use — "it feels out of date" is not recordable and does not
diff.

## Contradiction detection

Put the claims from every surface side by side and compare on four axes: **title**, **speciality**,
**employment dates**, **project role**. Any pair that disagrees is a finding, and the resolution is
always to one true version propagated everywhere — never to deleting the weaker surface and hoping
it stops ranking, because a cached or archived copy will outlive the deletion.

## The six-month diff format

Keep every past run in the same file under a dated heading, so the deliverable accumulates:

```
## Audit 2026-08-28 · for: hiring · queries: <verbatim list>
| # | surface | URL | mine? | last updated | claims | verdict |
...
### Changes since 2026-02-14
- resolved: abandoned profile at <url> now redirects (was rank 2)
- new: talk recording at <url> (rank 6)
- unchanged: contradiction on job title between <a> and <b> — still open, now 6 months old
```

An unchanged finding that survives two consecutive audits is escalated in the next run's action
list, because it is evidence that the action was never small enough to do.
