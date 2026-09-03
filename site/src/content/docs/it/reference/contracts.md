---
title: Contratti
description: Gli undici schemi JSON versionati con cui gli agenti si passano il lavoro, con i campi obbligatori e un esempio valido per ciascuno.
sidebar:
  order: 4
---

Gli agenti non si passano prosa. Si passano JSON che valida su uno schema, e un hook `PostToolUse`
rispedisce ciò che non valida all'agente che l'ha scritto, con l'elenco delle violazioni.

Gli schemi stanno in `plugins/foundry-core/schemas/*.schema.json`, sono JSON Schema 2020-12 e sono
versionati nel nome del file. **Rompere uno schema significa aggiungere `*.v2`, mai modificare
`*.v1`.**

Due campi sono obbligatori in ogni artefatto:

| Campo | Significato |
|---|---|
| `schema` | L'id del contratto. È una `const`, quindi deve corrispondere esattamente al file, ad esempio `"finding.v1"` |
| `producedBy` | Il nome dell'agente che ha prodotto l'artefatto |

`blackboard_write` li imposta per te a partire dai suoi argomenti `schema` e `agent`. Ogni schema
imposta inoltre `additionalProperties: false`, quindi un campo imprevisto è un errore di validazione
e non qualcosa di ignorato in silenzio.

Puoi validare qualsiasi cosa in qualsiasi momento:

```bash
foundry validate finding.v1 .foundry/blackboard/audit/appsec-reviewer.json
```

## Gli undici contratti

| Contratto | Scopo | Produttore tipico |
|---|---|---|
| `fact.v1` | Un fatto di progetto atomico e durevole, livello T1 | `memory-curator` |
| `finding.v1` | Un singolo difetto, lacuna o rischio trovato da un agente di audit, revisione o ricerca | agenti di audit e revisione |
| `review.v1` | L'esito di un passaggio di revisione, che incapsula i risultati con un verdetto | agenti di revisione |
| `adr.v1` | Una decisione, i suoi driver, le opzioni valutate e le conseguenze accettate | agenti di architettura |
| `plan.v1` | Un piano a ondate con gate espliciti, prodotto prima dell'implementazione | agenti di pianificazione |
| `requirement.v1` | Un requisito tracciabile con criteri di accettazione come comportamento verificabile | `requirements-analyst`, `domain-modeler` |
| `risk.v1` | Un rischio con esposizione quantificata e una mitigazione con responsabile | `risk-manager`, `security-architect`, `iac-engineer` |
| `estimate.v1` | Una stima a tre punti con le assunzioni esplicitate | agenti di economia |
| `compliance-check.v1` | Un controllo valutato su un pacchetto di giurisdizione | agenti legali |
| `handoff.v1` | Ciò che un'ondata passa alla successiva; incarna il firewall di contesto | ogni confine fra ondate |
| `tracker-item.v1` | Un'unità di lavoro normalizzata da uno specifico issue tracker in una forma indipendente dal fornitore | `tracker-operator`, `github-operator` |

---

## `fact.v1`

Un fatto di progetto atomico e durevole, conservato nel livello T1. Va scritto tramite lo strumento
MCP `memory_write`, mai a mano.

**Obbligatori:** `schema`, `producedBy`, `id`, `type`, `scope`, `title`, `body`, `confidence`,
`source`, `created`.

`id` deve corrispondere a `^fact-[0-9]{4,}$`. `title` è limitato a 80 caratteri e `body` a 900.
`type` è uno fra `decision`, `constraint`, `convention`, `domain`, `risk`, `metric`, `glossary`.
Facoltativi: `tags`, `expires` (data o `null`), `supersedes` (stringa o `null`), `links`.

```json
{
  "schema": "fact.v1",
  "producedBy": "memory-curator",
  "id": "fact-0004",
  "type": "decision",
  "scope": "project",
  "title": "Database migrations use Flyway, not Liquibase",
  "body": "**Why:** the team already reads plain SQL and the XML changelog format was slowing reviews.\n**How to apply:** new migrations go in db/migrations as V<n>__<slug>.sql; never edit an applied file.",
  "tags": ["persistence", "migrations"],
  "confidence": "high",
  "source": "adr-0007",
  "created": "2026-08-14",
  "expires": null,
  "supersedes": null,
  "links": ["fact-0009"]
}
```

## `finding.v1`

Un singolo difetto, lacuna o rischio. `failureScenario` è obbligatorio perché un risultato che ne è
privo è una supposizione.

**Obbligatori:** `schema`, `producedBy`, `id`, `severity`, `title`, `summary`, `failureScenario`,
`confidence`.

`severity` è uno fra `critical`, `high`, `medium`, `low`, `info`. `title` è limitato a 120
caratteri, `summary` a 600. Facoltativi: `category`, `location` (`file`, `line`, `component`),
`standard`, `remediation`, `effortHours`, `verdict` (`confirmed` \| `plausible` \| `refuted`),
`evidence`.

Ogni voce di `evidence` richiede `kind` — uno fra `file`, `command`, `url`, `standard`,
`measurement` — e `ref`, con un `excerpt` facoltativo limitato a 600 caratteri.

```json
{
  "schema": "finding.v1",
  "producedBy": "appsec-reviewer",
  "id": "F-014",
  "severity": "high",
  "category": "authentication",
  "title": "No rate limiting or lockout on the login endpoint",
  "summary": "POST /api/login accepts unlimited attempts per account and per source address. Neither the controller nor the gateway applies a limit.",
  "failureScenario": "An attacker sends 10k requests/min to /api/login with a common-password list against a known address; no lockout, no delay and no alert occurs.",
  "location": { "file": "src/main/java/app/auth/LoginController.java", "line": 42 },
  "standard": "OWASP ASVS V2.2.1",
  "remediation": "Apply a per-account and per-IP limiter with exponential backoff, and emit an auth.failure metric consumed by the existing alert rule.",
  "effortHours": 6,
  "confidence": "high",
  "verdict": "confirmed",
  "evidence": [
    { "kind": "file", "ref": "src/main/java/app/auth/LoginController.java:42" },
    { "kind": "command", "ref": "grep -r RateLimiter src/main/java", "excerpt": "no matches" }
  ]
}
```

## `review.v1`

L'esito di un passaggio di revisione, con i risultati ordinati per severità. Gli elementi di
`findings` sono oggetti `finding.v1` completi per riferimento, quindi tutto quanto sopra vale per
ciascuno di essi.

**Obbligatori:** `schema`, `producedBy`, `target`, `dimension`, `verdict`, `findings`, `summary`.

`verdict` è uno fra `pass`, `pass-with-comments`, `block`. `summary` è limitato a 900 caratteri.
Facoltativo: `metrics`, un oggetto libero usato da agenti come `persistence-engineer` per portare i
numeri prima/dopo.

```json
{
  "schema": "review.v1",
  "producedBy": "appsec-reviewer",
  "target": "src/main/java/app/auth",
  "dimension": "application-security",
  "verdict": "block",
  "findings": [
    {
      "schema": "finding.v1",
      "producedBy": "appsec-reviewer",
      "id": "F-014",
      "severity": "high",
      "title": "No rate limiting or lockout on the login endpoint",
      "summary": "POST /api/login accepts unlimited attempts per account and per source address.",
      "failureScenario": "An attacker sends 10k requests/min to /api/login; no lockout occurs.",
      "confidence": "high"
    }
  ],
  "metrics": { "filesReviewed": 23, "asvsControlsChecked": 41 },
  "summary": "One high finding blocks the release: the login endpoint has no throttle. Everything else in the auth package passed."
}
```

## `adr.v1`

Una decisione con le opzioni valutate. `options` richiede **almeno due** voci, ciascuna con nome,
pro e contro: un ADR che presenta una sola opzione è una giustificazione, non una decisione.

**Obbligatori:** `schema`, `producedBy`, `number`, `title`, `status`, `date`, `context`, `options`,
`decision`.

`status` è uno fra `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`. `number` è un
intero maggiore o uguale a 1. Facoltativi: `deciders`, `drivers`, `consequences` (`positive`,
`negative`, `risks`), `supersedes` (intero o `null`), e `cost` su ciascuna opzione.

```json
{
  "schema": "adr.v1",
  "producedBy": "database-architect",
  "number": 7,
  "title": "Use Flyway for database migrations",
  "status": "accepted",
  "date": "2026-08-14",
  "deciders": ["platform-team"],
  "context": "Migrations were applied by hand against staging and drifted from production twice in six months.",
  "drivers": ["Reviewability by the whole team", "No new build-time dependency", "Works with the existing Spring Boot starter"],
  "options": [
    {
      "name": "Flyway",
      "pros": ["Plain SQL the team already reads", "First-class Spring Boot integration"],
      "cons": ["No native rollback; contract phase must be a separate migration"],
      "cost": "half a day to wire, no licence"
    },
    {
      "name": "Liquibase",
      "pros": ["Database-agnostic changelogs", "Built-in rollback statements"],
      "cons": ["XML/YAML changelogs slowed reviews in the previous project"],
      "cost": "one day to wire, no licence"
    }
  ],
  "decision": "Adopt Flyway with V<n>__<slug>.sql files under db/migrations, applied on startup in non-production and by the pipeline in production.",
  "consequences": {
    "positive": ["Migrations are reviewed as SQL in the same PR as the code"],
    "negative": ["Rollback needs an explicit contract migration"],
    "risks": ["A long-running migration can block startup; the pipeline applies them out-of-band in production"]
  },
  "supersedes": null
}
```

## `plan.v1`

Un piano a ondate con gate verificabili da una macchina. Almeno un'ondata; ogni ondata richiede un
`id`, almeno un task e un `gate`. Ogni task richiede `id`, `description` e `agent`.

**Obbligatori:** `schema`, `producedBy`, `goal`, `waves`.

Facoltativi per task: `dependsOn`, `estimateHours`, `isolation` (`none` \| `worktree`).
Facoltativi al livello superiore: `rollback`, `outOfScope`.

```json
{
  "schema": "plan.v1",
  "producedBy": "roadmap-planner",
  "goal": "Ship self-service password reset behind a feature flag",
  "waves": [
    {
      "id": "analysis",
      "tasks": [
        { "id": "a1", "description": "Write requirements with acceptance criteria", "agent": "requirements-analyst", "estimateHours": 4 },
        { "id": "a2", "description": "Threat model the reset token flow", "agent": "security-architect", "dependsOn": ["a1"], "estimateHours": 6 }
      ],
      "gate": { "requirements_have_acceptance_criteria": true, "every_threat_has_a_mitigation_and_a_test": true }
    },
    {
      "id": "implementation",
      "tasks": [
        { "id": "i1", "description": "Reset endpoint and token store", "agent": "spring-engineer", "isolation": "worktree", "estimateHours": 16 },
        { "id": "i2", "description": "Reset request and confirm screens", "agent": "angular-engineer", "isolation": "worktree", "estimateHours": 12 }
      ],
      "gate": { "project_test_command_passes": true, "no_stubbed_acceptance_criteria": true }
    }
  ],
  "rollback": "Disable the password-reset flag; the endpoint returns 404 and the routes are not registered.",
  "outOfScope": ["Account recovery by support agents", "SMS as a second factor"]
}
```

## `requirement.v1`

Un requisito tracciabile. `acceptanceCriteria` richiede almeno una terna Dato/Quando/Allora, con
tutte e tre le parti obbligatorie: un requisito senza criterio testabile non può essere scritto.

**Obbligatori:** `schema`, `producedBy`, `id`, `kind`, `title`, `acceptanceCriteria`, `priority`.

`kind` è uno fra `functional`, `non-functional`, `constraint`, `regulatory`. `priority` è MoSCoW:
`must`, `should`, `could`, `wont`. Facoltativi: `userStory`, `tracesTo` (numeri di ADR, id di test,
controlli di conformità), `owner`.

```json
{
  "schema": "requirement.v1",
  "producedBy": "requirements-analyst",
  "id": "REQ-021",
  "kind": "functional",
  "title": "A user can reset their password from the sign-in screen",
  "userStory": "As a returning user who has forgotten my password, I want to set a new one from the sign-in screen so that I do not have to contact support.",
  "acceptanceCriteria": [
    {
      "given": "an account exists for the submitted address",
      "when": "the user submits the reset form",
      "then": "a single-use token valid for 30 minutes is emailed and the response is identical to the unknown-address case"
    },
    {
      "given": "a reset token older than 30 minutes",
      "when": "the user submits a new password with it",
      "then": "the request is rejected with a 400 and the token is deleted"
    }
  ],
  "priority": "must",
  "tracesTo": ["adr-0011", "e2e/password-reset.spec.ts"],
  "owner": "identity-team"
}
```

## `risk.v1`

Un rischio con esposizione quantificata e una mitigazione con responsabile. Un rischio senza
responsabile non può essere scritto.

**Obbligatori:** `schema`, `producedBy`, `id`, `title`, `category`, `probability`, `impactEur`,
`mitigation`, `owner`, `status`.

`probability` è un numero fra 0 e 1. `category` è uno fra `technical`, `schedule`, `cost`,
`security`, `compliance`, `operational`, `vendor`, `people`. `status` è uno fra `open`,
`mitigating`, `accepted`, `closed`. Facoltativi: `exposureEur` (probabilità per impatto),
`detection`, `contingency`, `reviewBy`.

```json
{
  "schema": "risk.v1",
  "producedBy": "risk-manager",
  "id": "R-006",
  "title": "The single Postgres instance has no tested restore path",
  "category": "operational",
  "probability": 0.15,
  "impactEur": 120000,
  "exposureEur": 18000,
  "detection": "Nightly backup job reports success; no restore has ever been attempted.",
  "mitigation": "Restore the latest backup into a scratch instance monthly and record the wall-clock RTO in the runbook.",
  "contingency": "Rebuild from the read replica, accepting the replication lag as data loss.",
  "owner": "platform-team",
  "reviewBy": "2026-10-01",
  "status": "mitigating"
}
```

## `estimate.v1`

Una stima a tre punti. Almeno una voce, ciascuna con `optimistic`, `likely` e `pessimistic`, e
almeno un'assunzione: una stima senza assunzioni dichiarate viene respinta.

**Obbligatori:** `schema`, `producedBy`, `scope`, `items`, `assumptions`.

Facoltativi: `currency` (predefinito `EUR`), `expected` (PERT, `(o + 4m + p) / 6`),
`confidenceInterval` (`p50`, `p80`, `p95`), `excluded`. Ogni voce può dichiarare un `role` e una
`unit` fra `hours`, `days` o `eur`.

```json
{
  "schema": "estimate.v1",
  "producedBy": "cost-engineer",
  "scope": "Self-service password reset, end to end",
  "currency": "EUR",
  "items": [
    { "label": "Backend endpoint and token store", "role": "backend", "optimistic": 12, "likely": 16, "pessimistic": 30, "unit": "hours" },
    { "label": "Frontend screens and states", "role": "frontend", "optimistic": 8, "likely": 12, "pessimistic": 22, "unit": "hours" },
    { "label": "E2E coverage of both journeys", "role": "qa", "optimistic": 4, "likely": 6, "pessimistic": 12, "unit": "hours" }
  ],
  "expected": 35.7,
  "confidenceInterval": { "p50": 34, "p80": 44, "p95": 56 },
  "assumptions": [
    "The existing transactional email provider is used; no new vendor is onboarded.",
    "Design is reused from the sign-in screens; no new design work is priced."
  ],
  "excluded": ["Support tooling for agent-initiated resets", "Localisation beyond English and Italian"]
}
```

## `compliance-check.v1`

Un controllo valutato su un pacchetto di giurisdizione. Il campo `disclaimer` è una `const`: il suo
unico valore ammesso è `"Automated technical assessment. Not legal advice."`, il che rende la
clausola strutturalmente non rimovibile.

**Obbligatori:** `schema`, `producedBy`, `controlId`, `jurisdiction`, `instrument`, `requirement`,
`status`, `rationale`, `assessedOn`, `disclaimer`.

`status` è uno fra `compliant`, `partial`, `non-compliant`, `not-applicable`, `undetermined`.
Facoltativi: `gap`, `remediation`, `evidence` (stessa forma di `finding.v1`).

```json
{
  "schema": "compliance-check.v1",
  "producedBy": "privacy-engineer",
  "controlId": "eu-gdpr-30-ropa",
  "jurisdiction": "eu",
  "instrument": "GDPR (Regulation (EU) 2016/679) Art. 30",
  "requirement": "Maintain a record of processing activities covering purposes, categories of data subjects and data, recipients, transfers, retention and security measures.",
  "status": "partial",
  "rationale": "A register exists at docs/privacy/ropa.md and covers purposes and categories, but lists no recipients and no retention period for the analytics export.",
  "gap": "Recipients and retention are absent for the analytics processing activity.",
  "remediation": "Add the analytics processor, the transfer basis and a stated retention period to the register, and link it to the deletion job.",
  "evidence": [
    { "kind": "file", "ref": "docs/privacy/ropa.md" },
    { "kind": "file", "ref": "src/analytics/export.ts:88", "excerpt": "no retention window applied" }
  ],
  "assessedOn": "2026-08-27",
  "disclaimer": "Automated technical assessment. Not legal advice."
}
```

L'enum di `evidence.kind` è `file`, `command`, `url`, `standard`, `measurement`.

## `handoff.v1`

Ciò che un'ondata passa alla successiva. È lo schema che codifica il firewall di contesto: va
elencato almeno un artefatto, e `summary` è limitato a 1200 caratteri con la nota che è l'**unica**
narrazione che attraversa il confine verso il contesto del chiamante.

**Obbligatori:** `schema`, `producedBy`, `wave`, `status`, `artifacts`, `summary`.

`status` è uno fra `complete`, `partial`, `blocked`. Ogni artefatto richiede `path` e `schema`, e
facoltativamente `sizeBytes`. Facoltativi al livello superiore: `openQuestions`, `blockedBy`,
`tokensSpent`.

```json
{
  "schema": "handoff.v1",
  "producedBy": "foundry-orchestrator",
  "wave": "analysis",
  "status": "partial",
  "artifacts": [
    { "path": ".foundry/blackboard/analysis/requirements-analyst.json", "schema": "requirement.v1", "sizeBytes": 4821 },
    { "path": ".foundry/blackboard/analysis/security-architect.json", "schema": "risk.v1", "sizeBytes": 3109 }
  ],
  "summary": "Six requirements written, all with acceptance criteria. Threat model produced four risks; three have a mitigation and a test, one does not because the token store has not been chosen yet. Implementation can start on the frontend but not on the token flow.",
  "openQuestions": ["Redis or Postgres for the reset token store?"],
  "blockedBy": ["Decision on the token store"],
  "tokensSpent": 41200
}
```

## `tracker-item.v1`

Un'unità di lavoro normalizzata da uno specifico issue tracker in una forma indipendente dal
fornitore. Le metriche di flusso, le previsioni e i report di sprint leggono questo e mai il
payload del fornitore, così una squadra può cambiare tracker senza riscrivere ogni agente a valle.

**Obbligatori:** `schema`, `producedBy`, `provider`, `sourceId`, `title`, `type`, `state`,
`nativeState`.

`provider` è uno fra `github`, `jira`, `linear`, `gitlab`. `title` è limitato a 200 caratteri.
`type` è uno fra `epic`, `story`, `task`, `bug`, `spike`, `chore`, `unmapped`; `state` è uno fra
`triage`, `ready`, `in-progress`, `in-review`, `blocked`, `done`, `cancelled`, `unmapped`.

Ogni campo normalizzato conserva accanto a sé il valore grezzo del fornitore — `type` accanto a
`nativeType`, `state` accanto a `nativeState`. Questo accoppiamento è il senso del contratto: una
normalizzazione che scarta in silenzio ciò che non è riuscita a mappare è un difetto, quindi tutto
ciò che non rientra nell'enum viene registrato come `unmapped` conservando l'originale, invece di
essere forzato nella casella più vicina.

`flow.historyRead` dichiara se la cronologia delle transizioni del fornitore è stata davvero
leggibile. Quando vale `false` i timestamp in `flow` sono assenti anziché indovinati, e il cycle
time non è calcolabile da questo elemento: un agente a valle deve dirlo, non riportare un numero.

Facoltativi: `sourceUrl`, `nativeType`, `assignees`, `labels`, `estimate` (`{value, unit}`),
`parent`, `sprint` (`{id, name, startedAt, endsAt, state}`), `createdAt`, `updatedAt`, `closedAt`,
`flow`, `blockedBy`, `tracesTo`.

```json
{
  "schema": "tracker-item.v1",
  "producedBy": "tracker-operator",
  "provider": "jira",
  "sourceId": "PAY-418",
  "sourceUrl": "https://example.atlassian.net/browse/PAY-418",
  "title": "Refund a captured payment without re-authorising the card",
  "type": "story",
  "nativeType": "Story",
  "state": "in-review",
  "nativeState": "In Code Review",
  "assignees": ["a.rossi"],
  "labels": ["payments", "regulatory"],
  "estimate": { "value": 5, "unit": "point" },
  "parent": "PAY-400",
  "sprint": {
    "id": "42",
    "name": "Payments 24.9",
    "startedAt": "2026-08-24T08:00:00Z",
    "endsAt": "2026-09-07T08:00:00Z",
    "state": "active"
  },
  "createdAt": "2026-08-19T09:12:00Z",
  "updatedAt": "2026-09-01T16:40:00Z",
  "flow": {
    "enteredInProgress": "2026-08-26T09:05:00Z",
    "enteredReview": "2026-09-01T16:40:00Z",
    "blockedDays": 1,
    "historyRead": true
  },
  "blockedBy": ["PAY-407"],
  "tracesTo": ["req-0031"]
}
```

## Aggiungere un contratto

1. Aggiungi `<sostantivo>.v<major>.schema.json` a `plugins/foundry-core/schemas/`, JSON Schema
   2020-12, con `additionalProperties: false` e `schema`/`producedBy` obbligatori.
2. Referenzialo alla lettera nella sezione `## Output contract` dell'agente.
3. Diventa disponibile automaticamente per `foundry validate`, `contract_validate`,
   `blackboard_write` e il validatore `PostToolUse` — tutti e quattro enumerano la directory anziché
   un elenco fisso.

Non modificare mai un file `.v1` in modo che respinga un artefatto prima valido. Aggiungi `.v2`.

## Limiti

- Il validatore implementa un **sottoinsieme** di JSON Schema 2020-12 sufficiente per questi
  contratti. Non è un validatore generico: dai per supportate le parole chiave effettivamente usate
  qui.
- `format: "date"` è documentazione, non necessariamente applicazione. Non contare sullo schema per
  respingere una data malformata.
- `plan.v1.gate` e `review.v1.metrics` sono oggetti liberi. Il loro contenuto è una convenzione fra
  agenti, non una struttura validata.
