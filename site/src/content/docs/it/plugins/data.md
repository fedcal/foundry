---
title: foundry-data
description: Data science e machine learning classico — analisi esplorativa che arriva a un verdetto, baseline prima dei modelli, valutazione oltre l'accuratezza, e notebook trasformati in sistemi di produzione.
sidebar:
  order: 2.2
---

`foundry-data` copre il lavoro che accade prima e dopo l'addestramento di un modello: profilare un
dataset fino a poter dire se è in grado di rispondere alla domanda posta, rifiutare di addestrare
un modello complesso prima che esista una baseline banale, valutare oltre la singola metrica di
copertina, e trasformare un notebook in qualcosa che continua a funzionare quando nessuno lo
guarda.

Rileva lo stack invece di presupporlo. Il data mining in questo ecosistema è tanto spesso Java
scritto a mano — alberi di decisione, alberi di regressione, pattern miner — quanto un notebook
pandas, e ogni agente esegue un controllo dell'ecosistema prima di scegliere strumenti e
terminologia. Anche le pipeline R e quelle solo-SQL vengono riconosciute.

## Installazione

```bash
/plugin install foundry-data@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Arriva un dataset senza documentazione e qualcuno vuole un modello costruito sopra entro la
  settimana.
- Un notebook riporta un'accuratezza che nessuno riesce a riprodurre, o così alta da essere
  sospetta.
- È stata riportata solo l'accuratezza, su un problema sbilanciato, senza confronto con una
  baseline e senza suddivisione per sottogruppo.
- Un modello sta per passare dal portatile di qualcuno a un job schedulato o a un endpoint di
  servizio, e niente versiona i dati su cui è stato addestrato.

## Quando non usarlo

- Non costruisce sistemi LLM o di retrieval. Quelli sono `foundry-ai`: pipeline RAG, topologie di
  agenti, hardening dei prompt e valutazione con giudice.
- Non costruisce la piattaforma dati sottostante. Modellazione del warehouse, ingestion e
  performance delle query appartengono a `foundry-dev`.
- La domanda è una metrica di business che qualcuno può calcolare con una query SQL. Un modello
  non è la risposta a ogni domanda, e questi agenti lo dicono.

## Agenti

| Agente | Cosa fa | Modello | Sforzo |
|---|---|---|---|
| `data-analyst` | Analisi esplorativa come disciplina: profilazione del dataset, controlli di integrità e qualità, valori mancanti caratterizzati per meccanismo e non per percentuale, metodo per gli outlier scelto per famiglia di colonne, leakage temporale e del target cercati deliberatamente, e statistiche riportate con dimensione dell'effetto, intervallo di confidenza e numerosità campionaria invece che con un p-value nudo. Arriva a un verdetto esplicito sulla capacità dei dati di rispondere alla domanda posta. | `sonnet` | `medium` |
| `ml-engineer` | Costruzione di modelli che generalizzano: una baseline banale prima di qualsiasi cosa complessa, strategia di split scelta per la struttura reale dei dati (i.i.d., raggruppata o temporale, trattate come tre casi diversi), pipeline a prova di leakage con feature engineering dentro il fold, tuning che non tocca mai il test set, e seed, versioni dei pacchetti e snapshot dei dati registrati perché il numero sia riproducibile. | `sonnet` | `medium` |
| `model-evaluator` | Valutazione oltre l'accuratezza: famiglia di metriche adatta al problema e alla sua struttura di costo, matrice di confusione ed error analysis sugli errori reali, calibrazione delle probabilità, performance suddivisa per sottogruppo con il conteggio delle righe, confronto con una baseline banale ripresentato con la sua incertezza, e drift fra i dati di addestramento e quelli correnti. | `sonnet` | `medium` |
| `mlops-engineer` | Lo scarto fra «funziona sulla mia macchina» e «continua a funzionare senza sorveglianza»: versionamento di dati e modelli, tracciamento degli esperimenti, run riproducibili, pattern di serving scelto per come girerà davvero, monitoraggio sia della salute di sistema sia della qualità del modello, trigger di riaddestramento, e un percorso di rollback provato e non solo documentato. | `sonnet` | `medium` |

## Skill

| Skill | Quando scatta |
|---|---|
| `explore-dataset` | All'avvio di una nuova analisi o di un progetto ML, quando un dataset viene consegnato senza documentazione, prima che una pipeline venga costruita sopra, o quando un'accuratezza sospettamente alta richiede una spiegazione. Produce `docs/data/<dataset>.profile.md` e una checklist sul leakage. |
| `train-model` | Dopo che un dataset è stato esplorato e giudicato sufficiente, prima di scrivere «il modello raggiunge X%» da qualche parte, o quando qualcuno propone più complessità di modello senza un confronto con la baseline. Produce `docs/models/<model>.card.md` e un training run versionato. |
| `evaluate-model` | Prima che un modello sia approvato per la produzione, prima che uno stakeholder ripeta un valore di accuratezza o R² in riunione, quando la metrica è stata scelta prima di capire il problema, o quando la performance per sottogruppo non è mai stata verificata. Produce `docs/models/<model>.evaluation.md`. |
| `productionise-notebook` | Quando un notebook produce un risultato su cui qualcuno vuole contare ripetutamente, quando non può essere rieseguito dall'inizio alla fine riproducendo il proprio output, o quando non c'è alcun piano per accorgersi che un modello in produzione è diventato obsoleto. Produce moduli con test, un manifesto di ambiente con versioni fissate e una checklist di monitoraggio. |

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `data-analyst` | `requirement.v1` | `review.v1` |
| `ml-engineer` | `plan.v1` | `review.v1` |
| `model-evaluator` | `review.v1` | `review.v1` |
| `mlops-engineer` | `review.v1` | `review.v1` |

La catena è deliberata: `data-analyst` profila, `ml-engineer` addestra contro quel profilo,
`model-evaluator` ricava in modo indipendente ciò che `ml-engineer` ha riportato, e
`mlops-engineer` rifiuta di rilasciare senza il via libera dell'evaluator — oppure rilascia
dichiarando esplicitamente che il rilascio è condizionato ad esso.

## Cos'altro contiene

Ogni skill porta con sé una cartella `references/` con ricette concrete: file marker per il
riconoscimento dell'ecosistema e una tabella di equivalenza fra strumenti pandas/Weka/Smile/R, un
catalogo di dodici pattern di leakage con sintomo, verifica e correzione, ricette per valori
mancanti e outlier per famiglia di colonne, strategie di validazione per i tre casi di split,
ricette di baseline per tipo di task (con i corrispettivi `ZeroR` e `Dummy*` nominati), famiglie
di metriche con una tabella «quando ingannano», procedure di calibrazione e per sottogruppo, un
playbook di error analysis, una checklist da notebook a moduli, riproducibilità e packaging per
ecosistema (pip, Maven, Gradle, renv), e i controlli minimi di monitoraggio.

## Limiti

- Baseline e split sono verificabili; la conoscenza di dominio no. Questi agenti possono provare
  statisticamente che una feature perde il target, ma non possono dirti che una colonna non è
  disponibile al momento della predizione nel tuo processo di business. Quell'informazione è tua.
- La misura di equità richiede le etichette di sottogruppo. Dove un attributo protetto non è
  registrato — spesso per buone ragioni legali — la valutazione dichiara che la suddivisione è
  impossibile invece di riportare un numero che non può calcolare.
- Il rilevamento del drift confronta distribuzioni, non le spiega. Uno scostamento segnalato è un
  invito a indagare, non una conclusione.
- Nessuna versione di libreria, dataset o benchmark pubblico viene asserita in questo plugin. Ogni
  ricetta prescrive il rilevamento a runtime da lockfile, `dependency:tree` o file marker, perché
  una versione scritta dentro un asset è obsoleta la settimana dopo il rilascio.
