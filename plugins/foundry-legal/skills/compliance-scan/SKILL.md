---
name: compliance-scan
description: Run a compliance assessment against pluggable jurisdiction packs. Determines which packs apply from the project profile (data processed, users, sector, deployment geography), runs the compliance engine over every applicable control, emits one compliance-check.v1 artifact per control and produces a gap report ordered by exposure. Use when asked whether a project is compliant with GDPR, the EU AI Act, SOC 2, WCAG or any packaged framework, before a tender or a security questionnaire, or after a material architecture change. Not legal advice.
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
argument-hint: "[--packs eu,it,global-baseline] [--profile path] [--theme privacy|ai|accessibility|licensing] [--dry-run]"
context: fork
agent: foundry-legal:compliance-engine
model: opus
effort: high
metadata:
  foundry.vertical: compliance
  foundry.io: "project + packs/*.json -> compliance-check.v1[] + gap report"
license: Apache-2.0
---

# Compliance scan

> **Automated technical assessment. Not legal advice.** This skill produces a technical opinion
> about whether evidence exists in a repository. It does not determine legal scope, it does not
> assess exposure, and the packs it reads carry `lastReviewed: null` — no citation in them has been
> verified against an official text. Have a qualified lawyer, DPO or auditor confirm anything
> consequential before relying on the output.

## When to use this

- Someone asks "are we compliant with X" and X is covered by a pack.
- A tender, an enterprise security questionnaire or a customer DPA review is imminent.
- The architecture changed materially: a new market, a new data category, an AI feature, a move from
  SaaS to on-prem delivery.
- Quarterly re-baselining, because a compliance position decays with every release.

## When NOT to use this

- You need to know whether a law *applies* to your business. That is a legal determination; this
  skill will return `undetermined` and tell you to ask a professional.
- You need a certification (ISO, SOC 2, CE). This produces evidence, not an attestation.
- You want the finding fixed. This skill is read-only by design; remediation is handed to
  implementation agents.
- The question is about a single domain and you already know which. Go straight to `privacy-review`,
  `licence-audit` or `accessibility-statement` — cheaper and deeper.

## Procedure

### Step 1 — Establish the project profile

The profile drives everything. Read `.foundry/compliance/profile.json` if it exists. If it does not,
build a candidate using the derivation rules in `references/profile-derivation.md` and **stop to have
it confirmed** if you are running interactively.

Three fact families are never derived and must be answered by a human: `markets.*`, `sector.*`,
`org.*`. Without them the scan runs scope-blind and nearly everything returns `undetermined` — which
is the correct outcome, and the report must lead with that fact rather than bury it.

Any fact you cannot evidence is `"unknown"`. Never `false`.

### Step 2 — Select packs

```
--packs given          -> load exactly those, plus global-baseline, plus any hard dependency
--packs omitted        -> global-baseline always; each jurisdiction pack whose markets.* key is true
it requested           -> eu is loaded with it, always
markets.* all unknown  -> load global-baseline only, and say the scan is scope-blind
```

Never load a pack in order to mark its controls `not-applicable`. That manufactures the appearance
of coverage. Either the market is in scope or the pack stays out.

### Step 3 — Validate the packs

Reject and report, rather than guessing, when: `pack.id` differs from the filename; a `controlId`
collides across packs; `theme` or `severity` is outside its enum; `appliesWhen` references a fact
absent from `packs/PACK-FORMAT.md` §4; or `appliesWhen` is empty.

With `--dry-run`, stop here and report validation results, the packs that would load, the controls
that would be in scope, and the controls that would be `undetermined` for want of a profile fact.
This is the cheap way to check a new pack before spending a full scan.

### Step 4 — Run the engine

Delegate to `compliance-engine`. It evaluates `appliesWhen`, gathers evidence per `evidenceHints`,
assigns status on the ladder in `references/evidence-standards.md`, and writes
`compliance-check.v1` artifacts.

For themed controls, the engine delegates further:

| Theme | Delegate |
|---|---|
| `privacy`, `records` | `privacy-engineer` |
| `ai` | `ai-governance-analyst` |
| `licensing` | `licence-analyst` |
| `accessibility` | `accessibility-compliance-analyst` |
| `security` | consume existing `finding.v1` from the security reviewer; do not re-audit |

`--theme` restricts the run to one theme. Use it for iteration; never present a themed run as a
full assessment.

### Step 5 — Emit artifacts

One `compliance-check.v1` per in-scope control, in
`.foundry/blackboard/<wave>/compliance-engine.json`. The count of emitted checks must equal the
count of loaded controls. A dropped control is a silent false negative and fails the run.

Every object carries `disclaimer: "Automated technical assessment. Not legal advice."` verbatim.
`assessedOn` is today's real date from `date -I` — never a date typed from memory.

### Step 6 — Build the gap report

Order by exposure, using the ranking in `references/gap-report.md`:

1. `non-compliant` → `partial` → `undetermined`
2. severity `critical` → `high` → `medium` → `low`
3. prerequisites before dependents (a missing lawful basis invalidates everything downstream)
4. cheapest remediation first among equals

Never order by finding count. Twelve low-severity items do not outrank one missing lawful basis.

The report opens with, in this order: the disclaimer; the statement that all packs are
`lastReviewed: null` and unverified; the profile used, including which facts were `"unknown"`; then
the status counts; then the ranked gaps.

## Output

```
.foundry/blackboard/<wave>/compliance-engine.json   compliance-check.v1[]
.foundry/blackboard/<wave>/<themed-agent>.json      compliance-check.v1[] per delegated theme
.foundry/scratch/<session>/gap-report.md            ranked gap report for humans
```

To the caller: artifact paths, status counts, top three gaps, disclaimer. Nothing else — the
`SubagentStop` firewall rejects a longer reply.

## Exit criteria

- [ ] `controls emitted == controls loaded`, stated as two numbers.
- [ ] Every `compliant` has ≥ 1 evidence entry of kind `file`, `command` or `measurement`.
      Zero `compliant` verdicts rest on documentation alone.
- [ ] Every `not-applicable` names the deciding profile fact.
- [ ] Every `undetermined` names what would resolve it.
- [ ] Every `partial` / `non-compliant` has a non-empty `gap` and `remediation` naming a file or a
      mechanism.
- [ ] Profile recorded in the output, with `"unknown"` facts listed explicitly.
- [ ] All artifacts pass `mcp__plugin_foundry-core_foundry__contract_validate`.
- [ ] Report opens with the disclaimer and the `lastReviewed: null` warning.

## Degradation

| Missing | Behaviour |
|---|---|
| `foundry` MCP server | write artifacts to `.foundry/blackboard/<wave>/` directly and validate against the schema files under `foundry-core/schemas/`; announce the degradation |
| `superpowers` | skip `verification-before-completion` and run the exit criteria manually; say so in the reply |
| A CLI an `evidenceHints` entry needs (`syft`, `npm`, `mvn`) | record the attempt, mark the control `undetermined`, name the missing tool |
| Network access | no external verification is attempted at any point; the scan is offline by design |

## Deliberately not covered

Legal scope determination · exposure and penalty estimation · certification · contract drafting ·
verifying the packs themselves · anything requiring a threshold to be assessed (revenue, headcount,
record counts) · remediation.

## References

- `references/profile-derivation.md` — how each profile fact may and may not be derived
- `references/evidence-standards.md` — the status ladder and what each verdict requires
- `references/gap-report.md` — exposure ranking and report structure
