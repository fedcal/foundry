---
title: Orchestrazione
description: Tre meccanismi di esecuzione e quando ciascuno è quello giusto, ondate e gate, il limite di annidamento a tre livelli, SendMessage, il context firewall e l'isolamento in worktree.
sidebar:
  order: 5
---

L'orchestrazione costa token veri: un piano, un prompt di dispatch per agente, una passata di
sintesi. Pagala solo quando il lavoro si divide davvero. La prima decisione è sempre se orchestrare
oppure no.

| Segnale | Che cosa fare |
|---|---|
| Un solo specialista copre tutto il compito | Delega una volta. Niente orchestrazione |
| Aree indipendenti che non hanno bisogno dell'output l'una dell'altra | Orchestra, una sola ondata |
| Fasi in cui ciascuna ha bisogno del risultato della precedente | Orchestra, più ondate |
| Scoperta di dimensione ignota — auditare ogni rotta, migrare ogni modulo | Prima una ricognizione, poi un workflow dinamico |

Se la risposta è no, dillo in una riga e procedi. La cerimonia intorno a un compito da un passo è un
difetto, non diligenza.

## Tre meccanismi

Non sono intercambiabili. Sceglierne uno sbagliato è il modo più comune in cui un'esecuzione
orchestrata finisce per costare più che fare il lavoro direttamente.

| Meccanismo | Come gira | Giusto quando | Sbagliato quando |
|---|---|---|---|
| **Fan-out in sessione** | Chiamate `Agent` dall'agente `foundry-orchestrator` | 2-6 specialisti e vuoi intervenire fra un'ondata e l'altra | L'elenco degli elementi si conosce solo a runtime, o il lavoro eccede un contesto |
| **Workflow dinamico** | Uno script in `workflows/`, eseguito con lo strumento `Workflow` | L'elenco si scopre a runtime e a ogni elemento si applica lo stesso trattamento: audit sweep, migrazione, revisione file per file | I passi richiedono giudizio umano nel mezzo |
| **Fan-out headless** | Processi `claude -p` | CI, oppure lavoro più grande del contesto di una singola sessione | Vuoi intervenire durante l'esecuzione; la CLI non è autenticata |

`foundry-core` distribuisce tre workflow — `feature-delivery.js`, `audit-sweep.js` e
`compliance-sweep.js` — e due playbook, `feature-delivery.yaml` e `audit.yaml`.

Il driver headless è distribuito con il kernel in `${CLAUDE_PLUGIN_ROOT}/scripts/fanout.mjs`. Legge
un array JSON di elementi di lavoro, avvia un processo `claude -p` per ciascuno a concorrenza fissa
e raccoglie i risultati in un file JSON — nulla viene riversato in una conversazione padre.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fanout.mjs" \
  --items rotte.json \
  --prompt "Verifica {{item}} per controlli di autorizzazione mancanti" \
  --concurrency 4 \
  --allowed-tools "Read,Grep,Glob" \
  --out risultati-audit.json
```

`--items` accetta un file oppure `-` per lo stdin. `{{item}}` e `{{index}}` vengono sostituiti nel
prompt. `--dry-run` stampa i comandi senza eseguirli, `--model` e `--mcp-config` vengono inoltrati,
e il processo esce con codice diverso da zero se qualche elemento è fallito.

:::caution[Serve una CLI autenticata]
Ogni elemento è un vero processo `claude -p`, quindi `claude` deve essere nel `PATH` e autenticata —
in CI significa fornire le credenziali al runner. La lista di strumenti consentiti vale per
impostazione predefinita `Read,Grep,Glob`: allargala con intenzione, perché ogni processo avviato
eredita quello che concedi.
:::

### Che cosa può e non può fare un workflow

Un workflow è JavaScript semplice con `await` a livello di modulo e un export `meta` di soli
letterali che nomina le fasi. Dentro hai `agent(prompt, opts)`, `parallel(thunks)`,
`pipeline(items, ...stages)`, `phase(title)`, `log(msg)`, `args`, `budget` e
`workflow(nameOrRef, args)`.

`Date.now()`, `new Date()` e `Math.random()` **sollevano un'eccezione**. Il determinismo è il punto:
un workflow che non può osservare l'orologio produce due volte la stessa esecuzione, ed è questo a
renderlo ripetibile. Passa un timestamp attraverso `args` quando ti serve.

Preferisci `pipeline()` a `parallel()`. Una barriera che attende ogni risultato precedente è giusta
solo quando una fase ha davvero bisogno di tutti insieme; `audit-sweep.js` usa una pipeline su ogni
coppia (sottosistema × lente), così una lente lenta non blocca mai una veloce.

## Ondate e gate

Un'**ondata** è un insieme di compiti nessuno dei quali ha bisogno dell'output di un altro. Due
compiti stanno nella stessa ondata solo se nessuno dei due consuma il risultato dell'altro.
Sbagliare qui è ciò che produce agenti in attesa di file che ancora non esistono.

Un **gate** è la condizione per avanzare. Ha due parti:

1. Ogni artefatto prodotto dall'ondata è valido rispetto al suo contratto. L'hook
   `validate-contract` segnala le violazioni automaticamente; l'orchestratore ridispaccia l'agente
   che ha fallito **insieme agli errori di validazione**, invece di riparare l'artefatto da sé.
2. I criteri di uscita dell'ondata stessa, presi da `plan.v1`, che lo schema descrive come
   verificabili da una macchina: un conteggio, una soglia, un comando che deve passare, non "sembra
   a posto".

Se un gate fallisce due volte, l'esecuzione si ferma e risale all'utente con che cosa è fallito, che
cosa è stato tentato e le due o tre opzioni disponibili. Abbassare l'asticella in silenzio è
esattamente il fallimento che i gate esistono per impedire.

`feature-delivery.js` ne mostra la forma: Analisi produce requisiti, un ADR e un threat model in
parallelo; Implementazione parte solo quando i contratti sono concordati; Convergenza rivede il
risultato rispetto a ciò che Analisi aveva deciso.

## Annidamento, e che cosa i subagenti non possono fare

I subagenti si annidano **fino a tre livelli** sotto la conversazione principale. Al limite di
profondità lo strumento `Agent` viene semplicemente sottratto, quindi uno spawn di quarto livello
non produce un errore vistoso: lo strumento non c'è. Puoi abbassare il limite con
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`.

Spendi quella profondità deliberatamente. Uno specialista che deve dividere il proprio lavoro può
fare fan-out una volta ancora; un terzo livello quasi sempre significa che la decomposizione sopra
di esso era sbagliata.

Questi strumenti sono **sempre sottratti** ai subagenti, a qualsiasi profondità:

`AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode`, `ScheduleWakeup`,
`TaskOutput`, `Workflow`.

Due conseguenze che modellano ogni progetto qui. Un subagente non può chiedere nulla all'utente,
quindi una domanda deve risalire come domanda aperta nel suo handoff ed essere posta dalla
conversazione principale. E un subagente non può avviare un workflow, quindi il meccanismo dei
workflow appartiene solo alla conversazione principale: non puoi annidare un workflow dentro un
fan-out.

### SendMessage

Gli agenti comunicano con `SendMessage`; il `foundry-orchestrator` lo dichiara nella propria lista
`tools` accanto ad `Agent`. La regola che conta non riguarda lo strumento ma che cosa ci metti
dentro: passa **percorsi** di artefatto, mai contenuti. Incollare un file in un prompt di dispatch
lo fa pagare al genitore e poi di nuovo al figlio.

Ogni dispatch porta tre cose: i percorsi esatti da leggere, l'id del contratto di output e
l'istruzione di scrivere i risultati con `blackboard_write` e restituire al massimo 300 token.

## Il context firewall

Un subagente ha una finestra di contesto propria, ed è l'intera ragione per usarne uno. Se
restituisce tutto ciò che ha letto, il genitore paga tutto e l'isolamento non è servito a nulla.

L'hook `SubagentStop` misura il messaggio restituito e nega qualunque cosa superi tre volte
`handoffSummaryTokenBudget` — 900 token di default — con l'istruzione di scrivere l'output completo
sul blackboard e rispondere con il percorso, un riassunto dentro il budget e le eventuali domande
bloccanti.

Gira solo con `enforcement: gate`. Vedi [Gate](/foundry/it/concepts/gates/) per la matrice completa.

## Isolamento in worktree per chi scrive in concorrenza

Gli agenti che scrivono file **mentre altri agenti stanno scrivendo file** devono dichiarare
`isolation: worktree`. Gli agenti in sola lettura — audit, ricerca, revisione — non devono: il costo
di preparazione non compra nulla quando non c'è nulla su cui entrare in conflitto.

I worktree vengono creati in `.claude/worktrees/<nome>/`. I file in gitignore che servono comunque
al loro interno vanno elencati in `.worktreeinclude` alla radice del repository.

**Foundry non registra alcun hook `WorktreeCreate`, e nulla collega lo stato di Foundry dentro un
worktree.** L'evento esiste, ma un hook su di esso annulla la creazione del worktree a ogni uscita
diversa da zero: un modo di fallire troppo pesante per una comodità. Quindi conviene sapere che
cosa arriva davvero:

- Ciò che di `.foundry/` è **committato** — memoria, runbook, configurazione — arriva tramite git,
  come qualunque altro file tracciato.
- `.foundry/blackboard/` è gitignorato, quindi è **assente da un worktree appena creato e, una volta
  creato, è per-worktree**. Un artefatto che un agente ci scrive dentro è invisibile al checkout
  principale e agli agenti fratelli. Un agente isolato deve perciò restituire il proprio artefatto
  nel valore di ritorno, oppure scriverlo sotto il checkout principale, che risolve dal `cwd`
  dell'hook — non da `${CLAUDE_PROJECT_DIR}`, che non segue un worktree.
- In un progetto dove `.foundry/` è interamente gitignorato, un agente in worktree parte **senza
  alcuno stato di Foundry**. Elenca in `.worktreeinclude` ciò che deve viaggiare, come file veri: il
  runtime copia le voci una per una e **salta i symlink**, registrando `Skipping symlink in
  .worktreeinclude`, perciò una directory che ne contenga arriva incompleta pur sembrando copiata.

La conseguenza pratica: usa `isolation: worktree` per gli agenti che scrivono **file sorgente** in
parallelo, che è ciò per cui serve. Non usarlo per agenti il cui compito è scambiarsi artefatti
attraverso il blackboard — scriverebbero ciascuno in una copia privata.

## La procedura, dall'inizio alla fine

1. **Richiama.** `memory_search` per le decisioni precedenti su quest'area. Un piano che contraddice
   una decisione registrata senza riconoscerlo è sbagliato per costruzione.
2. **Pianifica.** Carica un playbook o deriva le ondate. Scrivi `plan.v1` in
   `.foundry/blackboard/plan/orchestrator.json`.
3. **Dispaccia.** Un agente per compito, il più specifico disponibile, con i percorsi e un contratto
   di output. Non generare mai un agente il cui output non sai descrivere in anticipo: se non sai
   enunciarne il contratto, il compito non è ancora definito.
4. **Applica il gate.** Verifica che ogni artefatto sia valido. Ridispaccia i falliti con gli errori.
5. **Sintetizza.** Leggi i riassunti con `blackboard_read`, non con `full`. Scrivi tu la risposta.
   Dove due specialisti sono in disaccordo, dillo e di' quale è meglio supportato — non fare una
   media.
6. **Registra.** `memory_write` per ogni decisione, vincolo e rischio prodotto dall'esecuzione. È il
   passo che rende più economica l'esecuzione successiva, ed è quello che si salta più spesso.
