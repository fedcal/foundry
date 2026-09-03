<div align="center">

# Foundry

**Lo stack di ingegneria senior per Claude Code.**

Dodici plugin. Un kernel. Memoria governata, contratti fra agenti, gate che spiegano se stessi
e un budget di token davvero misurabile.

[Documentazione](https://fedcal.github.io/foundry/it/) ·
[English](./README.md) ·
[Contratto di authoring](./AUTHORING.md) ·
[federicocalo.dev](https://federicocalo.dev)

[![Validate](https://github.com/fedcal/foundry/actions/workflows/validate.yml/badge.svg)](https://github.com/fedcal/foundry/actions/workflows/validate.yml)
[![Licenza](https://img.shields.io/badge/licenza-Apache--2.0-blue.svg)](./LICENSE)

</div>

---

## Installazione

```bash
/plugin marketplace add fedcal/foundry
/plugin install foundry-core@foundry
```

`foundry-core` è il kernel ed è obbligatorio. Poi aggiungi i verticali che ti servono:

```bash
/plugin install foundry-dev@foundry        # architettura, Angular, Spring Boot, dati, sicurezza, UX
/plugin install foundry-quality@foundry    # strategia di test, performance, osservabilità, SRE
/plugin install foundry-ops@foundry        # CI/CD, container, Kubernetes, IaC, rilasci
```

Oppure applica un profilo, che sceglie insieme plugin, permessi e livello di enforcement:

```bash
foundry profile angular-spring-enterprise
```

Profili disponibili: `angular-spring-enterprise`, `oss-library`, `pa-italia`, `startup-mvp`, `full`.

## Il problema che risolve

Un agente di coding capace continua comunque a dimenticare quello che hai deciso la settimana
scorsa, rilegge gli stessi file a ogni sessione, dichiara finito un lavoro senza averlo eseguito e
produce output sicuri di sé che nessuno ha verificato. Aggiungere prompt non risolve niente.
Foundry lo risolve con dei meccanismi:

| Problema | Meccanismo |
|---|---|
| Le decisioni si perdono fra una sessione e l'altra | Memoria a quattro livelli: entra in contesto solo un indice da 4000 token, il resto si recupera su richiesta |
| I subagenti restituiscono muri di testo e bruciano il budget | Un gate su `SubagentStop` rifiuta le risposte oltre il budget di handoff e pretende un artefatto |
| Gli agenti si passano prosa non strutturata | Undici JSON Schema versionati; un hook `PostToolUse` rimanda le violazioni all'autore |
| "Tutti i test passano" senza aver eseguito i test | Un gate su `Stop` blocca le dichiarazioni di completamento prive di un comando di verifica nel turno |
| Segreti e comandi distruttivi che sfuggono | Gate `PreToolUse` con regole nominate e override documentati e a scadenza |
| Nessuno sa quanto costa una sessione | Routing dei modelli per agente, context firewall e `foundry tokens` |

## Cosa contiene

```
foundry-core        kernel: memoria, contratti, orchestrazione, gate, server MCP, CLI
foundry-research    ricerca di dominio, valutazione tecnologica, documentazione
foundry-dev         architettura, protocolli, integrazioni, sicurezza, UX/a11y, Angular, Spring, dati
foundry-quality     strategia di test, contract e E2E testing, performance, osservabilità, SRE
foundry-ai          pipeline RAG, valutazione LLM, architettura di agenti, prompt engineering
foundry-data        analisi esplorativa, addestramento e valutazione di modelli, MLOps
foundry-ops         GitHub Actions, container, Kubernetes, Terraform, cloud e PaaS, rilasci
foundry-pmo         roadmap, backlog, requisiti, rischi, operazioni GitHub, reportistica
foundry-economics   cost engineering, FinOps, spesa AI, business case, finanziamenti
foundry-legal       motore di compliance più jurisdiction pack: globale, UE/IT, Nord America, UK/APAC/LATAM
foundry-growth      posizionamento, lancio, pubblico, finanziatori, reputazione, collaboratori
foundry-oss         governance, processo RFC, triage, versionamento semantico, advisory di sicurezza
```

Ogni verticale dichiara `dependencies: [foundry-core]`, quindi installandone uno arriva anche il kernel.

## Come funziona

### Memoria governata

```
.foundry/
├── scratch/          T0  locale alla sessione, in gitignore
├── memory/facts/     T1  fatti atomici e durevoli, un file ciascuno
├── memory/INDEX.md   T1  l'unico file caricato di default, tetto di 4000 token
├── runbooks/         T2  procedure che qualcuno ripeterà
└── blackboard/       ..  artefatti validati che gli agenti si passano
docs/adr/             T3  decisioni architetturali, permanenti e pubbliche
```

I fatti si scrivono con lo strumento MCP `memory_write`, che deduplica, assegna gli id e mantiene
le catene di supersedes. Si leggono con `memory_search`, che restituisce solo ciò che serve.
Nessuno legge direttamente i file dei fatti: è esattamente questo il punto.

### Contratti fra agenti

```jsonc
// .foundry/blackboard/audit/appsec-reviewer.json
{
  "schema": "review.v1",
  "producedBy": "appsec-reviewer",
  "target": "src/main/java/com/acme/auth",
  "dimension": "security",
  "verdict": "block",
  "summary": "Un finding alto confermato: /api/login non ha rate limit né blocco account.",
  "findings": [
    {
      "schema": "finding.v1",
      "producedBy": "appsec-reviewer",
      "id": "F-1",
      "severity": "high",
      "title": "Nessun blocco né rate limit sull'endpoint di login",
      "summary": "Le credenziali si possono forzare a piena velocità di richiesta.",
      "failureScenario": "Un attaccante invia 10k richieste/min a /api/login e non scatta alcun blocco.",
      "confidence": "high",
      "standard": "OWASP ASVS 5.0 V6 Authentication; CWE-307"
    }
  ]
}
```

Una review avvolge i propri finding, e ogni finding regge sul proprio contratto. `failureScenario` è
obbligatorio nello schema: un finding che non ce l'ha è una supposizione e il contratto lo rifiuta —
l'agente riceve l'errore di validazione e si autocorregge, senza che debba intervenire una persona.

### Orchestrazione

Tre meccanismi, scelti deliberatamente e non intercambiabili:

- **fan-out in sessione** per 2–6 specialisti che vuoi guidare fra un'ondata e l'altra;
- **workflow dinamici** (`workflows/*.js`) quando l'elenco degli elementi si scopre a runtime —
  audit massivi, migrazioni, review file per file — deterministici e rieseguibili;
- **fan-out headless** (`claude -p`) per la CI e per lavori più grandi del contesto di una sessione.

Gli agenti che scrivono file in parallelo girano con `isolation: worktree`; quelli in sola lettura mai.

## Requisiti

- Claude Code **2.1.x** o successivo (lo schema dei plugin usato qui — `dependencies`,
  `workflows/`, condizioni `if` negli hook, 31 eventi di hook — è dell'era 2.1).
- Node.js **20+** per il kernel. Nessun'altra dipendenza a runtime, e `npm install` non serve mai
  per usare Foundry.
- Facoltativo: [superpowers](https://github.com/obra/superpowers). Foundry gli delega sviluppo
  guidato dai test, debugging sistematico e verifica del completamento, e degrada in modo pulito
  quando non è presente.

## Contribuire

Leggi prima [AUTHORING.md](./AUTHORING.md): è normativo e la CI lo fa rispettare. Poi
[CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
node scripts/validate-assets.mjs                    # ogni asset rispetto ad AUTHORING.md
node --test 'plugins/foundry-core/test/*.test.mjs'  # test unitari del kernel
cd site && npm ci && npm run build                  # il sito di documentazione
```

## Licenza

[Apache-2.0](./LICENSE). Vedi [NOTICE](./NOTICE).

Foundry è un progetto open source indipendente. Non è affiliato, approvato o sponsorizzato da Anthropic.
