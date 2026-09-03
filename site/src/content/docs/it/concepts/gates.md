---
title: Gate
description: Ogni gate con il suo evento hook e ciò che blocca, come i livelli di enforcement cambiano ciascuno e la via di override tramite .foundry/overrides.json.
sidebar:
  order: 6
---

Un gate è un hook che ispeziona un'azione e restituisce una decisione. Ogni gate bloccante nomina la
regola che è scattata e che cosa fare invece, perché un blocco senza via d'uscita è solo un
ostacolo.

## Tutti i gate

### Comandi distruttivi — `PreToolUse` su `Bash`

Otto espressioni regolari sulla stringa del comando, in `guard-bash.mjs`. Ognuna ha un id che puoi
sovrascrivere.

| Id del gate | Corrisponde a | Perché blocca |
|---|---|---|
| `rm-recursive-force` | `rm` con `-r`/`-R` e `-f` insieme, in qualunque ordine o combinazione | Cancellazione ricorsiva forzata. Cancella percorsi specifici, o spostali prima in una directory di scratch |
| `git-push-force` | `git push` con `--force` o `-f` — **non** `--force-with-lease` | Il force push riscrive storia condivisa. Usa `--force-with-lease`, e mai sul branch di default |
| `git-reset-hard-remote` | `git reset --hard origin/…` o `upstream/…` | Scarta ogni commit locale e ogni modifica in corso. Prima fai stash o un branch |
| `git-clean-force` | `git clean` con `-d`, `-f` o `-x` | Cancella file non tracciati e ignorati, inclusi i `.env`. Elencali prima con `git clean -n` |
| `db-drop` | `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE`, `TRUNCATE TABLE`, senza distinzione di maiuscole | Modifica distruttiva dello schema. Passala per una migrazione rivista |
| `chmod-777` | `chmod 777` | Permessi scrivibili da chiunque. Concedi il modo più stretto che funziona |
| `curl-pipe-shell` | `curl` o `wget` in pipe verso `sh`, `bash` o `sudo sh` | Esegue codice remoto non rivisto. Scarica, leggi, poi esegui |
| `history-rewrite` | `git filter-branch`, `git filter-repo`, `bfg` | Riscrive l'intera storia del repository. Prima coordinati con ogni collaboratore |

Il messaggio di blocco nomina la regola, dà il motivo e stampa il JSON esatto da aggiungere a
`.foundry/overrides.json`.

Sono confronti di pattern sulla stringa grezza del comando, non un parser di shell. L'imprecisione è
reale in entrambe le direzioni: un comando distruttivo nascosto dietro una variabile, un alias o un
heredoc non corrisponde, e un `DROP TABLE` dentro un file di migrazione che ti capita di passare a
`cat` a riga di comando corrisponde. Il gate è una cintura di sicurezza, non una sandbox.

### Segreti — `PreToolUse` su `Write`, `Edit`, `NotebookEdit`

Otto rilevatori in `guard-write.mjs`, applicati al contenuto che sta per essere scritto.

| Rilevatore | Corrisponde a |
|---|---|
| `aws-access-key` | `AKIA` seguito da 16 caratteri alfanumerici maiuscoli |
| `github-token` | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` seguiti da 36 o più caratteri |
| `anthropic-key` | `sk-ant-` seguito da 20 o più caratteri |
| `openai-key` | `sk-` seguito da 32 o più alfanumerici |
| `slack-token` | `xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, `xoxs-` seguiti da 10 o più caratteri |
| `private-key` | Un blocco `-----BEGIN … PRIVATE KEY-----`, incluse le varianti RSA, EC, OPENSSH e PGP |
| `jwt` | Tre segmenti base64url che iniziano con `eyJ` |
| `connection-string` | Un URL `postgres`, `postgresql`, `mysql` o `mongodb` con password in linea |

Una corrispondenza nega la scrittura e chiede di spostare il valore in una variabile d'ambiente o in
un secret manager. Due esenzioni: i file che finiscono in `.example`, `.sample` o `.template`
vengono saltati, e così tutto ciò che sta sotto `foundry-core/hooks/`, perché i rilevatori non
blocchino le modifiche a se stessi.

**Questo gate non ha una via di override.** `guard-write.mjs` non consulta `.foundry/overrides.json`
per i segreti. Le vie documentate sono rendere il segnaposto palesemente finto — `REDACTED` — oppure
usare un file `.example`. Impostare `secretScan: false` in `.foundry/config.json` disattiva tutti e
otto i rilevatori insieme: è una decisione di progetto, non una decisione per singola scrittura.

### Percorsi protetti — `PreToolUse` su `Write`, `Edit`, `NotebookEdit`

I percorsi che corrispondono a un glob in `protectedPaths` **risalgono** invece di essere negati: ti
viene chiesta conferma. L'insieme di default è `.github/workflows/**`, `**/*.lock`,
`package-lock.json` e `db/migrations/**`; ogni profilo porta il proprio.

Il messaggio nomina il pattern che ha corrisposto e perché quell'area conta: CI, integrità delle
dipendenze o migrazioni già applicate.

### Dichiarazioni di completamento — `Stop`

`stop-verify.mjs` cerca nel messaggio finale dell'assistente affermazioni come "all tests pass",
"fixed the bug", "build is green", "ready to ship", "done and tested". Quando ne trova una, esamina
le ultime 400 righe del transcript in cerca di una chiamata Bash che esegua un comando di test,
build, lint o E2E — `npm`, `pnpm`, `yarn`, `mvn`, `gradle`, `pytest`, `go test`, `cargo`, `jest`,
`vitest`, `playwright`, `ng test`, `dotnet test`, `make`.

Se nessun comando del genere è stato eseguito nel turno, lo stop viene negato:

```
Foundry gate `verify-before-claiming`: this turn states the work is complete or passing,
but no test, build or lint command was run in it.
Run the project verification command and report its real output — including failures —
or restate the claim as unverified.
```

Non c'è un id di override. Si disattiva con `verifyOnStop: false`. Se il transcript non è leggibile,
il gate si astiene, sul principio che non deve mai bloccare per mancanza di prove delle prove.

### Ritorni dei subagenti — `SubagentStop`

`subagent-firewall.mjs` stima i token del messaggio finale del subagente e nega qualunque cosa
superi tre volte `handoffSummaryTokenBudget` — 900 token con il default di 300. La risposta deve
essere il percorso dell'artefatto, un riassunto dentro il budget e le eventuali domande bloccanti.
Vedi [Orchestrazione](/foundry/it/concepts/orchestration/).

Nessun id di override. Ogni ritorno viene registrato come `subagent_return` nel file delle metriche,
che passi o no.

### Validazione dei contratti — `PostToolUse` su `Write`, `Edit`

`validate-contract.mjs` valida i file `.json` scritti sotto `.foundry/blackboard/` contro il
contratto nominato nel loro campo `schema`. **Non è un gate**: `PostToolUse` gira dopo la scrittura,
quindi il file esiste già e l'hook restituisce le violazioni come contesto su cui l'agente può
agire. È elencato qui perché è il meccanismo che tutti si aspettano sia un gate. La via bloccante
per i contratti è `blackboard_write`, che valida prima di scrivere qualsiasi cosa. Vedi
[Contratti](/foundry/it/concepts/contracts/).

### Hook non bloccanti

Non fanno da gate a nulla; sono elencati perché l'insieme degli hook sia completo.

| Hook | Evento | Che cosa fa |
|---|---|---|
| `session-start.mjs` | `SessionStart` su `startup`, `resume`, `clear` | Inietta l'indice della memoria, l'elenco dei runbook e un riepilogo git di una riga. Si tronca da solo oltre circa 1500 token |
| `prompt-context.mjs` | `UserPromptSubmit` | Inietta al massimo 5 fatti corrispondenti e ogni runbook attivato. Silenzioso sotto i 12 caratteri di prompt |
| `precompact-persist.mjs` | `PreCompact` | Chiede che le decisioni non registrate siano scritte in memoria prima che il transcript venga riassunto |
| `session-end.mjs` | `SessionEnd` | Registra una riga di telemetria. Tutti gli hook `SessionEnd` condividono un budget di 1,5 s, quindi non fa altro |

## Che cosa fa davvero ciascun livello di enforcement

`enforcement` sta in `.foundry/config.json` e vale `gate` di default. Il comportamento non è uniforme
fra i gate, e le differenze contano più di quanto il nome suggerisca.

| Gate | `gate` | `warn` | `off` |
|---|---|---|---|
| Regole Bash (tutte e otto) | nega | **chiede** | nessuna opinione |
| Rilevatori di segreti | nega | **nega** | nessuna opinione |
| Percorsi protetti | risale | risale | nessuna opinione |
| `verify-before-claiming` | nega | nega (richiede `verifyOnStop`) | non gira |
| Context firewall dei subagenti | nega | nega | non gira |
| Validazione dei contratti | segnala | segnala | segnala |

Una riga va letta due volte: con `warn` i rilevatori di segreti continuano a negare in modo netto.
Solo le regole Bash si addolciscono in una richiesta di conferma, perché una credenziale trapelata
non si recupera andando veloci — va ruotata.

`warn` deliberatamente **non** spegne il controllo di completamento né il context firewall. Quei due
sono governati dalle proprie impostazioni, `verifyOnStop` e `handoffSummaryTokenBudget`. Una
versione precedente li legava a `enforcement === 'gate'`: un progetto che impostava
`verifyOnStop: true` insieme a `warn` non otteneva alcuna verifica e nessuna segnalazione del fatto
— una configurazione che mentiva. Per spegnerli, spegni il loro flag, oppure imposta
`enforcement: off`.

La validazione dei contratti non legge mai `enforcement`, quindi segnala le violazioni a ogni
livello, incluso `off`.

## Override

`.foundry/overrides.json` viene creato vuoto da `foundry init`:

```json
{
  "_comment": "Each override must state why it exists and when it expires. Expired overrides stop applying.",
  "overrides": []
}
```

Aggiungi una voce che nomini il gate, il motivo e la scadenza:

```json
{
  "overrides": [
    {
      "gate": "git-push-force",
      "reason": "Riscrittura di release/2.3 dopo un rebase sbagliato; il branch non è ancora condiviso",
      "expires": "2026-09-10"
    },
    {
      "gate": "protected-path",
      "reason": "Migrazione di tutti i workflow alla nuova immagine di runner, tracciata in #482",
      "expires": "2026-09-03"
    }
  ]
}
```

Come si comportano:

- Vince la **prima** voce il cui `gate` corrisponde. Le voci duplicate dopo la prima sono ignorate.
- `protected-path` è un id unico che copre tutto l'insieme protetto, non un id per pattern.
- Per le regole Bash, una voce il cui `expires` è passato non si applica e il gate scatta di nuovo
  normalmente.
- Usare un override registra `gate_override_used`, con il motivo che hai dichiarato, in
  `.foundry/metrics/events.jsonl`. Gli override sono visibili, non invisibili.
- `expires` è facoltativo nel codice, e una voce che non ce l'ha non scade mai e non può essere
  segnalata. Metti sempre una data.

:::caution[Un override protected-path scaduto continua a sopprimere la risalita]
Il controllo sui percorsi protetti verifica solo se **esiste** una voce di override per quel gate,
non se sia ancora valida. Una voce con `expires` passato continua quindi a sopprimere la risalita.
I gate Bash invece la data la controllano. Rimuovi un override di percorso protetto quando hai
finito, invece di lasciarlo scadere.
:::

`foundry doctor` fa fallire il controllo `no expired gate overrides still in the file` e nomina ogni
`gate` rimasto indietro: è così che li trovi prima che contino.

## Che cosa viene registrato

Ogni decisione di un gate scrive una riga in `.foundry/metrics/events.jsonl`, che è in gitignore:
`gate_blocked` con l'id del gate e lo strumento, `gate_escalated` con il file e
`gate_override_used` con il motivo. Nulla lascia la macchina.

```bash
grep '"kind":"gate_blocked"' .foundry/metrics/events.jsonl | tail -20
```

Un gate che scatta di continuo ti sta dicendo qualcosa: o sul lavoro, o su una regola sbagliata per
questo progetto. Vale la pena agire in entrambi i casi.
