---
title: Economia dei token
description: Sette meccanismi che riducono il costo di una sessione, in ordine di impatto, ciascuno con il codice che lo implementa — e un resoconto onesto di come viene calcolata la stima.
sidebar:
  order: 3
---

Il controllo dei costi è un problema di ingegneria con leve misurabili, non un atteggiamento.
Foundry ne implementa sette. Sei sono imposte dal codice; la settima è una pratica, e questa pagina
lo dice.

## I sette meccanismi, in ordine di impatto

### 1. Context firewall

Un subagente ha una finestra di contesto propria. Se restituisce un muro di testo, il genitore paga
tutto ciò che il figlio ha letto e l'isolamento non è servito a nulla.

**Meccanismo:** l'hook `SubagentStop` `subagent-firewall.mjs` stima i token del messaggio finale del
subagente. Oltre tre volte `handoffSummaryTokenBudget` — 900 token con il default di 300 — il
ritorno viene negato e all'agente viene detto di scrivere un artefatto sul blackboard e rispondere
con il percorso, un riassunto dentro il budget e le eventuali domande bloccanti.

Il gate gira solo con `enforcement: gate`. Con `warn` o `off` non fa nulla, quindi un profilo che
abbassa l'enforcement disattiva anche il risparmio più grande.

### 2. Memoria a indice prima

**Meccanismo:** `buildIndex()` scrive una riga per fatto in `.foundry/memory/INDEX.md`, limitata da
`indexTokenBudget`. L'hook `SessionStart` inietta quel file e nient'altro dalla memoria. Il testo
completo dei fatti si recupera su richiesta con `memory_search`.

Il risparmio cresce con il progetto: l'indice è limitato, il corpus no. `foundry tokens` stampa
entrambe le cifre per il tuo progetto — usa quelle, non una media presa da qualcun altro.

### 3. Routing di modello ed effort

Estrazione, classificazione e triage di lint non richiedono un modello di frontiera; architettura e
threat modelling sì.

**Meccanismo:** ogni agente Foundry dichiara `model:` ed `effort:` nel frontmatter, seguendo la
tabella di routing di `AUTHORING.md` §2 — `haiku`/`low` per estrazione e formattazione,
`sonnet`/`medium` per implementazione e revisione, `opus`/`high` per architettura e analisi legale,
`opus`/`xhigh` per la verifica avversariale di una conclusione ad alto rischio. I workflow passano
le stesse due opzioni a ogni chiamata `agent()`, così `audit-sweep.js` delimita l'ambito con
`haiku`, verifica con `sonnet` e tenta la confutazione con `opus`.

Un agente che fa lavoro economico su un modello costoso è un difetto da correggere, e
`scripts/validate-assets.mjs` controlla che entrambe le dichiarazioni siano presenti e valide.

### 4. Letture del blackboard per riassunto

**Meccanismo:** `blackboard_read` restituisce metadati più una riga di riassunto troncata per
artefatto. L'artefatto intero viene restituito solo se il chiamante passa `full: true`. Un
orchestratore che sintetizza sei artefatti di ondata legge quindi sei riassunti, non sei documenti.

`blackboard_write` riporta la dimensione in token dell'artefatto quando lo scrive, così l'agente sa
quanto costerebbe al genitore leggerlo per intero.

### 5. Divulgazione progressiva nelle skill

**Meccanismo:** il corpo di un `SKILL.md` è limitato a 500 righe dal contratto di authoring, e
l'approfondimento va in `references/*.md`, `scripts/` e `templates/`. Il corpo si carica quando la
skill scatta; i reference si caricano solo se la skill ne ha davvero bisogno.

### 6. Recupero mirato al momento del prompt

**Meccanismo:** l'hook `UserPromptSubmit` `prompt-context.mjs` cerca in memoria con le parole
dell'utente e inietta al massimo cinque fatti con punteggio 3 o superiore, più ogni runbook il cui
trigger compare nel prompt. I prompt più corti di 12 caratteri vengono ignorati, e quando nulla
raggiunge la soglia l'hook termina senza produrre alcun output.

La scelta progettuale qui è la moderazione: iniettare i cinque fatti migliori è economico e di
solito corretto; iniettarne venti costerebbe più che lasciare all'agente il compito di chiamare
`memory_search` quando serve.

### 7. Disciplina di compattazione

La compattazione riassume il transcript. Ciò che non è stato scritto come fatto è di fatto
dimenticato, e la sessione successiva paga per riscoprirlo.

**Meccanismo:** l'hook `PreCompact` `precompact-persist.mjs` inietta un promemoria che dichiara il
numero di fatti attuale e chiede di chiamare `memory_write` prima che il transcript venga riassunto.
Non blocca — non può sapere che cosa valga la pena tenere — quindi è l'unico meccanismo il cui
valore dipende dal fatto che l'agente agisca di conseguenza.

### La pratica senza meccanismo: allineamento della cache di prompt

La cache di prompt viene invalidata dalle modifiche vicino all'inizio del contesto. Modificare
`CLAUDE.md` a metà sessione, cambiare modello o compattare costano ciascuno un turno intero non in
cache. Raggruppa le modifiche alle istruzioni invece di distillarle poco per volta, e preferisci una
sessione nuova al combattere contro una inquinata.

Foundry non lo impone e non ha alcun hook per farlo. È elencato perché, nelle giornate storte, è
spesso il numero singolo più grande.

## Misurare

Due viste sugli stessi numeri.

```bash
foundry tokens
```

```
Foundry token accounting

  memory index (always loaded)   ~142 tokens  (budget 4000)
  facts, retrieved on demand     ~860 tokens across 9 facts
  runbooks, retrieved on demand  ~0 tokens
  blackboard artifacts           ~0 tokens (never loaded wholesale)

  eager loading would cost       ~860 tokens per session
  index-first costs              ~142 tokens per session
  saving                         ~718 tokens per session (83%)

Estimates use ~4 characters per token. For billed usage see /cost and /usage.
```

In sessione, lo strumento `token_report` del server MCP `foundry` stampa la stessa contabilità più
il conteggio degli eventi di gate registrati. `/context` mostra che cosa è effettivamente residente
in questo momento.

### La stima non è un tokenizer

`estimateTokens()` è `Math.ceil(text.length / 4)`. È tutta l'implementazione, ed è deliberato: un
tokenizer sarebbe una dipendenza a runtime, e Foundry non ne ha nessuna.

Che cosa comporta in pratica:

- **Sovrastima** la prosa fatta di parole comuni e lunghe, che un tokenizer reale impacchetta bene.
- **Sottostima** codice minificato, JSON con chiavi lunghe, base64 e alfabeti non latini, dove il
  rapporto reale è ben sotto i quattro caratteri per token.
- È deterministica, quindi confrontare due configurazioni con essa è corretto anche là dove il
  valore assoluto è impreciso.

Usala per budget e confronti. Per i soldi usa `/cost` e `/usage`: Foundry riporta quanto costa la
configurazione di questo progetto, mai quanto ti ha fatturato Anthropic.

## Che cosa viene registrato

`.foundry/metrics/events.jsonl` riceve una riga JSON per evento ed è in gitignore. I tipi scritti
sono `memory_search`, `memory_write`, `blackboard_write`, `contract_valid`, `contract_violation`,
`gate_blocked`, `gate_escalated`, `gate_override_used`, `subagent_return`, `worktree_created` e
`session_end`.

Le scritture di telemetria sono avvolte in modo che un errore non possa mai interrompere una
sessione, il che significa anche che un disco pieno perde le metriche in silenzio. Nulla lascia la
macchina e nulla di tutto questo viene inviato da qualche parte.

Contare i ritorni dei subagenti è il modo più rapido per vedere se il firewall sta facendo qualcosa:

```bash
grep -c '"kind":"subagent_return"' .foundry/metrics/events.jsonl
```

## Dove va davvero il costo

Prima di ottimizzare, controlla l'ordine. In una tipica sessione Foundry la classifica è: che cosa
restituiscono i subagenti, che cosa è residente all'avvio della sessione, quale modello ha eseguito
quale compito, e solo dopo tutto il resto. I primi tre hanno un meccanismo dietro.
