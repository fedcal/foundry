---
title: foundry-legal
description: A compliance engine driven by pluggable jurisdiction packs, plus privacy, AI governance, accessibility conformance and licensing analysis.
sidebar:
  order: 8
---

:::caution[Automated technical assessment. Not legal advice.]
A jurisdiction pack is a machine-readable checklist written by engineers. It is not a statement of
law, it is not exhaustive, and it is not a substitute for a qualified lawyer or a data protection
officer. Every pack in this repository ships with `lastReviewed: null` and an empty `sources`
array, and the engine is required to surface that in every report.
:::

`foundry-legal` separates **data** from **reasoning**. The controls live in JSON packs; the
judgement lives in the agents. Adding a country means dropping one JSON file into `packs/` — no
agent, skill or code change.

## Install

```bash
/plugin install foundry-legal@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- The product processes personal data and nobody has traced where it enters, flows, is stored,
  replicated, logged and deleted.
- An AI feature is being shipped and the organisation's role — provider, deployer, integrator —
  has never been classified.
- An accessibility conformance claim has to be made publicly and someone needs to decide what can
  honestly be claimed from the evidence available.
- Dependency licences have never been inventoried, or a copyleft term may have been triggered.
- You are building for the Italian or European public sector, where the obligations are explicit.

## When not to use it

- Do not use it as a substitute for legal counsel. It produces evidence and gaps, not opinions of
  law.
- Do not use it to claim compliance. Packs only state what must be *shown*; no pack asserts that
  something *is* compliant.
- Technical accessibility testing and fixing belong to `accessibility-engineer` in `foundry-dev`.
  This plugin handles the conformance claim, its scope and its honesty.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `compliance-engine` | Determines which packs apply from the project profile, evaluates each control's `appliesWhen` predicate and emits one `compliance-check.v1` per control. | `opus` | `high` |
| `privacy-engineer` | Data protection by design in the code: traces where personal data enters, flows, is stored, replicated, logged and deleted; maps each purpose to a lawful basis. | `opus` | `high` |
| `ai-governance-analyst` | Classifies the AI system and the organisation's role (provider, deployer, integrator), determines transparency and disclosure duties, verifies human oversight. | `opus` | `high` |
| `accessibility-compliance-analyst` | The legal side of accessibility: the scope of a conformance claim, what may honestly be claimed from the available evidence, drafting the statement. | `opus` | `high` |
| `licence-analyst` | Open-source licence and IP hygiene: the dependency licence inventory, compatibility between permissive, weak copyleft, strong copyleft and network copyleft terms. | `opus` | `high` |

## Skills

| Skill | When it fires |
|---|---|
| `compliance-scan` | Running a compliance assessment against pluggable jurisdiction packs. Determines which packs apply from the project profile — data processed, users, sector, deployment geography. |
| `privacy-review` | A code-level data protection review: where personal data enters, how it flows, where it is stored and replicated, where it is logged, and whether it is actually deleted. Runs through `privacy-engineer`. |
| `licence-audit` | Building the dependency licence inventory from the resolved transitive tree and the shipped artefact, and determining which obligations are actually triggered by how the software is conveyed. Runs through `licence-analyst`. |
| `accessibility-statement` | Producing a conformance claim and an accessibility statement from real audit evidence, refusing to claim more than the evidence supports. Runs through `accessibility-compliance-analyst`. |

`compliance-scan` runs through the `compliance-engine` agent in a forked context
(`context: fork`, `agent: compliance-engine`, `model: opus`, `effort: high`) and accepts:

```
/foundry-legal:compliance-scan [--packs eu,it,global-baseline] [--profile path]
                               [--theme privacy|ai|accessibility|licensing] [--dry-run]
```

`--dry-run` validates the packs themselves: `controlId` uniqueness, `theme` and `severity` enums,
and any profile fact a pack references that is not in the published vocabulary.

The three themed skills all take a narrowing argument so a review has a bounded scope:
`privacy-review [--flow entry|storage|logs|deletion|rights|transfers]`,
`licence-audit [--conveyance saas|binary|container|onprem|library] [--fail-on copyleft|unknown]`,
`accessibility-statement [--instrument en301549|section508|wcag] [--scope <path-or-url-pattern>]`.

## Jurisdiction packs

| Pack id | Name | Controls |
|---|---|---|
| `global-baseline` | Global baseline (standards and frameworks, not law) | 40 |
| `eu` | European Union | 39 |
| `it` | Italy (national layer over `eu.json`) | 16 |
| `north-america` | United States and Canada | 26 |
| `uk-apac-latam` | United Kingdom, Asia-Pacific and Latin America | 26 |

The Italian pack is a national layer on top of the EU pack, covering instruments such as the
Codice Privacy (D.Lgs. 196/2003), Garante measures, Legge 4/2004 (Stanca) and the AgID
accessibility guidelines, the Codice dell'Amministrazione Digitale (D.Lgs. 82/2005), the Codice dei
contratti pubblici (D.Lgs. 36/2023) and the Italian NIS2 transposition supervised by ACN.

### Pack format

`packs/PACK-FORMAT.md` is the normative description of `pack.v1`. In summary:

| Header field | Rule |
|---|---|
| `id` | lowercase kebab, equal to the filename without `.json`; becomes `compliance-check.v1.jurisdiction` |
| `name` | human label |
| `scope` | who it applies to **and** what it deliberately excludes |
| `lastReviewed` | `null` in this repository; a fork that verifies against official texts sets the date and fills `sources` |
| `sources` | empty until someone verifies; entries are `{ instrument, url, consultedOn }` |
| `verificationRequired` | mandatory warning sentence, present in every pack |

| Control field | Required | Notes |
|---|---|---|
| `controlId` | yes | `<packId>-<instrument-slug>-<short-name>`, unique across all packs |
| `theme` | yes | one of `governance` `privacy` `security` `ai` `accessibility` `licensing` `records` `resilience` `consumer` |
| `instrument` | yes | copied verbatim into `compliance-check.v1.instrument` |
| `requirement` | yes | the obligation in general terms, one or two sentences, no invented thresholds |
| `appliesWhen` | yes | predicate: `always`, `allOf`, `anyOf`, `noneOf` |
| `evidenceHints` | yes | at least two, each prefixed `code:` `doc:` `cmd:` `config:` `ask:` |
| `severity` | yes | `critical` \| `high` \| `medium` \| `low` — exposure if unaddressed, not effort |
| `unverifiedCitation` | no | `true` when the citation has not been confirmed against the official text |

### How unknowns are handled

The `appliesWhen` predicate is evaluated over a project profile of dot-namespaced booleans
(`data.personal`, `markets.eu`, `product.genai-feature`, `org.controller`, and so on) with three
possible values: `true`, `false` and `"unknown"`. Anything absent from the profile is `"unknown"`.

1. If a referenced fact is `"unknown"` and the predicate cannot already be decided from the known
   facts, the control is emitted with `status: "undetermined"` and a rationale naming the missing
   profile fact. It is never silently dropped.
2. If the predicate is decidably false, the control is emitted as `not-applicable` with the
   deciding fact.
3. Otherwise it is assessed against evidence.

"Unknown" is never collapsed into "false". That collapse is the single most common way an
automated compliance tool produces a confident wrong answer.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `compliance-engine` | `handoff.v1` and `requirement.v1` | `compliance-check.v1`, one artifact per control, written as an array |
| `privacy-engineer` | `compliance-check.v1` | `compliance-check.v1` per privacy control, plus `finding.v1` for code-level defects |
| `ai-governance-analyst` | `compliance-check.v1` | `compliance-check.v1` per AI control |
| `accessibility-compliance-analyst` | `compliance-check.v1` | `compliance-check.v1` per accessibility control |
| `licence-analyst` | `compliance-check.v1` | `compliance-check.v1` per licensing control |

`compliance-check.v1` requires a `disclaimer` field whose only permitted value is the constant
`"Automated technical assessment. Not legal advice."`. The schema makes the disclaimer
unremovable: an artifact without it does not validate.

It also requires `status` from `compliant`, `partial`, `non-compliant`, `not-applicable`,
`undetermined` — and a `rationale` for whichever was chosen.

## Adding a jurisdiction

1. Copy an existing pack, keep the header shape, set `lastReviewed: null` and `sources: []`.
2. Write controls using the published profile vocabulary; do not add facts unless genuinely needed.
3. Run `/foundry-legal:compliance-scan --packs <new-id> --dry-run`.
4. Open a PR stating, per control, whether the citation was confirmed against an official text.
   Anything unconfirmed keeps `unverifiedCitation: true`.

Never invent an article number, a deadline, a monetary threshold or a penalty amount. If you are
not certain, name the instrument only and set `unverifiedCitation: true`.

## Limits

- Every pack shipped here is **unverified**: `lastReviewed` is `null` and `sources` is empty.
  Citations may be wrong or out of date, and the engine says so in every report.
- Coverage is uneven by design. The EU and global baseline packs are the deepest; APAC and LATAM
  are grouped into a single pack of 26 controls and are not comprehensive.
- The engine assesses evidence in the repository. Obligations discharged outside the codebase —
  a signed DPA, a completed DPIA, a register maintained in a separate system — appear as
  `undetermined` unless you point the profile at them.
