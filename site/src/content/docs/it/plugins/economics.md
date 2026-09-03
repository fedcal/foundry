---
title: foundry-economics
description: Ingegneria dei costi di progetto, TCO e business case, FinOps cloud, controllo della spesa AI e finanza agevolata.
sidebar:
  order: 7
---

`foundry-economics` mette numeri sulle decisioni: quanto costerà il lavoro, quanto costa far girare
un sistema, quanto costa far girare l'AI stessa, e se la cosa valga la pena di essere costruita.

Ogni stima che produce è un intervallo a tre punti con le assunzioni scritte, perché un numero
singolo presentato senza assunzioni è un'ipotesi in giacca e cravatta.

## Installazione

```bash
/plugin install foundry-economics@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Qualcuno chiede "quanto costerà", "quanto ci vorrà", "qual è il TCO" o "siamo dentro il budget".
- La bolletta del cloud cresce e nessuno riesce ad attribuirla a una funzionalità o a una
  richiesta.
- Vuoi sapere quanto ti costa Claude Code, quale modello dovrebbe usare un agente, o se il prompt
  caching convenga.
- Va preparato un budget di progetto per un bando, la struttura per una call pubblica, i timesheet
  o la rendicontazione per milestone.

## Quando non usarlo

- Sono stime ingegneristiche, non contabilità. Nulla di quanto prodotto è un bilancio certificato o
  una consulenza fiscale.
- Non sequenzia il lavoro — quello è `roadmap-planner` in `foundry-pmo`.
- L'analisi dei costi cloud ha bisogno dei dati di fatturazione. Senza, `finops-analyst` ragiona
  sull'architettura, non sulla tua bolletta reale.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `cost-engineer` | Ingegneria dei costi di progetto: scompone il lavoro, produce stime a tre punti e risponde a "quanto", "quanto tempo", "qual è il TCO", "costruire o comprare". | `opus` | `high` |
| `business-case-analyst` | Business case e piano finanziario: se costruire qualcosa, il punto di pareggio, i numeri che servono a un documento per finanziatori o consiglio. | `opus` | `high` |
| `finops-analyst` | Analisi dei costi di esercizio di cloud e infrastruttura: perché la spesa è salita, quanto ci costa una richiesta, se convenga acquistare capacità riservata. | `opus` | `high` |
| `funding-analyst` | Meccanica dei bandi e della finanza agevolata: budget di progetto, strutturazione per una call pubblica, timesheet ed evidenze, rendicontazione per milestone. | `opus` | `high` |
| `ai-cost-controller` | Il costo di far girare l'AI stessa: quanto costa Claude Code, quale modello dovrebbe usare un agente, economia del prompt caching, budget di token per workflow. | `sonnet` | `medium` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `estimate-project` | Una sessione di stima strutturata: scomporre il lavoro, raccogliere intervalli a tre punti, calcolare il valore atteso PERT e p50/p80/p95, verificare la plausibilità. |
| `tco-model` | Un modello di costo totale di proprietà pluriennale su un orizzonte dichiarato, con attualizzazione e le voci di costo che le squadre dimenticano regolarmente. |
| `business-plan` | Un piano finanziario: proiezione di conto economico, flusso di cassa, pareggio, economia unitaria, VAN/TIR a un tasso di sconto dichiarato, con scenari e tabella di sensibilità. |
| `ai-spend-report` | Un report della spesa AI e di token da metriche reali — attribuzione per agente e per funzionalità, spreco da retry, economia del prompt cache, budget di token. |
| `budget-tracking` | Impostare e condurre il monitoraggio budget rispetto a consuntivo con analisi degli scostamenti a valore realizzato, previsione a finire e una soglia di escalation concordata. `setup` una volta, poi `review --period AAAA-MM`. |

`tco-model` e `business-plan` accettano `--horizon` e `--rate` espliciti, così il tasso di sconto è
un input dichiarato e non un'assunzione nascosta.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `cost-engineer` | `plan.v1` | `estimate.v1` |
| `business-case-analyst` | `estimate.v1` | `estimate.v1` |
| `finops-analyst` | `estimate.v1` | `estimate.v1` |
| `funding-analyst` | `estimate.v1` | `compliance-check.v1` — gli obblighi del programma di finanziamento valutati come controlli |
| `ai-cost-controller` | `estimate.v1`, facoltativo, più la strumentazione del progetto | `estimate.v1`, una voce per unità di attribuzione (funzionalità, agente o workflow) |

`estimate.v1` richiede `scope`, almeno una voce in `items` con `optimistic`, `likely` e
`pessimistic`, e almeno una voce in `assumptions`. Una stima senza assunzioni dichiarate non può
essere scritta sulla blackboard: lo schema la respinge.

## Il ciclo del costo AI

`ai-cost-controller` e `ai-spend-report` leggono ciò che `foundry-core` registra. Ogni
`memory_search`, `memory_write`, `blackboard_write`, blocco di un gate, ritorno di subagent e fine
sessione viene accodato in `.foundry/metrics/events.jsonl`, e lo strumento MCP `token_report` e il
comando `foundry tokens` lo riassumono. Così "quale agente è costoso" diventa una misura anziché
un'opinione.

## Limiti

- I valori di token sono stimati a circa quattro caratteri per token. Sono coerenti abbastanza da
  confrontare gli agenti fra loro; per gli importi fatturati usa `/cost` e `/usage`.
- `.foundry/metrics/` è escluso da git da `foundry init`, quindi lo storico resta locale alla
  macchina a meno che tu non lo raccolga deliberatamente.
- La valuta predefinita è l'euro in `estimate.v1` e in `risk.v1` (`impactEur`). Altre valute sono
  esprimibili in `estimate.v1` tramite `currency`, ma il campo di esposizione dello schema dei
  rischi è nominato in euro.
- Le regole di finanziamento cambiano per programma e per bando. `funding-analyst` produce la
  struttura delle evidenze e la meccanica di budget; non certifica l'ammissibilità.
