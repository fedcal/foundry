---
title: foundry-pmo
description: Governo di roadmap e milestone, salute del backlog, requisiti, registro dei rischi, eventi Scrum, metriche di flusso e forecasting, operazioni sui tracker fra GitHub, Jira, Linear e GitLab, e reportistica di stato.
sidebar:
  order: 6
---

`foundry-pmo` è lo strato di project office: trasformare le intenzioni in requisiti verificabili,
sequenziare il lavoro sulla capacità reale, tenere un backlog e un registro dei rischi che vengano
davvero usati, e riportare lo stato a partire dai dati del repository anziché dall'ottimismo.

Tutto ciò che produce è un artefatto contrattuale: roadmap, requisiti e registro dei rischi sono
verificabili da una macchina, non una slide.

## Installazione

```bash
/plugin install foundry-pmo@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- I requisiti esistono solo come conversazione e il "fatto" si decide a posteriori.
- La roadmap ha date ma nessun criterio di uscita, nessuna analisi delle dipendenze e nessuna base
  di capacità.
- Il backlog contiene elementi che nessuno prenderà mai in carico e duplicati che nessuno ha
  notato.
- I rischi si discutono ma non hanno un responsabile, non sono quantificati e non vengono
  rivisti.
- I report di stato si scrivono a mano e non concordano con il repository.
- Gli sprint finiscono senza uno Sprint Goal e il lavoro non concluso scivola avanti senza essere
  ridecido.
- Qualcuno sta per impegnarsi su una data unica di consegna senza throughput misurato alle spalle.
- Il lavoro vive su Jira, Linear o GitLab e ogni report va ricostruito a mano per ciascuno
  strumento.

## Quando non usarlo

- Su un progetto individuale con orizzonte breve gran parte di questo è sovraccarico. Il profilo
  `startup-mvp` lo esclude deliberatamente.
- Non stima i costi in denaro — quello è `foundry-economics`. `roadmap-planner` sequenzia;
  `cost-engineer` mette il prezzo.
- `github-operator` ha bisogno della CLI `gh` autenticata. Senza, l'agente dichiara la mancanza e
  ripiega sul descrivere le modifiche invece di applicarle.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `requirements-analyst` | Trasforma le intenzioni degli stakeholder in requisiti verificabili: story mapping, criteri di accettazione Dato/Quando/Allora, requisiti non funzionali con obiettivi misurabili, tracciabilità. | `opus` | `high` |
| `roadmap-planner` | Costruisce una roadmap che sopravvive all'impatto con la realtà: milestone formulate come esiti con criteri di uscita, analisi delle dipendenze e del percorso critico, sequenziamento basato sulla capacità. | `opus` | `high` |
| `risk-manager` | Mantiene un registro dei rischi che viene usato: individuazione guidata per categoria, probabilità per impatto quantificati in denaro e tempo, mitigazioni con un responsabile e una data di revisione. | `opus` | `high` |
| `backlog-manager` | Tiene sano il backlog: spezzare gli elementi sovradimensionati con SPIDR, definition of ready e of done, limiti di WIP, ritiro degli elementi invecchiati, rilevamento dei duplicati. | `sonnet` | `medium` |
| `github-operator` | Gestisce un repository tramite la CLI `gh`: tassonomia delle label, milestone, campi e viste di Projects v2, branch protection e ruleset, template di issue e PR, check obbligatori. | `sonnet` | `medium` |
| `delivery-reporter` | Produce un report di stato su cui uno stakeholder può agire: avanzamento rispetto a `plan.v1` letto da dati reali del repository, burn-up anziché burn-down, blocchi con responsabile e anzianità. | `sonnet` | `medium` |
| `scrum-facilitator` | Conduce e ripara gli eventi Scrum come li definisce la Scrum Guide 2020, separa le regole del framework dalle abitudini scambiate per regole, e classifica ciò che la squadra fa davvero come Scrum, Kanban o un ibrido senza nome. | `sonnet` | `medium` |
| `flow-analyst` | Misura la consegna empiricamente — percentili di cycle time, throughput, WIP, lavoro in corso che invecchia, legge di Little, le quattro chiavi DORA — e fa forecasting Monte Carlo sul throughput misurato. Rifiuta le date singole e le metriche per persona. | `sonnet` | `medium` |
| `tracker-operator` | Legge e modifica GitHub, Jira, Linear o GitLab con un'unica interfaccia, rileva il provider in uso e normalizza tutto in `tracker-item.v1`, così a valle nessuno tocca il payload di un provider. | `sonnet` | `medium` |
| `slack-operator` | Rende Slack una superficie di lavoro: tassonomia dei canali con responsabile, politica di soppressione, messaggi Block Kit che mettono la richiesta per prima, protocollo per i canali di incidente, scope a privilegio minimo e un audit misurato della fatica da alert. | `sonnet` | `medium` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `write-requirements` | Si raccolgono e si registrano requisiti come `requirement.v1` applicando la checklist delle ambiguità. |
| `roadmap` | Si avvia un progetto, si pianifica un trimestre, o è scattato un trigger di ripianificazione. Produce `plan.v1` più un `ROADMAP.md` leggibile. |
| `groom-backlog` | Una sessione di grooming reale sul tracker vero — spezzare, stimare per intervalli, ordinare per densità di valore, chiudere gli elementi fermi. |
| `github-setup` | Si prepara il governo del repository con `gh`: label, milestone, una board Projects v2, branch protection, template e check obbligatori. Idempotente. |
| `status-report` | Si genera un report di stato da dati reali di repository e piano — burn-up rispetto a `plan.v1`, avanzamento dei gate con l'output effettivo dei check, blocchi con anzianità misurata. |
| `risk-review` | Una revisione periodica dei rischi — rivalutare gli artefatti `risk.v1` esistenti, individuare nuovi rischi con prompt per categoria, confrontare i segnali di rilevamento con dati reali del repository, escalare ciò che si è mosso. |
| `run-sprint` | Uno sprint dall'inizio alla fine, con un gate per fase: una Planning che produce lo Sprint Goal prima di selezionare gli elementi, un Daily che ripianifica, una Review che cambia il backlog e una chiusura che restituisce il lavoro non concluso invece di farlo scivolare. |
| `run-retrospective` | Una retrospettiva che finisce con un solo cambiamento, con responsabile e data — prima le evidenze dalla board, poi le opinioni; formato scelto per la situazione, riscrittura blameless e verifica che l'azione del ciclo precedente sia davvero avvenuta. |
| `forecast-delivery` | Forecasting Monte Carlo sul throughput misurato, crescita di ambito inclusa, più percentili di cycle time, WIP, lavoro che invecchia e le quattro chiavi DORA. Emette p50/p85/p95, mai una data sola. |
| `sync-tracker` | Rileva il provider, legge la board e normalizza ogni elemento in `tracker-item.v1` — mappando sulle categorie di stato stabili anziché su nomi rinominabili, e dichiarando ciò che non è riuscita a mappare. |
| `jira-setup` | Porta un progetto Jira Cloud sotto governo con chiamate idempotenti alle API REST v3 e Agile: tipi di issue, un workflow con gli stati nelle categorie giuste, campi risolti per nome, board, sprint e filtri JQL salvati. |
| `slack-workflow` | Collega gli eventi di consegna a Slack senza creare un canale che nessuno legge: tassonomia, politica di soppressione decisa prima dell'integrazione, pattern Block Kit, protocollo di incidente e audit misurato della fatica da alert. |

`groom-backlog`, `github-setup` e `status-report` accettano tutte `--dry-run` o un argomento di
ambito esplicito, così nulla viene applicato per sbaglio a un tracker vivo.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `requirements-analyst` | intenzioni degli stakeholder in qualunque forma grezza — trascritto, corpo di una issue, appunto di riunione, insieme di ticket. Per le intenzioni non esiste uno schema. | `requirement.v1`, un artefatto per requisito |
| `roadmap-planner` | `requirement.v1` | `plan.v1` |
| `risk-manager` | `plan.v1` | `risk.v1` |
| `backlog-manager` | `requirement.v1` | `plan.v1` |
| `github-operator` | `plan.v1` | `handoff.v1` |
| `delivery-reporter` | `plan.v1` e `requirement.v1` | `handoff.v1` |
| `scrum-facilitator` | `plan.v1`, `tracker-item.v1` | `review.v1` |
| `flow-analyst` | `tracker-item.v1`, `plan.v1` | `review.v1` |
| `tracker-operator` | `plan.v1`, `requirement.v1` | `tracker-item.v1` e `handoff.v1` |
| `slack-operator` | `handoff.v1`, `risk.v1`, `finding.v1` | `handoff.v1` |

`requirement.v1` richiede almeno un criterio di accettazione in forma Dato/Quando/Allora e una
`priority` MoSCoW. Un requisito senza un criterio testabile viene respinto dal contratto, non da un
revisore.

`risk.v1` richiede `probability`, `impactEur`, `mitigation`, `owner` e `status`. Un rischio senza
responsabile non può essere scritto sulla blackboard.

`tracker-item.v1` è l'elemento di lavoro provider-indipendente. Le metriche di flusso, i forecast e i
report di sprint lo leggono e non toccano mai un payload di provider, così cambiare tracker riscrive
una sola tabella di mappatura invece di ogni consumer. Qualunque cosa non possa essere mappata
onestamente diventa `unmapped` con la parola del provider stessa preservata accanto — una
normalizzazione che segnala zero elementi unmapped su una board reale ha quasi certamente forzato
valori nel bucket più vicino.

## Limiti

- `github-operator` e `github-setup` sono specifici di GitHub e richiedono un `gh` autenticato.
  `tracker-operator` copre GitHub, Jira Cloud, Linear e GitLab; Azure DevOps non è coperto.
- Il cycle time richiede la cronologia delle transizioni. Quando quella di un tracker non è
  leggibile, `flow.historyRead` è false e ogni valore ripiega sul lead time — dichiarato, mai
  in silenzio.
- Il forecasting Monte Carlo richiede almeno sei periodi completi. Sotto quella soglia produce
  comunque una previsione, con un intervallo più ampio etichettato `low-confidence`, perché al
  silenzio qualcuno sostituisce una supposizione.
- `flow-analyst` rifiuta le metriche per persona e i forecast a data singola. Entrambi i rifiuti
  sono deliberati e non sono configurabili.
- `slack-operator` non posta mai su un canale che non sia stato confermato per nome e tratta
  `channels:history` come uno scope audit-only piuttosto che una concessione permanente.
- La reportistica burn-up vale quanto l'igiene delle issue sottostante. Su un tracker dove gli
  elementi si chiudono in blocco a fine sprint, il grafico sarà onesto e inutile.
- Il sequenziamento basato sulla capacità richiede che qualcuno dichiari la capacità. L'agente
  chiede invece di presumere la dimensione della squadra.
