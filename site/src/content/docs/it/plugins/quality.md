---
title: foundry-quality
description: Strategia di test, contract testing ed end-to-end, ingegneria delle prestazioni, osservabilità e pratica SRE.
sidebar:
  order: 4
---

`foundry-quality` decide che cosa testare e che cosa lasciare deliberatamente non testato, tiene le
suite verdi per ragioni reali, imposta budget di performance che fanno fallire la build, e
trasforma i percorsi utente in SLO con una policy di error budget che ha conseguenze.

Non reimplementa il test-driven development. Foundry dichiara una dipendenza debole da
[superpowers](https://github.com/obra/superpowers) e gli delega la disciplina TDD, il debugging
sistematico e la verifica prima del completamento. Quando `superpowers` è assente vale la checklist
ridotta in `references/tdd-fallback.md`.

## Installazione

```bash
/plugin install foundry-quality@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Nessuno sa dire a che cosa *serve* la suite di test, oppure la copertura è inseguita come numero.
- La CI è rossa per motivi indipendenti dal cambiamento, e si rilanciano le build per farle
  diventare verdi.
- È andata in produzione una regressione di latenza o di dimensione del bundle perché nulla la
  misurava.
- L'affidabilità si discute con aggettivi invece che con un obiettivo, una finestra e un error
  budget.

## Quando non usarlo

- Non scrive codice di funzionalità. Scrive test, budget, strumentazione e policy.
- Se `superpowers` è installato, usalo per il ciclo rosso-verde-refactor vero e proprio: questo
  plugin decide *che cosa* testare, non *come* condurre un singolo cambiamento.
- Gli SLO senza telemetria di produzione sono ipotesi. `define-slo` richiede misure reali, altrimenti
  lo dichiara.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `test-strategist` | Decide che cosa testare, a quale livello e che cosa lasciare fuori — strategia guidata dal rischio per una codebase specifica, scegliendo forma a piramide o a trofeo dalla struttura reale del codice. | `opus` | `high` |
| `performance-engineer` | Prestazioni di backend e di sistema guidate dalla misura: budget e SLI fissati prima di toccare il codice, profiling che attribuisce il costo a un frame o a una query con un nome. | `opus` | `high` |
| `sre-planner` | Trasforma i percorsi utente in SLI, SLO con obiettivi motivati e una policy di error budget con conseguenze reali; progetta allarmi multi-finestra e multi-burn-rate invece di soglie grezze. | `opus` | `high` |
| `contract-tester` | Contract testing guidato dal consumatore fra servizi e fra frontend e backend, con la verifica del provider collegata alla CI del provider stesso. | `sonnet` | `medium` |
| `e2e-engineer` | Costruisce suite end-to-end che restano verdi per ragioni reali: il piccolo insieme di percorsi che vale il costo, dati di test deterministici e isolati, una policy di stubbing esplicita. | `sonnet` | `medium` |
| `observability-engineer` | Strumenta con OpenTelemetry perché gli incidenti siano diagnosticabili: log strutturati che portano trace e correlation id, metriche RED per i servizi a richiesta e USE per le risorse. | `sonnet` | `medium` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `test-plan` | Si avvia una suite di test, o un rilascio ha bisogno di un piano difendibile legato riga per riga ai criteri di accettazione di `requirement.v1`. |
| `perf-budget` | Prima di un lancio, dopo una regressione di latenza, o quando le prestazioni hanno bisogno di un gate in CI che faccia davvero fallire la build. |
| `define-slo` | L'affidabilità si discute senza un obiettivo — trasforma un percorso in SLI, uno SLO, una policy di error budget e allarmi di burn rate. |
| `quarantine-flaky` | La CI è rossa senza motivo, si rilanciano le build, o i retry stanno nascondendo instabilità. |
| `postmortem` | Dopo un incidente — una cronologia con orari, più fattori concomitanti, e azioni ciascuna con una persona e una scadenza. |

`quarantine-flaky` include `scripts/flake-report.mjs` per il passaggio di rilevamento, così
l'instabilità viene quantificata dallo storico delle esecuzioni anziché asserita.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `test-strategist` | `requirement.v1` | `plan.v1` |
| `performance-engineer` | `requirement.v1` | `plan.v1` e `finding.v1` |
| `sre-planner` | `requirement.v1` | `plan.v1` |
| `contract-tester` | `requirement.v1` | `review.v1` |
| `e2e-engineer` | `plan.v1` | `review.v1` |
| `observability-engineer` | `requirement.v1` | `review.v1` |

`postmortem` scrive inoltre un runbook Foundry, così lo stesso incidente la volta successiva ha una
procedura da seguire.

## Che cos'altro contiene

`references/tdd-fallback.md` — la checklist ridotta usata **solo** quando `superpowers` non è
installato. Dichiara esplicitamente a quale skill di superpowers ciascuna voce avrebbe delegato,
così la degradazione è visibile e non silenziosa.

## Limiti

- Il rilevamento dei test instabili richiede uno storico di esecuzioni. Su un repository senza
  storico di CI non c'è nulla da quantificare.
- I budget di performance valgono quanto la baseline. `perf-budget --baseline` va eseguito su
  hardware rappresentativo, altrimenti il gate scatterà sul rumore.
- Il contract testing richiede che entrambe le parti partecipino. Un provider che non esegue la
  verifica nella propria CI trasforma le aspettative del consumatore in documentazione, non in un
  gate.
