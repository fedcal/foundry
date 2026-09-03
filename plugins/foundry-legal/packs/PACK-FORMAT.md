# Jurisdiction pack format (`pack.v1`)

> **Automated technical assessment. Not legal advice.** A pack is a machine-readable checklist
> written by engineers. It is not a statement of law, it is not exhaustive, and it is not a
> substitute for a qualified lawyer or a data protection officer. Have a qualified professional
> confirm anything consequential before you rely on it.

A pack is **data**. The reasoning lives in `agents/compliance-engine.md`. Adding a country means
dropping one JSON file into this directory — no agent, skill or code change.

---

## 1. File shape

```json
{
  "pack": {
    "id": "eu",
    "name": "European Union",
    "scope": "One paragraph: who this pack applies to and what it excludes.",
    "lastReviewed": null,
    "sources": [],
    "verificationRequired": "Law changes. ..."
  },
  "controls": [ { /* control objects */ } ]
}
```

### `pack` header fields

| Field | Type | Rule |
|---|---|---|
| `id` | string | lowercase kebab, must equal the filename without `.json`. Becomes `compliance-check.v1.jurisdiction`. |
| `name` | string | human label |
| `scope` | string | who it applies to **and** what it deliberately excludes |
| `lastReviewed` | `null` \| `YYYY-MM-DD` | `null` in this repository. Only a human who has verified **every** control in the pack against the official text may set a date. |
| `sources` | array | Entry points a verifier should start from: `{ "instrument": "...", "url": "...", "checkedOn": "YYYY-MM-DD" }`. `checkedOn` records only that the URL was reachable and is the right entry point — **not** that any control was verified against it. A populated `sources` array with `lastReviewed: null` therefore means "we know where to look, nobody has looked yet", and the engine must keep reporting the pack as unverified. |
| `verificationRequired` | string | mandatory warning sentence, present in every pack |

`lastReviewed: null` is not decorative. The engine **must** surface it: every report says the packs
are unverified and every control needs confirmation against the current official text.

---

## 2. Control object

```json
{
  "controlId": "eu-gdpr-30-ropa",
  "theme": "records",
  "instrument": "GDPR (Regulation (EU) 2016/679) Art. 30",
  "requirement": "Maintain a record of processing activities covering purposes, categories of data subjects and data, recipients, transfers, retention and security measures.",
  "appliesWhen": { "allOf": ["data.personal"], "anyOf": ["markets.eu", "org.employees-in-eu"] },
  "evidenceHints": [
    "doc: docs/privacy/ropa.md or an equivalent register",
    "code: entity/model definitions that enumerate personal data fields",
    "ask: is the register maintained by the controller or by the processor"
  ],
  "severity": "high",
  "unverifiedCitation": true
}
```

| Field | Required | Notes |
|---|---|---|
| `controlId` | yes | `<prefix>-<instrument-slug>-<short-name>`, unique across **all** packs. `<prefix>` is the pack id, or a short stable abbreviation of the jurisdiction it covers where a pack spans several (`north-america.json` uses `na-` and `ca-`; `uk-apac-latam.json` uses `uk-`, `br-`, `in-`, `jp-`, `au-`, `cn-`). Never change a `controlId` once published — assessments reference it across runs. |
| `theme` | yes | one of `governance` `privacy` `security` `ai` `accessibility` `licensing` `records` `resilience` `consumer` |
| `instrument` | yes | goes verbatim into `compliance-check.v1.instrument` |
| `requirement` | yes | the obligation in **general terms**, one or two sentences, no invented thresholds |
| `appliesWhen` | yes | predicate, see §3 |
| `evidenceHints` | yes | at least two, each prefixed `code:` `doc:` `cmd:` `config:` `ask:` |
| `severity` | yes | `critical` \| `high` \| `medium` \| `low` — *exposure if unaddressed*, not effort |
| `unverifiedCitation` | no | `true` when the citation (article, clause, deadline, threshold) has **not** been confirmed against the official text. Absent means `false`. |

### Accuracy rules for pack authors

1. Never invent an article number, a deadline, a monetary threshold or a penalty amount.
   If you are not certain, name the **instrument only** and set `unverifiedCitation: true`.
2. `requirement` describes the obligation, not the remedy. Remediation is the engine's job.
3. No pack states that something *is* compliant. Packs only state what must be shown.
4. A control that duplicates another pack's control is still allowed — the engine deduplicates by
   `requirement` similarity and keeps the strictest `severity`.

---

## 3. `appliesWhen` predicate

Four forms, all optional except that at least one must be present:

| Key | Semantics |
|---|---|
| `always: true` | applies unconditionally |
| `allOf: [fact, ...]` | every fact must be `true` |
| `anyOf: [fact, ...]` | at least one fact must be `true` |
| `noneOf: [fact, ...]` | every fact must be `false` |

Evaluation, in order:

1. If any referenced fact is `"unknown"` **and** the predicate cannot already be decided from the
   known facts alone, the control is emitted with `status: "undetermined"` and a `rationale`
   naming the missing profile fact. It is **never** silently dropped.
2. If the predicate is decidably false, emit `status: "not-applicable"` with the deciding fact.
3. Otherwise the control is in scope and gets assessed against evidence.

Never collapse "unknown" into "false". That is the single most common way an automated compliance
tool produces a confident wrong answer.

---

## 4. Project profile vocabulary

Facts are dot-namespaced booleans with three possible values: `true`, `false`, `"unknown"`.
Anything not present in the profile is `"unknown"`.

| Namespace | Facts |
|---|---|
| `data.` | `personal` `special-category` `health` `biometric` `children` `financial` `location` `communications-content` `employee` `pseudonymised-only` |
| `users.` | `consumer` `employee` `business` `public-sector` `minors` |
| `markets.` | `eu` `it` `uk` `us` `us-ca` `canada` `brazil` `india` `japan` `australia` `china` `other` |
| `deployment.` | `eu` `us` `multi-region` `saas` `on-prem-customer` `mobile-app` `desktop-app` `embedded-device` |
| `sector.` | `health` `finance` `insurance` `public` `education` `energy` `transport` `telecom` `water` `digital-infrastructure` `manufacturing` |
| `product.` | `web-ui` `api-only` `mobile-app` `cli` `library` `binary-distributed` `connected-device` `ai-system` `genai-feature` `ai-decisions-about-people` `biometric-identification` `automated-employment-decisions` `credit-scoring` `ad-tech` `payments` `marketing-email` |
| `org.` | `controller` `processor` `sub-processor` `public-body` `us-public-company` `sells-to-us-federal` `sells-to-eu-public-sector` `employees-in-eu` `financial-entity` |
| `supplychain.` | `third-party-oss` `distributes-software` `saas-only` `accepts-external-contributions` `ships-model-weights` |
| `transfers.` | `outside-eea` `to-us` `to-china` `intra-group` |

Adding a fact means adding it to this table **and** to the profile section of
`agents/compliance-engine.md`. A pack referencing a fact absent from this table is a defect and
the engine must reject the pack rather than guess.

---

## 5. Adding a new jurisdiction

1. Copy an existing pack, keep the header shape, set `lastReviewed: null`, `sources: []`.
2. Write controls using the vocabulary in §4. Do not add facts unless genuinely needed.
3. Run `/foundry-legal:compliance-scan --packs <new-id> --dry-run`; the engine validates
   `controlId` uniqueness, `theme` and `severity` enums, and unknown facts.
4. Open a PR that states, per control, whether the citation was confirmed against an official
   text. Anything unconfirmed keeps `unverifiedCitation: true`.
