---
title: Domande frequenti
description: Risposte dirette su superpowers, costi, lingua degli asset, affiliazione, installazioni parziali e disattivazione dei gate.
sidebar:
  order: 4
---

## Foundry sostituisce superpowers?

No. Ne dipende.

La regola 3 del contratto di authoring è *non duplicare mai `superpowers`*. Dove una capacità esiste
lì, Foundry la invoca invece di reimplementarla:

| Necessità | Delegata a |
|---|---|
| Disciplina test-first | `superpowers:test-driven-development` |
| Individuare la causa radice di un guasto | `superpowers:systematic-debugging` |
| Trasformare un'idea in una specifica | `superpowers:brainstorming` |
| Trasformare una specifica in un piano | `superpowers:writing-plans` |
| Chiedere e ricevere revisione | `superpowers:requesting-code-review`, `superpowers:receiving-code-review` |
| Dichiarare il completamento | `superpowers:verification-before-completion` |

Foundry aggiunge ciò che lì non c'è: memoria governata, contratti fra agenti, hook di guardia,
instradamento di modello ed effort, e le verticali.

## Funziona senza superpowers?

Sì, in modo degradato.

La dipendenza è debole e viene rilevata a runtime, mai presunta. Quando `superpowers` è assente,
Foundry ricade su checklist ridotte — `plugins/foundry-quality/references/tdd-fallback.md` è
l'esempio più chiaro, e dichiara a quale skill di superpowers ciascuna voce avrebbe delegato, così
la degradazione è visibile e non silenziosa.

Perdi la profondità della metodologia TDD e di debugging. Mantieni memoria, contratti, gate e ogni
verticale.

La degradazione graduale è una regola, non un caso: l'asticella di qualità impone a ogni asset di
rilevare una dipendenza facoltativa mancante, dichiararla e proseguire. Lo stesso vale per un server
MCP assente o un `gh` assente.

## Perché gli asset sono in inglese se la documentazione è bilingue?

Perché agenti e documentazione hanno lettori diversi.

La regola 1 del contratto di authoring è *solo inglese in ogni asset* — agenti, skill, hook,
comandi, workflow, commenti nel codice. Dodici plugin scritti da autori diversi devono comportarsi
come un solo sistema, e un corpus di descrizioni di agenti in lingue miste peggiora
l'instradamento: il campo `description` è la chiave di recupero che decide a quale agente Claude
delega.

La documentazione per l'utente è bilingue EN/IT e vive in `site/`, mai dentro un plugin. Il
validatore cerca attivamente marcatori italiani negli asset e fa fallire la build se ne trova.

## Quanto costa?

Foundry di per sé è gratuito e rilasciato sotto licenza Apache-2.0. Ciò che cambia è il tuo consumo
di token in Claude Code, ed è progettato per ridurlo.

Quattro meccanismi:

| Meccanismo | Effetto |
|---|---|
| Memoria che parte dall'indice | Per sessione viene caricato solo un indice da 4000 token; fatti, runbook e artefatti sono recuperati su richiesta |
| Firewall di contesto | Un subagent che restituisce più del triplo del budget di handoff da 300 token viene rimandato indietro a scrivere un artefatto |
| Instradamento di modello ed effort | `haiku`/`low` per estrazione e classificazione, `sonnet`/`medium` per l'implementazione, `opus`/`high` per architettura e analisi |
| Misura | `foundry tokens` e lo strumento MCP `token_report` stampano quanto costa la configurazione |

Esegui `foundry tokens` sul tuo progetto per un numero reale. Stampa quanto costerebbe il
caricamento eager rispetto al percorso che parte dall'indice, e la differenza.

Due avvertenze. I valori sono stimati a circa quattro caratteri per token, non output di un
tokenizer: per gli importi fatturati usa `/cost` e `/usage`. E installare plugin che non ti servono
costa token di discovery all'avvio della sessione, ed è per questo che il profilo `full` dice nella
propria descrizione di sceglierne uno più stretto per il lavoro vero.

## È affiliato ad Anthropic?

No.

Foundry è un progetto open source indipendente di Federico Calò. Non è affiliato ad Anthropic, non è
approvato né sponsorizzato da Anthropic. È un marketplace di plugin che gira dentro Claude Code: la
relazione è tutta qui.

## Posso installare un solo plugin?

Sì — più il kernel, che arriva in automatico.

Ogni verticale dichiara `"dependencies": [{ "name": "foundry-core", "version": "^0.1.0" }]`, quindi
installandone una arriva anche `foundry-core`. Non c'è altro accoppiamento: le verticali non
dipendono l'una dall'altra.

```bash
/plugin marketplace add fedcal/foundry
/plugin install foundry-legal@foundry     # porta con sé foundry-core
```

Installare in modo stretto è l'approccio consigliato. Anche il solo kernel — memoria, contratti,
gate, CLI — è utile con zero verticali.

Se preferisci un insieme già curato, applica un profilo:

```bash
foundry profile oss-library
```

## Come disattivo un gate?

Tre livelli, dal più stretto al più ampio.

### Una regola, temporaneamente

Aggiungi una voce a `.foundry/overrides.json`. Ogni messaggio di blocco ti dice la forma esatta:

```json
{
  "overrides": [
    { "gate": "git-push-force", "reason": "Rewriting a botched tag on a private fork", "expires": "2026-09-15" }
  ]
}
```

Un override con data `expires` passata smette da solo di applicarsi. Usarne uno registra una metrica
`gate_override_used` con la tua motivazione, così la decisione resta tracciabile.

Id sovrascrivibili: `rm-recursive-force`, `git-push-force`, `git-reset-hard-remote`,
`git-clean-force`, `db-drop`, `chmod-777`, `curl-pipe-shell`, `history-rewrite`, e
`protected-path`.

### Una categoria, in modo permanente

Modifica `.foundry/config.json`:

| Obiettivo | Modifica |
|---|---|
| Togliere la scansione delle credenziali | `"secretScan": false` |
| Togliere il controllo di completamento | `"verifyOnStop": false` |
| Percorsi protetti diversi | sostituisci `protectedPaths` |
| Consentire ritorni dei subagent più grandi | alza `handoffSummaryTokenBudget` |

### Tutto

```json
{ "enforcement": "warn" }
```

`warn` trasforma i dinieghi Bash in richieste. **Non** spegne il firewall di contesto né il gate di
verifica prima della dichiarazione: quelli hanno impostazioni proprie, e un livello che si chiama
"warn" non deve disattivare in silenzio un gate il cui flag dice che è attivo.

```json
{ "enforcement": "off" }
```

`off` disattiva tutte e quattro le guardie. Iniezione di contesto, validazione dei contratti,
preparazione dei worktree e metriche continuano comunque a girare: non bloccano mai nulla.

Tre gate non hanno override per singola regola, per scelta: il rilevamento di credenziali (correggi
il valore, o rendi palesemente finto il segnaposto), il firewall di contesto (alza invece il budget)
e la verifica prima della dichiarazione (imposta `verifyOnStop: false`).

I dettagli completi, con ogni regola e ogni messaggio, sono in
[Hook e gate](/foundry/it/reference/hooks/).

## E se un gate blocca qualcosa e non capisco perché?

Ogni blocco nomina l'id della regola e indica la via d'uscita nello stesso messaggio. Poi esegui:

```bash
foundry doctor
```

Segnala gli override scaduti rimasti nel file, gli artefatti di blackboard non validi, e se l'indice
di memoria è oltre budget — il che copre la maggior parte dei casi confusi.
