---
title: foundry-ai
description: Sistemi LLM e generazione augmentata da retrieval — progettazione di agenti, costruzione di pipeline RAG, misurazione della qualità con suite di valutazione, e hardening dei prompt per la produzione.
sidebar:
  order: 2.1
---

`foundry-ai` porta disciplina nei sistemi LLM: pipeline di retrieval misurate su un set di query
etichettate prima che qualsiasi prompt tocchi la generazione, topologie di agenti progettate
per i modi di fallimento prima che un singolo strumento sia esposto, suite di valutazione che
misurano invece di opinionare, e prompt versionati e testati come codice sorgente.

Non insegna la scrittura di prompt per esempi. Foundry è opinionata sulla misurazione e sui gate,
non su quale stile di istruzione vince in una leaderboard pubblica; ogni raccomandazione è
fondata sul sistema effettivamente testato, non su benchmark pubblici su dati diversi.

## Installazione

```bash
/plugin install foundry-ai@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Un sistema RAG restituisce risposte sbagliate o mancanti, e hai bisogno di dividere retrieval da
  generazione per trovare quale metà è rotta.
- Stai progettando un agente LLM e vuoi che la topologia, i budget, gli strumenti e le condizioni
  di terminazione siano ingegnerizzate prima che il modello veda un prompt.
- Un cambio di prompt sta per andare in produzione e hai bisogno di una prova che sia un
  miglioramento, non un aneddoto.
- Hai bisogno di trasformare un incidente di produzione in un test di regressione permanente.

## Quando non usarlo

- Non genera previsioni né affina il tuning di un modello. Misura e convalida.
- Il corpus è abbastanza piccolo da stare nella finestra di contesto. Mettilo nel prompt; il
  retrieval è un costo che paghi solo quando devi davvero.
- Non hai ancora traffico di produzione e nessun dato etichettato. Costruisci prima la più piccola
  suite di valutazione onesta con `build-eval-suite`; Foundry la rende ripetibile da quel momento
  in poi.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `rag-engineer` | Retrieval come problema di ricerca: audit del corpus, strategia di chunking, scelta del modello di embedding con conseguenze di reindex, retrieval ibrido lessicale+denso con rank fusion, reranking, e metriche di retrieval (recall@k, MRR, nDCG) misurate su un set di query etichettate prima che qualsiasi prompt tocchi la generazione. | `sonnet` | `medium` |
| `llm-evaluator` | Disciplina di misurazione per sistemi LLM: tassonomia di fallimento da tracce reali, dataset di riferimento congelati, controlli deterministici prima di quelli giudicati, rubric binarie, calibrazione del giudice contro etichette umane, suite di regressione non fragili in CI, e differenze riportate con intervalli di fiducia anziché come numeri singoli. | `opus` | `high` |
| `agent-architect` | Progetta sistemi LLM agente e multi-agente: selezione della topologia (singolo loop, router, supervisore, pipeline, blackboard), modellazione dello stato e checkpointing, progettazione del contratto degli strumenti, classificazione degli effetti collaterali, budget e condizioni di terminazione, gate umani nel loop, tracing e replay. | `opus` | `high` |
| `prompt-engineer` | Tratta i prompt come codice sorgente: struttura e ordine delle istruzioni, selezione di esempi few-shot, output strutturato vincolato da schema con convalida al confine e riparazione limitata, budget di contesto con una policy di troncamento che non può scartare le istruzioni, comportamento di astensione esplicita, resistenza all'iniezione per testo non affidabile, versionamento e eval diff obbligatori prima che qualsiasi cambio vada in produzione. | `sonnet` | `medium` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `build-rag-pipeline` | Avvio di una funzionalità RAG, quando un sistema RAG restituisce risposte sbagliate o vuote, prima di cambiare un modello di embedding o chunker, o quando qualcuno propone di fissare il retrieval editando il prompt. Produce un set di query versionato, una baseline misurabile e un gate di retrieval in CI. |
| `build-eval-suite` | Prima di asserire che un cambio di prompt, modello o pipeline sia un miglioramento; quando la qualità viene discussa aneddoticamente; prima di un primo rilascio di una funzionalità AI; o quando un punteggio di giudice sta per essere affidato come gate. Produce evals/ e un job in CI. |
| `design-agent-tools` | Prima di dare a un agente il suo primo strumento; quando un agente entra in loop, ritenta, usa male gli argomenti o compie un'azione che nessuno ha autorizzato; o quando aggiungi capacità di scrittura a un agente esistente. Produce documentazione di strumenti e budget in docs/agents/. |
| `harden-prompt` | Prima di cambiare un prompt vivo, quando il parsing dell'output fallisce in modo intermittente, quando un prompt vive inline nel codice applicativo, o quando è pianificato un upgrade del modello. Estrae il prompt a prompts/<name>/v<N>.md e lo racchiude con un eval diff. |

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `rag-engineer` | `requirement.v1` | `review.v1` |
| `llm-evaluator` | `requirement.v1` | `finding.v1[]` |
| `agent-architect` | `requirement.v1` | `adr.v1` |
| `prompt-engineer` | `requirement.v1` | `review.v1` |

## Che cos'altro contiene

Le directory `references/` raggruppate in ogni skill forniscono ricette concrete: strategie di
chunking per famiglia di documento (contratti, documenti API, ticket di supporto, tabelle,
trascritti), modelli di rubric per fondatezza e aderenza alle istruzioni, controlli di distorsione
del giudice (posizione, verbosità, auto-preferenza), anatomia del prompt con esempi prima/dopo
elaborati, e casi di test di iniezione.

## Limiti

- Le metriche di retrieval sono buone solo quanto il set di query etichettate. Un set di 20 query
  scritte a mano su un corpus di 10 GB è solo un'ipotesi. Foundry applica un minimo e richiede
  query di utenti reali o un set redatto da un esperto di dominio.
- Le suite di valutazione catturano regressioni, non punti ciechi nel tuo design originale. Un
  eval che punteggia solo su elementi che hai inventato tu misura la tua immaginazione, non il
  rischio reale del tuo sistema.
- I prompt sono uno fra i cinque posti dove un sistema LLM può fallire: qualità di retrieval,
  progettazione dello strumento, gestione dello stato, il modello stesso e il prompt. Un cambio di
  prompt dell'1% non risolverà un fallimento di retrieval del 50%, e questo agente te lo dirà.
- I budget di performance e l'analisi di latenza appartengono a `foundry-quality:performance-engineer`,
  non qui. Foundry-ai è opinionata sulla qualità, non sui costi.
