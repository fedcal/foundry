# The portfolio as evidence

A technology list asserts familiarity. Evidence lets a stranger check it without asking you
anything. This file defines what "checkable" means mechanically, so an entry either passes or does
not.

## The four evidence ranks

Rank each entry, and prefer the highest rank the work permits. The rank goes in the claim ledger's
`evidence kind` column.

1. **Runnable.** A repository that installs and executes from its README on a clean machine, with
   the command written down. Strongest, and the easiest to falsify — which is exactly why it
   convinces.
2. **Readable and judgeable.** A design document, an ADR, a post-mortem, a schema, a proof, a
   review you wrote. Its mechanism is specific: running code shows that a thing works, a document
   shows why it was built that way and what was rejected — which is the only form in which
   reasoning is checkable by a stranger. Whether the audience in question weighs it is not assumed
   here: read what their own job postings, CFPs or grant criteria ask for, and record where you
   read it and on what date.
3. **Third-party record.** A merged pull request in someone else's repository, a published paper, a
   released package, a talk recording, a resolved issue thread. Strong precisely because you could
   not have produced it alone.
4. **A described result with its measurement.** Admissible only with the measurement artifact
   attached: the benchmark script, the before and after numbers, the date, the conditions. Without
   the artifact, the sentence describes the change that was made and stops there — no number.

Anything below rank 4 is not evidence. "I have five years of X" is a duration claim; it is
evidenced by a record of employment or a commit history, not by its own assertion.

## The four questions every entry must answer

In this order, and an entry that fails any of them comes off the portfolio rather than getting
longer:

1. **What problem?** Stated in the reader's terms, not the stack's.
2. **What did *you personally* do?** First-person singular for what you did; "we" for the rest,
   naming the team and linking the record. This is the most checkable sentence on the page, because
   the people most likely to check it are former colleagues.
3. **What was the outcome?** With its measurement artifact, or without a number.
4. **How does a stranger verify it?** A URL that opens without an account.

## The clean-machine check

Do not publish a "run it" link you have not followed yourself, from scratch, on this run:

```bash
tmp=$(mktemp -d) && git clone --depth 1 <url> "$tmp/p" && cd "$tmp/p" || exit 1
# then execute exactly the command the README gives, and record the exit status
```

Record the command and the exit status in the ledger. A README that has never been followed on a
clean machine is a claim, not evidence — the missing environment variable, the unpinned
dependency and the undocumented service are found by the reviewer, at the worst moment.

For non-runnable entries the equivalent check is an HTTP status:

```bash
curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' -L "<url>"
```

Non-2xx, a login wall, or a paywall with no accepted-manuscript copy means the entry is not
verifiable by the stranger, whatever it contains.

## Invisible work: NDA, private repositories, client confidentiality

This is the normal case for employed engineers, and it is where most people either under-sell
themselves into invisibility or over-step an obligation. Both are avoidable.

**What not to do.** Do not describe the confidential system specifically enough to identify it or
to breach the obligation. Do not gesture at it — "I have worked on systems you use every day" — to
imply more than you can show; a reader who cannot check it discounts it entirely, so the sentence
costs credibility and gains nothing. Do not publish sanitised internal code, diagrams or data on
the assumption that renaming makes it yours to publish.

**The route that works**, in order:

1. **Separate the confidential from the transferable.** The system, the data, the customer
   identities and the code are the employer's; exactly which of them, and on what terms, is a
   clause in your contract and not something to infer from how these arrangements usually go. The
   *class of problem* and your general capability are the part that is normally yours to describe
   — but that boundary is a legal question too, and it goes to
   `foundry-legal`, unread by you. Do not interpret the contract and do not reason about whether
   anyone would notice.
2. **Write a general capability statement.** "Worked on high-throughput payment reconciliation in a
   regulated environment" asserts a capability without identifying a system. It is weak evidence on
   its own, and it is honest — so it is a bridge, never the destination.
3. **Rebuild the transferable core in public.** Take the same class of problem, use public or
   synthetic data and code you are free to publish, and build the smallest artifact that
   demonstrates the skill. Prefer the small reproduction to the large story: one is checkable
   without asking you anything and the other is not, and that difference is the whole point of the
   ledger.
4. **Prefer the by-products you already own.** A post-mortem written about a *public* incident, a
   benchmark of a *public* library you had to evaluate anyway, a design write-up of a decision made
   from openly available trade-offs — all are rank 1 or 2 evidence produced from work you already
   did, without touching anything confidential.
5. **Ask for what is releasable.** A specific, narrow request — this blog post, this talk, this
   utility, a written reference — is answerable in a way that "can I write about my work" is not.
   Do not predict the answer, in either direction: you cannot know it without asking, and the ask
   itself is on the record, which is useful whichever way it goes. Route the request through
   whoever actually holds the decision, and where the obligation's scope is the question,
   `foundry-legal`.
6. **Use third-party records that already exist publicly.** A release note that names you, a
   conference programme, a patent, a public changelog entry, a merged upstream fix made during work
   hours. These are already public; linking them breaches nothing.

**What never happens.** Inventing a public artifact to stand in for confidential work; publishing
someone else's code under your own name; claiming a public project's outcomes as your own because
you did something similar privately; naming a client who has not agreed to be named.

## Entries to remove without regret

- A tutorial project indistinguishable from thousands of others, with no decision of yours in it.
- A repository whose last commit predates the claim it supports.
- A dead demo link. It is worse than no link: it proves the page is unmaintained.
- A "coming soon" placeholder. It dates itself and evidences nothing.
- A cloned or forked repository presented as your work.
- Anything you could not answer three follow-up questions about in an interview.
