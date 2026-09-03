---
title: foundry-core
description: Il kernel — memoria governata, contratti di I/O, hook di guardia, il server MCP di Foundry e la CLI foundry.
sidebar:
  order: 1
---

`foundry-core` è l'unico plugin obbligatorio. Ogni altro plugin Foundry dichiara
`dependencies: [foundry-core]`, quindi installando una qualsiasi verticale il kernel arriva con
essa.

Non contiene competenza di dominio. Contiene il meccanismo su cui le verticali si appoggiano: i
livelli di memoria, i dieci schemi JSON che gli agenti si passano, gli hook che bloccano le
affermazioni non verificate e i ritorni sovradimensionati dei subagent, il server MCP che rende
economico il recupero della memoria, e la riga di comando `foundry`.

## Installazione

```bash
/plugin marketplace add fedcal/foundry
/plugin install foundry-core@foundry
```

`foundry-core` è l'unico plugin con `defaultEnabled: true`.

## Quando installarlo

Sempre — è obbligatorio. La domanda vera è che cosa installare *accanto* a esso. Se vuoi soltanto
memoria, contratti e gate, installa `foundry-core` da solo: è utile con zero verticali. Ogni
verticale aggiunta costa token di discovery all'avvio della sessione, quindi vanno aggiunte in modo
deliberato e non installando `full`.

## Quando non usarlo

- Se non vuoi che nessun hook blocchi mai una chiamata a uno strumento, non installarlo. I gate
  sono il punto centrale; disattivandoli tutti resta poco. Vedi
  [Hook](/foundry/it/reference/hooks/) per il percorso di override per singolo gate e per
  l'impostazione `enforcement: off`.
- Non gestisce le dipendenze, non esegue i test e non fa deploy. Registra, valida e blocca.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `foundry-orchestrator` | Pianifica ed esegue lavoro multi-agente a ondate seguendo un playbook, applica il gate contrattuale fra un'ondata e l'altra e mantiene piccolo il contesto del chiamante. | `opus` | `high` |
| `context-broker` | Cerca in memoria, runbook, ADR e codebase, poi restituisce un briefing di al massimo 300 token invece di riversare file. | `haiku` | `low` |
| `memory-curator` | Estrae i fatti durevoli da una sessione, li deduplica, ritira ciò che non è più vero e tiene l'indice dentro il suo budget di token. | `haiku` | `low` |
| `runbook-author` | Scrive e revisiona i runbook operativi dopo un lavoro destinato a ripetersi — deploy, incidenti, migrazioni, rilasci. | `sonnet` | `medium` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `foundry-init` | Il progetto non ha ancora una directory `.foundry/`, `foundry doctor` segnala stato mancante, o l'utente chiede di configurare Foundry qui. Invocabile solo dall'utente (`disable-model-invocation: true`). |
| `memory` | È appena stata stabilita una decisione o un vincolo, serve sapere che cosa era stato deciso prima, o l'indice supera il suo budget. |
| `orchestrate` | Un compito richiede più specialisti in parallelo con gate fra le fasi, o l'utente chiede di parallelizzare o di eseguire un ciclo completo. |
| `runbook` | Prima di qualunque attività ricorrente o soggetta a errori, e subito dopo averne conclusa una che qualcuno dovrà ripetere. |
| `contracts` | Si scrive sulla blackboard, arriva un errore di validazione contrattuale, o si progetta l'output di un nuovo agente. |
| `handoff` | Si conclude un compito delegato, si chiude un'ondata, o si sospende un lavoro che riprenderà qualcun altro. |
| `token-budget` | Una sessione sembra costosa, si sta per iniziare un lavoro lungo, o l'utente chiede del costo o della pressione sul contesto. |

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `foundry-orchestrator` | `plan.v1` | `handoff.v1` |
| `context-broker` | compito o domanda in linguaggio naturale | `handoff.v1` in `.foundry/blackboard/context/context-broker.json` più un briefing di al massimo 300 token |
| `memory-curator` | trascritto di sessione più la memoria esistente letta via MCP | voci `fact.v1` scritte tramite `memory_write`, poi indice ricostruito; restituisce un conteggio, non un elenco |
| `runbook-author` | il trascritto del lavoro appena svolto, più il runbook esistente se lo si sta rivedendo | un file markdown in `.foundry/runbooks/<slug>.md` |

## Che cos'altro contiene

### Contratti

Dieci file JSON Schema 2020-12 in `plugins/foundry-core/schemas/`: `fact.v1`, `finding.v1`,
`adr.v1`, `plan.v1`, `requirement.v1`, `risk.v1`, `estimate.v1`, `compliance-check.v1`,
`review.v1`, `handoff.v1`. L'elenco completo dei campi è in
[Contratti](/foundry/it/reference/contracts/).

### Hook

Nove script di hook collegati tramite `hooks/hooks.json` su otto eventi: `SessionStart`, `UserPromptSubmit`,
`PreToolUse` (Bash e Write/Edit/NotebookEdit), `PostToolUse`, `SubagentStop`, `Stop`,
`PreCompact` e `SessionEnd`. Vedi [Hook](/foundry/it/reference/hooks/).

### Server MCP

`mcp/server.mjs`, registrato come server `foundry` tramite `.mcp.json`. Stdio, JSON-RPC 2.0,
protocollo `2025-06-18`, zero dipendenze. Nove strumenti e un elenco di risorse. Vedi
[Strumenti MCP](/foundry/it/reference/mcp/).

### CLI

`bin/foundry.mjs`, disponibile su PATH come `foundry` una volta installato il plugin. Vedi
[CLI](/foundry/it/reference/cli/).

### Workflow

Workflow dinamici in `workflows/`, per il lavoro il cui elenco di elementi si conosce solo a
runtime.

| Workflow | `meta.name` | Fasi | Quando usarlo |
|---|---|---|---|
| `feature-delivery.js` | `foundry-feature-delivery` | Analysis, Implementation, Convergence | Una funzionalità che tocca architettura, frontend, backend e dati, dove le parti possono essere costruite in parallelo una volta concordati i contratti. |
| `audit-sweep.js` | `foundry-audit-sweep` | Scope, Audit, Verify, Synthesise | Audit di codebase in cui l'elenco degli elementi si scopre a runtime e ogni risultato deve sopravvivere a un tentativo di confutazione. |
| `compliance-sweep.js` | `foundry-compliance-sweep` | Profile, Assess, Report | Analisi dei gap di conformità in cui ogni controllo viene valutato su evidenze reali anziché presunte. |

I file di workflow girano nel runtime dei workflow di Claude Code: `Date.now()`, `new Date()` e
`Math.random()` sollevano un'eccezione, quindi i timestamp vanno passati tramite `args`.

### Playbook

Definizioni dichiarative di ondate in YAML dentro `playbooks/`, usate dalla skill `orchestrate` e
dall'agente `foundry-orchestrator`.

| Playbook | Ondate | Gate applicati |
|---|---|---|
| `feature-delivery.yaml` | `analysis`, `implementation`, `convergence` | tutti gli artefatti validi; requisiti con criteri di accettazione; ogni minaccia con una mitigazione e un test; test scritti prima dell'implementazione; il comando di test del progetto passa; nessun criterio di accettazione simulato |
| `audit.yaml` | `scope`, `audit`, `verify`, … | ambito delimitato; ogni risultato ha uno scenario di fallimento; avanzano solo i risultati non confutati |

Il playbook di audit esegue `evidence-verifier` per ogni risultato con `opus`/`xhigh` e due lenti
(confutazione, raggiungibilità), e in caso di evidenza ambigua ricade su *refuted*.

### Stili di output

| Stile | Registro |
|---|---|
| `Foundry Senior Engineer` | Diretto, prima l'evidenza, esplicito su incertezze e compromessi. |
| `Foundry Analyst` | Mostra il modello, separa i fatti dalle assunzioni, dichiara che cosa cambierebbe la conclusione. |
| `Foundry PMO` | Stato rispetto al piano, rischi con un responsabile, previsioni come intervalli, cattive notizie subito. |

## Configurazione

`foundry init` scrive `.foundry/config.json`. I valori predefiniti, come implementati in
`plugins/foundry-core/lib/foundry.mjs`:

| Chiave | Predefinito | Effetto |
|---|---|---|
| `enforcement` | `gate` | `gate` blocca, `warn` degrada i dinieghi a una richiesta all'utente, `off` disattiva del tutto le guardie. |
| `indexTokenBudget` | `4000` | Tetto rigido su `.foundry/memory/INDEX.md`; i fatti oltre budget vengono omessi dall'indice, non cancellati. |
| `handoffSummaryTokenBudget` | `300` | Obiettivo per il riassunto restituito da un subagent. Il gate `SubagentStop` nega al triplo di questo valore. |
| `secretScan` | `true` | Attiva i pattern di credenziali nella guardia in scrittura. |
| `verifyOnStop` | `true` | Attiva il gate `verify-before-claiming`. |
| `protectedPaths` | `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `db/migrations/**` | Le scritture qui vengono escalate all'utente. |
| `memoryRetrieval` | `{ maxFacts: 8, minScore: 1 }` | Predefiniti per `memory_search`. |

## Limiti

- I conteggi di token sono stime a circa quattro caratteri per token, non output di un tokenizer.
  Bastano per far rispettare i budget; per il consumo fatturato usa `/cost` e `/usage`.
- `memory_search` è punteggio per parole chiave, non ricerca semantica. Un fatto il cui titolo usa
  parole diverse dalla tua query può non emergere.
- Il gate `Stop` legge le ultime 400 righe del trascritto. Un comando di verifica eseguito molto
  prima in un turno lunghissimo può non essere visto.
