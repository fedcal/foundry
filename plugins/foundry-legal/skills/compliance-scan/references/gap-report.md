# Gap report: exposure ranking and structure

> **Automated technical assessment. Not legal advice.**

The artifacts are for machines. The gap report is for the person who has to decide what gets fixed
this sprint. It fails if it is a list sorted by file path, and it fails if it opens with a
reassuring number.

## Ranking

Apply in order. Never reorder for readability.

1. **Status.** `non-compliant` → `partial` → `undetermined`. Compliant and not-applicable do not
   appear in the ranked section; they go in the appendix.
2. **Severity** from the pack: `critical` → `high` → `medium` → `low`.
3. **Prerequisite depth.** A control that invalidates others when missing outranks its dependents.
4. **Remediation cost**, cheapest first among equals — so the top of the report is both severe and
   actionable this week.

### Known prerequisite chains

If the parent is not satisfied, every child is unreliable regardless of its own verdict. Say so
explicitly next to the child.

| Parent | Dependents it invalidates |
|---|---|
| Lawful basis identified per purpose | transparency, retention, subject rights, transfers, DPIA — all of them describe processing that may not be permitted at all |
| Consent gating enforced in code | cookie/tracking controls, marketing controls, ad-tech transfers |
| Data inventory / store enumeration complete | erasure coverage, access coverage, retention coverage, breach scoping |
| AI role and classification determined | every AI transparency, oversight, documentation and evaluation control |
| Conveyance determination (distribution vs SaaS) | every licence obligation, because obligations trigger on conveyance |
| Scope of the accessibility claim | every conformance verdict and the statement itself |
| Vendor/subprocessor list accurate | processor contracts, transfers, breach notification chains |

A `compliant` verdict downstream of an `undetermined` prerequisite is reported as
**conditional**, with the condition named.

## Structure

```markdown
# Compliance gap report — <project> — <YYYY-MM-DD>

Automated technical assessment. Not legal advice. Have a qualified lawyer, DPO or auditor
confirm anything consequential before relying on this document.

## Reliability of this report
- Packs loaded: <ids>. All packs carry lastReviewed: null — no citation has been verified
  against an official text.
- Profile confirmed by: <name/date> | NOT CONFIRMED (draft profile).
- Facts unknown: <list>. Controls depending on them are undetermined, not compliant.
- Scope: <what was assessed> / Excluded: <what was not>.

## Position
| Status | Count |
|---|---|
| non-compliant | n |
| partial | n |
| undetermined | n |
| compliant | n |
| not-applicable | n |
| **total** | **n (== controls loaded)** |

## Ranked gaps
### 1. <controlId> — <instrument> — <status> / <severity>
**Requirement** …
**What we found** … (evidence pointers)
**Gap** …
**Remediation** … (file, mechanism, how it becomes evidenced)
**Blocks** … (dependent controls, if a prerequisite)
**Effort** … (order of magnitude only)

## Open questions blocking assessment
Numbered, each with who must answer it. This section is the real output when the profile is
incomplete — do not bury it.

## Appendix A — compliant controls and their evidence
## Appendix B — not-applicable controls and the deciding fact
```

## Rules for the writing

- **Lead with the weakness of the report itself.** A reader who does not know the packs are
  unverified will misuse the document. Section 2 exists before any result.
- **Never state a total percentage.** "78% compliant" is meaningless when the denominator is a set of
  unverified controls and the numerator includes `not-applicable`. If asked for one, give the status
  table instead and explain why the percentage would mislead.
- **No penalty figures.** Not even a range, not even "up to". No fine amount is asserted anywhere in
  this plugin unless a human supplied it.
- **Undetermined is a result, not a gap in the report.** Present it as "we cannot show this", with
  the question that resolves it. It is frequently the most valuable line in the document.
- **One line per gap in the executive summary, and the summary is three lines long.** If a reader
  only reads three lines, they must be the three most consequential.
- **Effort is an order of magnitude** (hours / days / weeks), never a precise estimate. Estimation
  belongs to a different vertical.

## What the report must never do

| Never | Because |
|---|---|
| Claim the project "is compliant" | Compliance is a legal determination about an organisation, not a technical property of a repository. |
| Present a themed run (`--theme`) as a full assessment | The unrun themes are unknown, not clean. |
| Convert `undetermined` to `compliant` because the team asserted it verbally | An assertion is an `ask:` answer that must be recorded with its source and date, then re-assessed against evidence. |
| Drop a control because it was tedious to assess | Silent false negative. Count of emitted checks must equal count loaded. |
| Recommend which of several legal options to take | Comply / replace / obtain a licence / accept the risk is a business and legal decision. Present the options, not a choice. |
| Reuse a prior report's verdicts without re-deriving code-derivable facts | The diff between runs is often the most useful signal available. |
