# Profile derivation

> **Automated technical assessment. Not legal advice.**

The project profile is a flat map of the facts in `packs/PACK-FORMAT.md` §4 to `true`, `false` or
`"unknown"`. It decides which controls are in scope, so a wrong profile produces a confidently wrong
report. Three rules govern every entry:

1. A fact you cannot evidence is `"unknown"`, never `false`.
2. Every `true` carries an evidence pointer (`file:line`, config key, command output).
3. `markets.*`, `sector.*` and `org.*` are **never** derived from code. They are business facts.

## Profile file

`.foundry/compliance/profile.json`:

```json
{
  "schema": "foundry-legal.profile",
  "confirmedBy": "name or role",
  "confirmedOn": "YYYY-MM-DD",
  "facts": {
    "data.personal": true,
    "data.special-category": "unknown",
    "markets.eu": true,
    "sector.health": false,
    "org.controller": true
  },
  "evidence": {
    "data.personal": "prisma/schema.prisma:44 User.email",
    "markets.eu": "confirmed by product lead 2026-08-20"
  }
}
```

A profile with `confirmedBy: null` is a draft. Reports built on a draft profile say so on the first
line.

## Derivable facts and their signals

### `data.*`

| Fact | Signals that support `true` | Not sufficient |
|---|---|---|
| `personal` | a schema field holding a name, email, phone, address, IP, device id, user id tied to a person; a form collecting any of these | a `users` table alone — check the columns |
| `special-category` | fields for health, religion, union membership, ethnicity, sexual orientation, political opinion; **or** a free-text field where users predictably write them | absence of such fields, because free text defeats schema analysis |
| `health` | clinical codes, diagnosis, medication, symptom, wellness metrics, appointment reason | a healthcare customer name in the README |
| `biometric` | face, fingerprint, voiceprint, iris, gait processing; liveness checks; face-match SDKs | a photo upload field alone (but flag it) |
| `children` | age fields, birth date with an under-18 branch, parental consent flows, school or guardian entities | marketing copy about families |
| `financial` | card tokens, IBAN, account numbers, transaction records, credit data | a Stripe dependency alone (but flag it) |
| `location` | latitude/longitude, geohash, GPS permissions, IP-geolocation lookups | a country field |
| `communications-content` | message bodies, email content, call recordings, chat transcripts | metadata alone (record separately) |
| `employee` | HR entities, employee ids, timesheets, performance records, internal directory sync | staff accounts in an admin table |
| `pseudonymised-only` | **treat as `"unknown"` unless a re-identification analysis exists.** Claimed pseudonymisation is a technical-legal determination, not a schema fact. | a hashed id column — hashing an identifier is not pseudonymisation in the legal sense |

### `product.*`

| Fact | Signals |
|---|---|
| `web-ui` | a web framework dependency with rendered routes or components |
| `api-only` | HTTP handlers with no rendering layer and no client bundle |
| `mobile-app` | iOS/Android toolchain, React Native, Flutter, a mobile CI job |
| `desktop-app` | Electron, Tauri, a native desktop build target |
| `cli` | a `bin` entry, an argument parser as an entry point |
| `library` | published package with no application entry point |
| `binary-distributed` | a release workflow producing downloadable artefacts |
| `connected-device` | firmware build, embedded toolchain, OTA update code |
| `ai-system` | model SDK import, inference HTTP call, local model file, learned coefficients |
| `genai-feature` | LLM or diffusion model call whose output reaches a user |
| `ai-decisions-about-people` | **flag, do not decide.** Requires knowing what the output is used for. Derive a candidate from the decision domain in the code and mark `"unknown"` until confirmed. |
| `biometric-identification` | face or voice matching against an enrolled template |
| `automated-employment-decisions` | never derive — ask |
| `credit-scoring` | never derive — ask |
| `ad-tech` | advertising SDKs, conversion pixels, audience/segment export, bid request code |
| `payments` | payment processor SDK, card handling, PCI-adjacent code |
| `marketing-email` | bulk send integration, campaign entities, suppression list code |

### `deployment.*` and `transfers.*`

| Fact | Signals |
|---|---|
| `deployment.eu` / `.us` | region strings in IaC, cloud console config, endpoint hostnames |
| `deployment.multi-region` | more than one region in the deployed configuration, or a global CDN with origin failover |
| `deployment.saas` | a hosted service the vendor operates |
| `deployment.on-prem-customer` | an installer, a Helm chart shipped to customers, an appliance image |
| `transfers.outside-eea` | any vendor endpoint, log sink, analytics, LLM provider or support tool resolving outside the EEA, **and** support access from outside |
| `transfers.to-us` / `.to-china` | provider region configuration; a US-headquartered vendor is a signal to investigate, not a conclusion |

Enumerate vendors from configuration — CSP `connect-src`, SDK imports, webhook targets, SMTP relays,
CDN hostnames, `.env.example`. The deployed configuration is ground truth; a documented vendor list
that disagrees with it is itself a finding.

### `supplychain.*`

| Fact | Signals |
|---|---|
| `third-party-oss` | any lockfile with entries — effectively always true |
| `distributes-software` | a publish or release step in CI, a package published under the org name |
| `saas-only` | no distribution artefact anywhere in the release pipeline |
| `accepts-external-contributions` | a public repository with `CONTRIBUTING.md`, or merged commits from outside the org |
| `ships-model-weights` | model files in release artefacts, a model registry publish step |

## Facts that must be asked

Never infer these. A locale file, a translated string, a currency symbol or a `.eu` domain is not
evidence of a market.

| Fact family | The question to ask |
|---|---|
| `markets.*` | "In which countries do you have users, customers or employees today — not in which countries is the product reachable?" |
| `sector.*` | "Does the organisation operate in, or supply services to, a regulated sector: health, finance, insurance, public administration, energy, transport, telecoms, water, digital infrastructure?" |
| `org.*` | "Is the organisation a controller, a processor, or both, for each activity? Is it a public body? Is it a US-listed issuer? Does it sell to public sector buyers? Does it employ people in the EU?" |
| `users.minors` | "Is the service directed at, or in practice used by, people under 18?" |

Subagents cannot use `AskUserQuestion`. When running inside an agent, put the question verbatim into
`rationale` on the affected controls and into `handoff.v1.openQuestions`, and let the calling
conversation surface it.

## Anti-patterns

- **Deriving a market from i18n.** Translation is a product decision, not a legal footprint.
- **Setting `false` because a grep found nothing.** Grep proves you searched, not that the thing does
  not exist. `"unknown"` is the honest value.
- **Treating a vendor's home country as the transfer destination.** The configured region decides.
- **Recording `pseudonymised-only: true` from a hashed column.** Reversible or linkable identifiers
  remain personal data.
- **Copying last quarter's profile.** Re-derive the code-derivable facts each run and diff them; the
  diff is often the most useful output of the whole scan.
