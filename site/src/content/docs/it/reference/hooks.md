---
title: Hook e gate
description: Ogni hook di Foundry — evento, matcher, che cosa blocca, il messaggio esatto che restituisce e il percorso di override documentato.
sidebar:
  order: 3
---

`foundry-core` registra nove script di hook su otto eventi in `plugins/foundry-core/hooks/hooks.json`. Tutti usano la
*forma exec* degli hook (`command` + `args`, mai una pipeline di shell), così girano senza modifiche
su Linux, macOS e Windows.

Quattro di essi possono bloccare. Gli altri iniettano contesto o registrano una metrica.

## Tutti gli hook

| Evento | Matcher | Script | Timeout | Bloccante |
|---|---|---|---|---|
| `SessionStart` | `startup\|resume\|clear` | `session-start.mjs` | 15 s | no |
| `UserPromptSubmit` | — | `prompt-context.mjs` | 20 s | no |
| `PreToolUse` | `Bash` | `guard-bash.mjs` | 15 s | **sì** |
| `PreToolUse` | `Write\|Edit\|NotebookEdit` | `guard-write.mjs` | 15 s | **sì** |
| `PostToolUse` | `Write\|Edit` | `validate-contract.mjs` | 20 s | no |
| `SubagentStop` | — | `subagent-firewall.mjs` | 15 s | **sì** |
| `Stop` | — | `stop-verify.mjs` | 25 s | **sì** |
| `PreCompact` | — | `precompact-persist.mjs` | 20 s | no |
| `SessionEnd` | — | `session-end.mjs` | 5 s | no |

Ogni guardia legge `.foundry/config.json`. Quando `enforcement` è `off`, ogni guardia restituisce
subito nessuna opinione. Quando è `warn`, `guard-bash` degrada il diniego a un `ask`; i rilevatori
di segreti continuano a negare. `subagent-firewall` e `stop-verify` sono governati dalle proprie
impostazioni — `handoffSummaryTokenBudget` e `verifyOnStop` — e vengono disattivati solo da
`enforcement: off`.

---

## Gate: comandi Bash distruttivi

`PreToolUse` su `Bash`. Otto regole con nome, ciascuna con una ragione dichiarata e una via d'uscita.

| Id regola | Blocca | Perché |
|---|---|---|
| `rm-recursive-force` | `rm -rf` in qualsiasi ordine di flag | Cancellazione ricorsiva forzata. Cancella percorsi specifici, o spostali prima in una directory di scratch. |
| `git-push-force` | `git push --force` o `-f` (ma non `--force-with-lease`) | Il force push riscrive storia condivisa. Usa `--force-with-lease`, e mai sul branch predefinito. |
| `git-reset-hard-remote` | `git reset --hard origin/…` o `upstream/…` | Scarta ogni commit locale e ogni modifica in corso. Prima fai stash o crea un branch. |
| `git-clean-force` | `git clean` con `-d`, `-f` o `-x` | Cancella file non tracciati e ignorati, inclusi i file `.env`. Elencali prima con `git clean -n`. |
| `db-drop` | `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE`, `TRUNCATE TABLE` | Modifica distruttiva di schema. Passa da una migrazione revisionata. |
| `chmod-777` | `chmod 777` | Permessi scrivibili da chiunque. Concedi il modo più stretto che funzioni. |
| `curl-pipe-shell` | `curl … \| sh` o `wget … \| bash`, con o senza `sudo` | Esegue codice remoto non revisionato. Scarica, leggi, poi esegui. |
| `history-rewrite` | `git filter-branch`, `git filter-repo`, `bfg` | Riscrive l'intera storia del repository. Coordinati prima con ogni collaboratore. |

Il messaggio ha sempre la stessa forma:

```
Foundry gate `git-push-force` blocked this command.
Force push rewrites shared history. Use --force-with-lease, and never on the default branch.

If it is genuinely required, add an override to `.foundry/overrides.json`:
{"overrides":[{"gate":"git-push-force","reason":"<why>","expires":"<YYYY-MM-DD>"}]}
```

La decisione è `deny` con `enforcement: gate` e `ask` con `enforcement: warn`.

## Gate: segreti e percorsi protetti

`PreToolUse` su `Write`, `Edit` e `NotebookEdit`. Due gate distinti in un solo script.

### Rilevamento di credenziali — diniego netto

Attivo solo quando `secretScan` è `true`. I file che terminano in `.example`, `.sample` o
`.template` sono esclusi, così come tutto ciò che sta sotto `foundry-core/hooks/` (che contiene i
pattern stessi).

| Id regola | Rileva |
|---|---|
| `aws-access-key` | AWS access key id (`AKIA…`) |
| `github-token` | Token GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`) |
| `anthropic-key` | Chiave API Anthropic (`sk-ant-…`) |
| `openai-key` | Chiave API in stile OpenAI (`sk-…`) |
| `slack-token` | Token Slack (`xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, `xoxs-`) |
| `private-key` | Blocco `-----BEGIN … PRIVATE KEY-----` |
| `jwt` | JWT (`eyJ….….…`) |
| `connection-string` | URL di database con password in linea |

```
Foundry blocked this write: it contains what looks like a GitHub token.
Move the value to an environment variable or a secret manager and reference it by name.
If this is a placeholder, make it obviously fake (e.g. "REDACTED") or use a .example file.
```

Questo gate **non ha override**. Se il valore è un segnaposto, rendilo palesemente finto o spostalo
in un file `.example`; se è reale, non dovrebbe stare in un file tracciato.

### Percorsi protetti — escalation

I percorsi che corrispondono a `config.protectedPaths` vengono escalati all'utente invece di essere
negati. Predefiniti: `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `db/migrations/**`.

```
`.github/workflows/ci.yml` matches the protected pattern `.github/workflows/**`.
Changes here affect CI, dependency integrity or applied migrations. Confirm this is intended.
```

Sovrascrivibile con l'id di gate `protected-path`.

## Gate: firewall di contesto sui ritorni dei subagent

`SubagentStop`, senza matcher. Attivo a ogni livello di enforcement tranne `off`.

Misura il messaggio restituito dal subagent. L'obiettivo è `handoffSummaryTokenBudget`
(predefinito 300); il limite rigido al quale nega è il **triplo**, quindi 900 token per impostazione
predefinita. Ogni ritorno viene registrato come metrica `subagent_return`, che sia passato o meno.

```
Foundry context firewall: this subagent returned ~1420 tokens, over the 900-token hard limit
(target: 300).

Write the full output to the blackboard with the `blackboard_write` tool of the `foundry` MCP
server, then reply with only:
- the artifact path
- a summary of at most 300 tokens
- any blocking question

Do not paste file contents, diffs or long listings into your reply.
```

Non esiste override per singola regola. Alza `handoffSummaryTokenBudget` in `.foundry/config.json`,
oppure porta `enforcement` a `off`.

## Gate: verifica prima di dichiarare

`Stop`, senza matcher. Attivo quando `verifyOnStop` è `true` ed `enforcement` non è `off`.

L'hook non fa nulla a meno che l'ultimo messaggio dell'assistente non contenga una dichiarazione di
completamento: *all tests pass*, *tests are passing*, *everything works*, *it works now*, *fixed the
bug*, *fixed the issue*, *build is green*, *build passing*, *verified*, *ready to merge*, *ready to
ship*, *ready to deploy*, *fully working*, *done and tested*.

Se la contiene, l'hook legge le ultime 400 righe del trascritto cercando una chiamata `Bash` che
corrisponda a un pattern di verifica — `npm`, `pnpm`, `yarn`, `mvn`, `gradle`, `pytest`, `go test`,
`cargo`, `jest`, `vitest`, `playwright`, `ng test`, `dotnet test` o `make` combinati con `test`,
`verify`, `check`, `build`, `lint`, `e2e` o `ci`, oppure un semplice `npx jest|vitest|playwright`.

```
Foundry gate `verify-before-claiming`: this turn states the work is complete or passing, but no
test, build or lint command was run in it.
Run the project verification command and report its real output — including failures — or restate
the claim as unverified.
```

Se il trascritto non è leggibile, l'hook non esprime opinione. Non blocca mai per mancanza di prova
della prova.

Si disattiva con `"verifyOnStop": false` in `.foundry/config.json`.

## Validazione dei contratti

`PostToolUse` su `Write` ed `Edit`. Non bloccante per tipo di evento: restituisce
`additionalContext`, che il modello legge e su cui agisce.

Ispeziona solo i file `.json` sotto `.foundry/blackboard/`. Quattro messaggi, nell'ordine di
controllo:

| Situazione | Messaggio |
|---|---|
| JSON non analizzabile | `Foundry: <file> is not valid JSON (<errore>). Blackboard artifacts must be parseable JSON — rewrite it.` |
| Campo `schema` assente | `Foundry: this blackboard artifact has no \`schema\` field. Every artifact must declare its contract id (e.g. "finding.v1") and \`producedBy\`.` |
| Contratto sconosciuto | `Foundry: unknown contract "<id>". Available contracts: adr.v1, compliance-check.v1, …` |
| Validazione fallita | `Foundry: <file> violates <schema>. Fix it before continuing:` seguito da una riga `- ` per violazione |

Le violazioni vengono registrate come metrica `contract_violation`; un artefatto pulito registra
`contract_valid`. È questo il ciclo che permette a un agente di correggersi senza intervento umano.

## Iniezione di contesto

### `SessionStart`

Matcher `startup|resume|clear`. Non fa nulla se `.foundry/` non esiste. Altrimenti inietta, in
quest'ordine: l'indice di memoria; l'elenco dei runbook con i loro trigger e l'istruzione di
seguirli anziché improvvisare; il branch git, il numero di file non committati e l'ultimo commit; e
una riga finale che dice al modello di recuperare i fatti completi con `memory_search` invece di
leggere `.foundry/memory/facts/`.

Se il contesto assemblato supera circa 1500 token viene troncato a 6000 caratteri con
`(truncated to protect the session token budget)` in coda.

### `UserPromptSubmit`

Salta i prompt più corti di 12 caratteri. Esegue una ricerca per parole chiave sui fatti (al massimo
5, punteggio minimo 3) e confronta i trigger dei runbook con il testo del prompt. Non inietta nulla
quando nessuno dei due corrisponde.

```
## Relevant project memory
- **fact-0004** (decision, high): Persistence layer uses Flyway, not Liquibase
  Chosen for the plain-SQL migration format the team already reads.
These are recorded project facts. If the request contradicts one, say so before acting.

## Runbook applies
- `deploy-production` — Deploy to production. Follow it; do not improvise an alternative path.
```

È basato su parole chiave e offline per scelta, perché il timeout di `UserPromptSubmit` è di 30
secondi e ogni prompt lo paga.

### `PreCompact`

Non blocca: istruisce. La compattazione riassume il trascritto, e tutto ciò che non è stato messo
per iscritto come fatto viene di fatto dimenticato.

```
Foundry compaction instruction (auto trigger; project memory holds 16 facts).
Preserve verbatim in the summary, because they cannot be recovered from the code afterwards:
every decision taken in this session and the reasoning behind it; every constraint or convention
agreed; every risk identified; every approach that was tried and rejected, with why it failed.
[...]
```

Qui conta il canale. `PreCompact` **non** è membro dell'unione `hookSpecificOutput`: un hook che
risponde con quella busta fallisce la validazione di schema del runtime, viene marcato
`outcome: "error"` e non consegna nulla — in silenzio, perché il JSON in sé è ben formato. Il
canale supportato è stdout in chiaro, che il runtime unisce alle istruzioni personalizzate passate
al sommarizzatore della compattazione. Perciò questo hook scrive prosa, e si rivolge al
sommarizzatore invece che all'agente.

## Hook di ambiente

Foundry non ne registra nessuno. L'evento `WorktreeCreate` esiste e Foundry lo lascia
deliberatamente stare: un hook lì annulla la creazione del worktree a ogni uscita non-zero, che è
un modo di fallire pesante per una comodità. Che cosa significhi in pratica per i worktree sta in
[Orchestrazione](/foundry/it/concepts/orchestration/).

### `SessionEnd`

Accoda una riga di metrica `session_end` con la ragione di chiusura e l'id di sessione. Gli hook
`SessionEnd` condividono un budget di 1,5 secondi fra tutti i plugin, quindi questo fa il minimo e
non tocca mai la rete.

---

## Override

I gate basati su regole leggono `.foundry/overrides.json`, creato da `foundry init`:

```json
{
  "_comment": "Each override must state why it exists and when it expires. Expired overrides stop applying.",
  "overrides": [
    { "gate": "git-push-force", "reason": "Rewriting a botched release tag on a private fork", "expires": "2026-09-15" }
  ]
}
```

- `gate` è l'id di regola preso dalle tabelle qui sopra, oppure `protected-path`.
- Un override con una data `expires` passata smette di applicarsi. Non serve rimuoverlo per renderlo
  inerte, ma `foundry doctor` lo segnalerà come residuo.
- L'uso di un override registra una metrica `gate_override_used` con la motivazione, così la traccia
  sopravvive alla sessione.

Id di gate sovrascrivibili: le otto regole Bash, e `protected-path`.

Non sovrascrivibili per singola regola: il rilevamento di credenziali (correggi il valore), il
firewall di contesto (alza `handoffSummaryTokenBudget`) e `verify-before-claiming` (imposta
`verifyOnStop: false`).

## Disattivare del tutto i gate

| Obiettivo | Modifica |
|---|---|
| Gate Bash più morbidi — chiedere invece di negare | `"enforcement": "warn"` |
| Nessuna guardia | `"enforcement": "off"` |
| Mantenere i gate, togliere la scansione dei segreti | `"secretScan": false` |
| Mantenere i gate, togliere il controllo di completamento | `"verifyOnStop": false` |
| Percorsi protetti diversi | sostituisci `protectedPaths` |
| Ritorni dei subagent più grandi | alza `handoffSummaryTokenBudget` |

`enforcement: off` disattiva tutte e quattro le guardie. `warn` addolcisce solo le regole Bash: non
spegne il controllo di completamento né il context firewall, perché quelli hanno impostazioni
proprie e un livello che si chiama "warn" non deve disattivare in silenzio un gate il cui flag dice
che è attivo. Iniezione di contesto, validazione dei contratti, preparazione dei worktree e
metriche non sono influenzate da `enforcement` e girano sempre.
