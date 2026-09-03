# Statement structure and drafting rules

> **Automated technical assessment. Not legal advice.** Several regimes prescribe a template, a form
> or a portal for the statement, and reject free-form text. Confirm the required form before
> publishing, and have a qualified professional review the final wording.

## The nine elements

Every element is mandatory. Anything you cannot fill from evidence is marked `[OPEN — needs X]`, never
invented and never quietly omitted.

### 1. Entity and scope

Name the organisation and state exactly what the statement covers, as an inclusion rule plus an
exclusion list. Both are publishable text.

> This statement applies to the web application at `app.example.com`, including all pages behind
> authentication. It does not apply to the marketing site at `www.example.com`, to documents uploaded
> by users, or to the embedded payment form provided by [third party].

### 2. Conformance status

Use the vocabulary the applicable instrument requires — typically *fully conformant*, *partially
conformant* or *not conformant* — against a named standard, version and level, with the basis stated.

> `app.example.com` is **partially conformant** with WCAG 2.2 level AA. "Partially conformant" means
> that some parts of the content do not fully conform to the standard.

Never write "accessible" or "compliant" as the status. They are not conformance vocabulary and they
claim more than any evidence supports.

### 3. Non-accessible content — itemised

The section that is omitted most often and read first by enforcement bodies. Group by reason:

- **Non-compliance with the standard** — each item with the criterion, what fails, where, and the
  planned remediation date if there is one.
- **Disproportionate burden** — each item with the assessment behind the claim. A claim with no
  assessment is worse than no claim; flag it as `[OPEN]` rather than asserting it.
- **Content outside the scope of the applicable legislation** — each item with the reason.

> **Non-compliance.** Data tables in the reporting section do not have programmatically associated
> headers (WCAG 2.2 SC 1.3.1), affecting `/reports/*`. We plan to fix this by Q1 2027.

"Some content may not be fully accessible" is not an itemisation. Neither is "we are aware of minor
issues". If you cannot itemise, you do not have enough evidence to publish a conformance claim.

### 4. Accessible alternatives

Where content is not accessible, state what alternative exists and how to obtain it — or state
plainly that none exists. Do not imply an alternative you have not verified works.

### 5. Preparation method

Self-assessment or third-party evaluation, who performed it, the method, and the sample. This is where
the coverage fractions from `evidence-classes.md` belong.

> This statement was prepared on 2026-08-27 following a self-assessment carried out by [team] between
> 2026-08-10 and 2026-08-14, using automated testing (axe-core 4.x) across 18 of approximately 340
> pages, manual keyboard and inspection testing on the same sample, and screen reader testing with
> [AT and version] on the primary transactional process.

Naming the sample size is what makes the statement honest. It is also what stops a reader assuming
coverage you do not have.

### 6. Dates

Preparation date and last review date, both explicit. A statement more than a year old, or older than
several releases affecting the surfaces in scope, is stale — and stale is a defect in itself under
several regimes.

### 7. Feedback mechanism

A working address or form, plus a target response time. **Test it and record the test.** State what
someone can request: a report of a barrier, or content in an accessible format.

### 8. Enforcement route

Where the applicable instrument names a body a dissatisfied person may escalate to, name it with its
contact route. If the instrument names none, say what the internal escalation is.

### 9. Required form

Where a regime prescribes a template or a portal, use it. The generic structure above is a fallback
for drafting, not a substitute for a prescribed form.

## Drafting rules

| Rule | Why |
|---|---|
| Plain language, short sentences | The statement is read by the people most affected by barriers. A statement that is hard to read is itself an accessibility failure. |
| The statement page must conform | It is the one page guaranteed to be tested by anyone checking your claim. |
| Never state a percentage of conformance | "97% of criteria pass" is meaningless — conformance is all-or-nothing per criterion at the level, and the number invites a false reading. |
| No forward-looking status | A remediation date belongs in the non-accessible content items, never in the conformance status. |
| No blaming the user's technology | "Best viewed with…" is not a conformance position. |
| Third-party content is still in scope unless excluded, and the exclusion must be stated | Silence implies coverage. |
| Version the statement | Keep prior versions. Being able to show what you claimed and when is what protects you. |

## Conformance report for procurement

A buyer typically wants a per-criterion table, not prose:

| Criterion | Conformance level | Remarks and explanations |
|---|---|---|

Rules that make it credible:

- **Remarks are specific per row.** "Supports" with an empty remarks column tells a buyer nothing and
  experienced buyers treat it as unverified.
- **A report where every row says "Supports" is not credible** and will be tested. If your evidence
  genuinely supports it, say how — that is what the remarks column is for.
- **Include the non-WCAG clauses** the instrument adds: non-web software, documentation, support
  services, hardware. A WCAG-only table does not answer an EN 301 549 or Section 508 request.
- **Date and author** on the report, and the same sample statement as the accessibility statement.
  The two documents must not disagree; a buyer who spots a disagreement will discount both.

## The final pass

After drafting, re-read every verdict against `evidence-classes.md` and ask one question per row:
*what class of evidence supports this, and is it recorded?* Downgrade anything that fails. Do this as
a separate pass, not while drafting — the drafting mindset optimises for a coherent document, and
coherence is exactly what quietly upgrades a claim.
