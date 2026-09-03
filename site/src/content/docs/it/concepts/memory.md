---
title: Memoria
description: I quattro livelli, lo schema di un fatto, deduplicazione e catene di supersedes, scadenza invece di cancellazione e che cosa succede quando l'indice supera il budget di token.
sidebar:
  order: 2
---

Un agente capace che dimentica la decisione della settimana scorsa non è un collega. La memoria di
Foundry esiste per rendere la prossima sessione più economica e più informata di questa — e il suo
vincolo centrale è che ricordare di più non deve costare di più per sessione.

## Quattro livelli

Non inventarne un quinto. Ogni livello è definito da quanto vivono i suoi contenuti e da se
appartengono a git.

| Livello | Percorso | Durata | In git | Che cosa ci va |
|---|---|---|---|---|
| T0 scratch | `.foundry/scratch/<sessione>/` | una sessione | no | File di lavoro, output intermedi, tutto ciò che cancelleresti senza chiedere |
| T1 fatti | `.foundry/memory/facts/<id>.md` | il progetto | sì | Fatti atomici e durevoli, uno per file |
| T2 runbook | `.foundry/runbooks/<slug>.md` | il progetto | sì | Procedure che qualcuno ripeterà |
| T3 decisioni | `docs/adr/NNNN-<slug>.md` | per sempre | sì | Decisioni architetturali, permanenti e pubbliche |

T3 sta fuori da `.foundry/` di proposito. Un ADR è un documento per persone, rivisto nelle pull
request e letto da chi non ha mai sentito nominare Foundry.

Accanto ai livelli c'è `.foundry/blackboard/`, che non è memoria: contiene artefatti validati che
gli agenti si passano dentro una singola esecuzione. Vedi
[Contratti](/foundry/it/concepts/contracts/).

## Lo schema di un fatto

Un fatto è un file markdown il cui frontmatter porta i metadati e il cui corpo porta l'affermazione.

```markdown
---
id: fact-0004
type: decision
scope: project
title: PostgreSQL 16 is the only supported database
tags: [database, postgres, migrations]
confidence: high
source: adr-0004
created: 2026-08-27
expires: null
supersedes: fact-0002
---

**Why:** we depend on MERGE and partition-wise joins; MySQL 8 has neither, and the
abstraction layer that would hide the difference costs more than supporting one engine.
**How to apply:** write migrations as plain SQL under `src/main/resources/db/migration`
and run integration tests against `postgres:16-alpine`.
```

| Campo | Valori | Note |
|---|---|---|
| `id` | `fact-NNNN` | Assegnato da `memory_write`, mai scelto da te. Quattro cifre con zeri iniziali, allocato come il numero più alto esistente più uno |
| `type` | `decision`, `constraint`, `convention`, `domain`, `risk`, `metric`, `glossary` | Controlla anche l'ordinamento nell'indice e il punteggio in recupero |
| `scope` | `project`, `module:<nome>`, `vertical:<nome>` | Testo libero; default `project` |
| `title` | ≤ 80 caratteri | Enuncia il fatto stesso, non l'argomento. "PostgreSQL 16 is the only supported database" è un titolo; "Scelta del database" no |
| `tags` | lista di stringhe | Pesano 2 nel punteggio di recupero: i tag sono uno strumento di ricerca, non decorazione |
| `confidence` | `high`, `medium`, `low` | Moltiplica il punteggio per 1,15, 1,0 e 0,8 |
| `source` | `adr-0007`, `conversation`, `code`, `external:<url>` | Da dove viene l'affermazione |
| `created` | `YYYY-MM-DD` | Impostato alla scrittura del fatto |
| `expires` | `YYYY-MM-DD` oppure `null` | La data in cui il fatto smette di essere attivo |
| `supersedes` | un id di fatto oppure `null` | Mantenuto automaticamente quando un fatto sostituisce uno con lo stesso titolo |

I corpi dovrebbero restare intorno alle 120 parole. I fatti di tipo `decision` e `risk` devono
contenere letteralmente una riga `**Why:**` — `foundry doctor` cerca esattamente quella stringa e
fallisce se manca — e per convenzione una riga `**How to apply:**`, così che una decisione
registrata cambi il comportamento invece di limitarsi a esistere.

:::note[Lo schema fact.v1 non è il formato del file]
Lo schema `fact.v1` richiede `schema` e `producedBy`, che `memory_write` non scrive nel frontmatter.
Descrive un fatto come **artefatto del blackboard**, non il file sotto `.foundry/memory/facts/`.
Validare un file di fatto contro `fact.v1` segnala due proprietà obbligatorie mancanti, ed è il
comportamento atteso.
:::

## Perché viene caricato solo l'indice

`.foundry/memory/INDEX.md` è generato, mai modificato a mano, ed è l'unico file di memoria che entra
in contesto di default. L'hook `SessionStart` lo inietta insieme all'elenco dei runbook e a un
riepilogo git di una riga. Tutto il resto si recupera su richiesta.

Una voce dell'indice è una riga:

```
- **fact-0004** · decision · PostgreSQL 16 is the only supported database `database` `postgres` `migrations`
```

Quella riga basta al modello per sapere che il fatto esiste e per decidere se spendere token a
recuperarlo, tramite lo strumento `memory_search` del server MCP `foundry`. Cento fatti possono
essere decine di migliaia di token su disco e un paio di migliaia nell'indice; la differenza si paga
a ogni sessione, ogni giorno, per tutta la vita del progetto.

Funziona solo se nessuno lo aggira. Un agente che legge `.foundry/memory/facts/` con lo strumento
Read carica tutto e annulla il progetto — per questo ogni asset del kernel lo dice esplicitamente e
la descrizione dello strumento MCP lo ripete.

### Come funziona il punteggio di recupero

Punteggio per parole chiave, senza embedding. Deterministico, offline e adeguato sotto un paio di
migliaia di fatti.

| Segnale | Effetto |
|---|---|
| Il termine compare nel titolo | +3 |
| Il termine compare nei tag | +2 |
| Il termine compare nel corpo | +1 |
| Il tipo del fatto è `decision` o `constraint` | × 1,2 |
| Confidenza `high` / `medium` / `low` | × 1,15 / × 1,0 / × 0,8 |

I termini più corti di tre caratteri vengono scartati. Il limite di default è 8 fatti con punteggio
minimo 1 (`memoryRetrieval` in `.foundry/config.json`); l'hook `UserPromptSubmit` è più severo:
al massimo 5 fatti con punteggio 3 o superiore, e solo per prompt più lunghi di 12 caratteri.

La conseguenza va detta chiaramente: **i sinonimi non corrispondono**. Una domanda sul "nostro
archivio dati" non trova un fatto intitolato "PostgreSQL 16 …" se nessuna di quelle parole è nel
titolo, nei tag o nel corpo. Scrivi i titoli con le parole che le persone cercheranno, e usa i tag
per quelle che non cercheranno.

## Deduplicazione e catene di supersedes

I fatti si scrivono solo tramite `memory_write`, che decide fra tre esiti.

| Situazione | Azione riportata | Che cosa succede |
|---|---|---|
| Un fatto attivo ha lo stesso titolo normalizzato **e** lo stesso corpo normalizzato | `unchanged` | Non viene scritto nulla; viene restituito l'id esistente |
| Un fatto attivo ha lo stesso titolo normalizzato ma corpo diverso | `updated` | Viene creato un **nuovo** fatto con nuovo id e `supersedes: <id-vecchio>` |
| Nessun fatto attivo ha quel titolo | `created` | Viene creato un fatto nuovo |

La normalizzazione è minuscolo con spazi compattati, e il controllo di identità è un'impronta
SHA-256 di titolo e corpo insieme. Quindi ri-registrare la stessa decisione in una sessione
successiva è gratuito e silenzioso, mentre riformularla diversamente produce un nuovo fatto che
ritira esplicitamente il vecchio.

Un fatto è **superato** quando il suo id compare nel campo `supersedes` di un altro fatto. I fatti
superati spariscono dall'indice e dai risultati di ricerca, ma il file resta su disco e in git,
così la catena dalla decisione corrente a quella che ha sostituito resta leggibile nel repository.

Due limiti di questo progetto, detti insieme a esso:

- La catena si risolve per presenza, non per profondità. Se fact-0009 supera fact-0004, che aveva
  superato fact-0002, i tre file restano tutti e solo fact-0009 è attivo.
- Il confronto è sul titolo. Due fatti che dicono la stessa cosa con parole diverse sono due fatti
  attivi, e nemmeno il controllo dei duplicati di `foundry doctor` li intercetta, perché anch'esso
  confronta i titoli. È a questo che serve l'agente `memory-curator`.

## Scadenza, non cancellazione

Un fatto la cui data `expires` è precedente a oggi smette di essere attivo: esce dall'indice, esce
dai risultati di ricerca e smette di influenzare qualsiasi cosa. Il file resta intatto.

Nulla in Foundry cancella un fatto. `foundry memory prune` si limita a segnalare:

```bash
foundry memory prune
```

```
Prune candidates (nothing is deleted automatically):

  expired:
    - fact-0006 — expired 2026-06-30
  superseded:
    - fact-0002 — superseded by a newer fact
  missing reasoning:
    - fact-0011 — add a **Why:** line

Retire a fact by setting `expires`, not by deleting it: the history of a decision is part of its value.
```

Imposta `expires` quando registri un fatto che ha già un orizzonte: una dipendenza fissata in attesa
di aggiornamento, un workaround per un bug che verrà corretto, un obiettivo di performance valido
per un trimestre. Un fatto che scade da solo non diventa mai l'affermazione stantia che nessuno osa
cancellare.

## Il budget di token dell'indice

`indexTokenBudget` vale 4000 di default e si imposta per progetto in `.foundry/config.json`. I
profili distribuiti vanno da 2500 (`startup-mvp`) a 6000 (`full`).

Quando l'indice viene rigenerato, i fatti sono ordinati per tipo e poi per id:

```
decision → constraint → convention → risk → domain → metric → glossary
```

Le righe vengono aggiunte finché la successiva supererebbe il budget. Tutto ciò che segue viene
scartato, e l'indice termina con una nota che ne dichiara il numero:

```
> 14 entries omitted to stay inside the 4000-token index budget. Consolidate or expire facts: `foundry memory prune`.
```

Quindi le voci perse per prime sono `glossary`, `metric` e `domain` — quelle che meno probabilmente
cambiano una decisione. Decisioni e vincoli non sono mai quelli scartati.

Tre cose da sapere sul limite:

- `foundry doctor` fallisce quando qualcosa è stato scartato: un indice fuori budget è un errore
  visibile, non un troncamento silenzioso.
- La nota di omissione viene aggiunta dopo il controllo di budget, quindi il file finito può
  superare il budget di qualche token. Il limite controlla la crescita; non è un tetto rigido sul
  file.
- Alzare il budget è quasi sempre la soluzione sbagliata. Consolidare sei fatti stretti in uno
  ampio costa un'ora una volta sola; un indice più grande costa token a ogni sessione, per sempre.

## Anti-pattern

| Non fare | Perché |
|---|---|
| Registrare ciò che `git log`, `package.json` o la configurazione CI già dicono | È derivabile, e la fonte è più accurata di una sua copia |
| Registrare stato di sessione — "sto rifattorizzando il modulo auth" | È obsoleto entro un'ora e l'indice se lo porta dietro per sempre |
| Scrivere o modificare i file dei fatti a mano | Aggiri il controllo di impronta, l'assegnazione dell'id e la catena di supersedes |
| Leggere `.foundry/memory/facts/` con lo strumento Read | Carichi ogni fatto in contesto, esattamente il costo che l'indice esiste per evitare |
| Alzare `indexTokenBudget` per farci stare più fatti | Il costo si paga a ogni sessione futura; consolida invece |
| Registrare una decisione senza il suo motivo | Diventa culto del cargo, e nessuno osa rimetterla in discussione perché nessuno sa contro che cosa era stata soppesata |
| Seminare cinquanta fatti il primo giorno | La qualità del recupero cala e l'indice si riempie di materiale che nessuno cerca. Da cinque a quindici è l'intervallo di lavoro |
| Dare a due fatti la stessa affermazione con parole diverse | Restano entrambi attivi, vengono recuperati entrambi e prima o poi si contraddiranno |
