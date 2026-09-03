# Source ladder, claim records and decay checks

## The ladder

A source's tier caps the confidence any claim resting on it may carry. This is mechanical, not
a matter of judgement.

| Tier | Definition | Examples | Confidence ceiling |
|---|---|---|---|
| **S1** | Primary legal or standards text | the regulation, directive, statute, official register entry, the ISO/IEEE/RFC document itself | high |
| **S2** | Primary practitioner artifact | the actual form, contract template, exported dataset, printed procedure, certification syllabus, recruitment listing enumerating duties | high |
| **S3** | First-party system documentation | vendor manual, published API reference, release notes, changelog from the maintainer | high |
| **S4** | Institutional research or official statistics | national statistics office, regulator report, peer-reviewed paper with published method | medium |
| **S5** | Practitioner testimony | interview, forum thread, mailing list, conference talk by someone who does the job | medium |
| **S6** | Secondary summary | blog post, vendor marketing, listicle, consultancy overview, model-generated text | low |

### Rules the ladder implies

1. **No design constraint rests on S5 or S6 alone.** Promote it or mark it `[UNVERIFIED]`.
2. **Law is read at S1.** A law firm's explainer is S6 regardless of the firm's reputation.
3. **Vendor documentation (S3) is strong about the system and weak about the workflow.** It
   tells you what was built, not what people do with it.
4. **Independence, not count.** Two sources quoting the same press release are one source. Trace
   before you count.
5. **A recruitment listing is S2** when it enumerates duties, and S6 when it is boilerplate.
   Judge by the content, not the genre.
6. **Model-generated text is S6 and is never citable as evidence**, including your own earlier
   summary. Cite what the model cited, after opening it.

## Claim record format

```
id           : c-001
statement    : one sentence, falsifiable, no hedging adverbs
tier         : S1 | S2 | S3 | S4 | S5 | S6
source       : instrument + article, or URL, or "interview: <role>, <organisation>"
published    : YYYY-MM-DD | undated
retrieved    : YYYY-MM-DD
jurisdiction : ISO 3166 code | n/a
confidence   : high | medium | low
verified     : yes | no
contradicts  : c-0NN | none
```

Field notes:

- `statement` must be falsifiable. "The sector is complex" is not a claim. "Filings are due
  within 30 calendar days of the triggering event" is.
- `published: undated` caps confidence at `low`. This is not pedantry: an undated regulatory
  page is a page whose current validity nobody asserts.
- `retrieved` exists because the web is mutable. Without it, a future reader cannot tell whether
  a page changed or you misread it.
- `jurisdiction` is mandatory for anything legal, contractual or fiscal. `n/a` is a decision,
  not a default.
- `verified: yes` requires either a second independent source at S1–S4, or a successful
  reproduction (you opened the form, ran the export, read the source).

## Decay checks

Run all four across the finished claim set before synthesis.

### 1. Stale truth
A claim true on its publication date and false now. Trigger: `published` older than 24 months
in a regulated or fast-moving subject. Action: seek a current confirmation; if none is found,
keep the claim, set `expires`, and record both the original date and the failure to confirm.

### 2. Scope creep
A claim true of one version, one region, one organisation size or one product tier, recorded
without its qualifier. Trigger: the statement contains a universal quantifier the source does
not support. Action: reinstate the qualifier from the source, or drop the claim.

### 3. Jurisdiction drift
A rule from jurisdiction A applied to jurisdiction B because the vocabulary matched. Trigger:
any claim whose `jurisdiction` differs from the sweep's declared scope. Action: mark
out-of-scope explicitly; never generalise a rule across borders.

### 4. Unit switch
Days vs. working days, calendar months vs. 30-day periods, gross vs. net, per-case vs.
per-claimant, ms vs. µs, MB vs. MiB. Trigger: any number without an explicit unit in the source
text. Action: quote the source's unit verbatim inside the statement.

## Contradiction resolution rules

Applied in order, and the rule applied is recorded:

1. **Higher tier wins.**
2. **Equal tier → later `published` wins.**
3. **Equal tier and equal date → both survive**, both `[UNVERIFIED]`, both `confidence: low`,
   with a named person or document that could settle it.

Never apply a fourth rule. In particular, never resolve by which claim suits the product, which
claim came first in the sweep, or which source is better designed.

## Marking unverified claims

Format, used inline in the brief and in the `body` of any emitted `fact.v1`:

```
[UNVERIFIED] Filings must be countersigned by a licensed assessor.
Verify with: the licensing authority's practice note, or any practising assessor.
Blocked because: the authority's guidance page is behind a member login.
```

Three parts, always: the claim, who or what would verify it, and why it is not verified yet.
An `[UNVERIFIED]` marker without a verification route is just a shrug, and it will be silently
dropped by whoever reads the brief next.
