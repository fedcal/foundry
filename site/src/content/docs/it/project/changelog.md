---
title: Changelog
description: Storico dei rilasci del marketplace Foundry e dei suoi dodici plugin.
sidebar:
  order: 3
---

Tutti e dodici i plugin e il marketplace condividono una versione. I contratti sono versionati a
parte, nel nome del file.

## 0.1.0

Prima release pubblica.

### Marketplace

Dodici plugin sotto un solo marketplace (`fedcal/foundry`), ciascuno con
`dependencies: [foundry-core]` tranne il kernel stesso. `foundry-core` è l'unico plugin con
`defaultEnabled: true`.

| Plugin | Agenti | Skill |
|---|---|---|
| `foundry-core` | 4 | 7 |
| `foundry-research` | 5 | 5 |
| `foundry-ai` | 4 | 4 |
| `foundry-data` | 4 | 4 |
| `foundry-dev` | 19 | 17 |
| `foundry-quality` | 6 | 5 |
| `foundry-ops` | 6 | 5 |
| `foundry-pmo` | 6 | 6 |
| `foundry-economics` | 5 | 5 |
| `foundry-legal` | 5 | 4 |
| `foundry-growth` | 6 | 6 |
| `foundry-oss` | 4 | 5 |

### Kernel

- **Memoria governata** su quattro livelli: scratch di sessione, fatti atomici, runbook e ADR. Per
  impostazione predefinita viene caricato solo `.foundry/memory/INDEX.md`, con tetto rigido di 4000
  token; tutto il resto è recuperato su richiesta.
- **Undici contratti** come JSON Schema 2020-12: `fact.v1`, `finding.v1`, `review.v1`, `adr.v1`,
  `plan.v1`, `requirement.v1`, `risk.v1`, `estimate.v1`, `compliance-check.v1`, `handoff.v1`,
  `tracker-item.v1`.
- **Server MCP** (`foundry`): nove strumenti — `memory_search`, `memory_write`, `memory_index`,
  `runbook_list`, `runbook_get`, `contract_validate`, `blackboard_write`, `blackboard_read`,
  `token_report` — più una risorsa per l'indice di memoria, una per i contratti e una per ogni
  runbook.
- **Nove voci di hook** su otto eventi: iniezione dello stato di sessione, richiamo mirato al
  momento del prompt, una guardia Bash con otto regole con nome, una guardia in scrittura per
  credenziali e percorsi protetti, validazione contrattuale della blackboard, il firewall di
  contesto sui subagent, il gate di verifica prima della dichiarazione, persistenza prima della
  compattazione, preparazione dei worktree e metriche di fine sessione.
- **CLI**: `foundry init`, `doctor`, `memory index|search|prune`, `tokens`, `runbooks`,
  `validate`, `profile`.
- **Tre workflow dinamici**: `foundry-feature-delivery`, `foundry-audit-sweep`,
  `foundry-compliance-sweep`.
- **Due playbook**: `feature-delivery.yaml`, `audit.yaml`.
- **Tre stili di output**: Foundry Senior Engineer, Foundry Analyst, Foundry PMO.

### Profili

Cinque profili che impostano insieme plugin, permessi e livello di enforcement:
`angular-spring-enterprise`, `oss-library`, `pa-italia`, `startup-mvp`, `full`.

### Pacchetti di giurisdizione

Cinque pacchetti, 147 controlli in totale: `global-baseline` (40), `eu` (39), `it` (16),
`north-america` (26), `uk-apac-latam` (26). Ogni pacchetto ha `lastReviewed: null` e un array
`sources` vuoto; le citazioni non sono verificate e il motore lo dichiara in ogni report.

### Governance

Tredici template OSS in `foundry-oss`, un contratto di authoring fatto rispettare in CI da
`scripts/validate-assets.mjs`, test unitari del kernel, e un sito di documentazione bilingue EN/IT.

### Limiti noti alla 0.1.0

- I pacchetti di giurisdizione non sono verificati sui testi ufficiali.
- `memory_search` è punteggio per parole chiave, non ricerca semantica.
- I valori di token sono stimati a circa quattro caratteri per token, non output di un tokenizer.
- Lo scaffolding delle pipeline riguarda solo GitHub Actions; il codice dell'infrastruttura solo
  Terraform e OpenTofu; le operazioni sul repository richiedono un `gh` autenticato.
- Gli agenti di database presuppongono PostgreSQL.

### Comportamento verificato

Verificato contro il binario di Claude Code 2.1.250 il 2026-08-28, non contro la documentazione
inclusa nelle cache. Tre conseguenze sono incorporate in questa release:

- `PreToolUse` accetta solo `allow`, `deny`, `ask` e `defer`. `escalate` viene rifiutato dallo
  schema e fallisce in apertura, quindi il gate sui percorsi protetti chiede conferma.
- `Stop` e `SubagentStop` bloccano con un `{"decision":"block","reason":…}` di primo livello, non
  con `permissionDecision`.
- I percorsi `source` del marketplace si risolvono rispetto alla radice del marketplace, quindi
  ogni voce porta il percorso completo e `metadata.pluginRoot` non viene usato.

I gate bloccanti restano silenziosi finché un progetto non esegue `foundry init`, così installare
il kernel non li arma su ogni progetto della macchina.

### Requisiti

Claude Code 2.1.x o successiva; Node.js 20 o successiva. `superpowers` facoltativo, con degradazione
graduale. Licenza Apache-2.0.
