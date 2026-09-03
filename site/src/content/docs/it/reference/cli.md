---
title: CLI
description: Ogni sottocomando di foundry, con i suoi flag e argomenti reali e la forma esatta di ciò che stampa.
sidebar:
  order: 1
---

`foundry` è uno script Node.js distribuito in `plugins/foundry-core/bin/foundry.mjs`. Claude Code
aggiunge la directory `bin/` di un plugin al PATH, quindi il comando è disponibile appena
`foundry-core` è installato. Ha zero dipendenze a runtime e ogni sottocomando è sicuro da rieseguire.

## Risoluzione della radice di progetto

Ogni sottocomando risolve la radice allo stesso modo: parte da `CLAUDE_PROJECT_DIR` se impostata,
altrimenti dalla directory di lavoro corrente, e risale finché non trova una directory che contiene
`.foundry/` o `.git/`. Se non trova nessuna delle due, ricade sulla directory di partenza.

`foundry help` stampa la radice risolta: è il modo più rapido per verificare di operare sul progetto
che credi.

## Comandi

```
foundry init                  create or repair .foundry state in this project
foundry doctor                check state, memory, runbooks and artifacts
foundry memory index          rebuild the memory index
foundry memory search <q>     search stored facts
foundry memory prune          list expired, superseded and malformed facts
foundry tokens                report what this project's memory costs per session
foundry runbooks              list available runbooks
foundry validate <id> <file>  validate a JSON artifact against a contract
foundry profile [name]        list or apply a project profile
```

`runbook` è accettato come alias di `runbooks`. `help`, `--help` e `-h` stampano tutti il blocco di
uso qui sopra. Un comando non riconosciuto stampa `Unknown command "<nome>".`, poi il blocco di uso,
ed esce con `1`.

---

## `foundry init`

Nessun argomento.

Crea l'albero `.foundry/` (`scratch/`, `memory/`, `memory/facts/`, `runbooks/`, `blackboard/`,
`metrics/`), scrive `.foundry/config.json` e `.foundry/overrides.json` se non esistono, aggiunge
`.foundry/scratch/` e `.foundry/metrics/` a `.gitignore` se mancano, e costruisce l'indice di
memoria.

I file esistenti non vengono mai sovrascritti, quindi rieseguirlo ripara anziché azzerare.

```
Initialised Foundry state in .foundry
Next: seed memory with the `foundry-init` skill, then run `foundry doctor`.
```

Su un progetto che aveva già `.foundry/`, la prima parola è `Repaired` invece di `Initialised`.

## `foundry doctor`

Nessun argomento.

Esegue dieci controlli e stampa una riga ciascuno, con prefisso `  ok  ` oppure ` FAIL `. Un
controllo fallito aggiunge una seconda riga rientrata con il dettaglio.

| Controllo | Fallisce quando |
|---|---|
| esiste la directory di stato `.foundry` | la directory manca |
| `config.json` presente | il file manca |
| livello di enforcement valido | `enforcement` non è `gate`, `warn` o `off` |
| numero di fatti attivi | mai — è informativo |
| indice dentro il budget | dei fatti sono stati esclusi per rientrare in `indexTokenBudget` |
| nessun titolo di fatto duplicato | due fatti attivi condividono il titolo, ignorando maiuscole e minuscole |
| ogni decisione e rischio registra la sua motivazione | un fatto `decision` o `risk` non ha una riga `**Why:**` |
| i runbook documentano il rollback | un runbook che parla di deploy, migrazione, rilascio, cancellazione o drop non ha una sezione `## Rollback` |
| nessun override di gate scaduto ancora nel file | un override in `.foundry/overrides.json` ha una data `expires` passata |
| ogni artefatto della blackboard valida sul suo contratto | un artefatto non è analizzabile, ha uno `schema` sconosciuto o mancante, oppure fallisce la validazione |

```
  ok   .foundry state directory exists
         /home/me/project/.foundry
  ok   config.json present
  ok   enforcement level is valid ("gate")
  ok   12 active facts (3 expired or superseded)
  ok   index within budget (~1840/4000 tokens)
  ok   no duplicate fact titles
 FAIL  every decision and risk records its reasoning
         fact-0007, fact-0011
  ok   4 runbooks, all mutating ones document rollback
  ok   no expired gate overrides still in the file
  ok   every blackboard artifact validates against its contract

1 check(s) failed.
```

Il codice di uscita è il numero di fallimenti ridotto a `1`; `0` quando tutto passa, e in quel caso
l'ultima riga è `All checks passed.`

## `foundry memory`

```
foundry memory [index|search <query>|prune]
```

Il sottocomando è `index` quando viene omesso. Qualsiasi altro valore stampa
`Usage: foundry memory [index|search <query>|prune]` ed esce con `1`.

### `foundry memory index`

Ricostruisce `.foundry/memory/INDEX.md` e riporta quanto budget è stato usato.

```
12/15 facts listed, ~1840 tokens, 3 omitted.
```

I fatti esclusi non vengono cancellati: restano semplicemente fuori dall'indice sempre caricato e
rimangono recuperabili tramite `memory_search`.

### `foundry memory search <query>`

Tutti gli argomenti restanti vengono uniti con spazi e usati come query. Restituisce al massimo 10
risultati.

```
fact-0004  [decision/high]  Persistence layer uses Flyway, not Liquibase
fact-0009  [constraint/medium]  The reporting database is read-only for the API
```

Stampa `No match.` quando nulla supera la soglia di punteggio.

### `foundry memory prune`

Elenca i candidati. **Non cancella nulla.**

```
Prune candidates (nothing is deleted automatically):

  expired:
    - fact-0002 — expired 2026-06-30
  superseded:
    - fact-0005 — superseded by a newer fact
  missing reasoning:
    - fact-0011 — add a **Why:** line

Retire a fact by setting `expires`, not by deleting it: the history of a decision is part of its value.
```

Le sezioni senza voci vengono omesse del tutto.

## `foundry tokens`

Nessun argomento. Riporta quanto costa per sessione la configurazione di memoria del progetto.

```
Foundry token accounting

  memory index (always loaded)   ~1840 tokens  (budget 4000)
  facts, retrieved on demand     ~9210 tokens across 15 facts
  runbooks, retrieved on demand  ~6400 tokens
  blackboard artifacts           ~24800 tokens (never loaded wholesale)

  eager loading would cost       ~40410 tokens per session
  index-first costs              ~1840 tokens per session
  saving                         ~38570 tokens per session (95%)

Estimates use ~4 characters per token. For billed usage see /cost and /usage.
```

La riga `saving` viene stampata solo quando c'è qualcosa da caricare. La percentuale è
`1 - indice / eager`, arrotondata.

## `foundry runbooks`

Nessun argomento. Elenca ogni runbook con lo slug allineato a 28 caratteri, il titolo, e il trigger
su una seconda riga rientrata quando ne è dichiarato uno.

```
deploy-production            Deploy to production
                             trigger: deploy, release to prod
rotate-api-keys              Rotate third-party API keys
```

Senza runbook:

```
No runbooks. Create one with the `runbook` skill after any task worth repeating.
```

## `foundry validate <schema-id> <percorso-json>`

Entrambi gli argomenti sono obbligatori. `<schema-id>` è un id di contratto come `finding.v1`;
`<percorso-json>` è il percorso dell'artefatto.

```
$ foundry validate finding.v1 .foundry/blackboard/audit/appsec-reviewer.json
VALID against finding.v1
```

In caso di fallimento l'output va su stderr e il codice di uscita è `1`:

```
INVALID against finding.v1:
  - missing required property "failureScenario"
  - severity: must be one of critical, high, medium, low, info
```

Con un argomento mancante: `Usage: foundry validate <schema-id> <path-to-json>`, uscita `1`.
Con un contratto sconosciuto: `Unknown contract "x". Available: adr.v1, compliance-check.v1, …`,
uscita `1`.

## `foundry profile [nome]`

Senza argomento elenca i profili trovati in `profiles/` con l'id allineato a 26 caratteri:

```
Available profiles:

  angular-spring-enterprise  Full-stack enterprise product: Angular frontend, Spring Boot services, relational database, strict gates.
  full                       All twelve plugins. Use to explore Foundry; in a real project pick a narrower profile to keep discovery cheap.
  oss-library                A public library or tool: governance, documentation, semantic versioning, contributor workflow.
  pa-italia                  Software for the Italian public sector: AgID guidelines, accessibility obligations, reuse, procurement evidence.
  startup-mvp                Move fast without setting fire to the future: lighter gates, economics on, heavy process off.

Apply one with: foundry profile <id>
```

Con un nome, fonde il profilo in `.claude/settings.json` — registrando il marketplace `foundry`,
unendo `enabledPlugins` e unendo le liste di permessi `allow`, `ask` e `deny` — poi fonde il
`foundryConfig` del profilo in `.foundry/config.json`.

```
Applied profile "angular-spring-enterprise".
  plugins: foundry-core, foundry-dev, foundry-quality, foundry-ops, foundry-pmo, foundry-legal
  settings: .claude/settings.json

Restart Claude Code, or run /reload-plugins, for the change to take effect.
```

Un nome sconosciuto stampa `No profile "<nome>".` ed esce con `1`.

### Profili

| Profilo | Plugin | `enforcement` |
|---|---|---|
| `angular-spring-enterprise` | core, dev, quality, ops, pmo, legal | `gate` |
| `oss-library` | core, oss, research, quality, dev | `gate` |
| `pa-italia` | core, legal, dev, quality, pmo, oss, economics | `gate` |
| `startup-mvp` | core, dev, economics, research | `warn` |
| `full` | tutti e nove | `gate`, con `indexTokenBudget: 6000` |

## Limiti

- La fusione dei permessi è additiva. `foundry profile` non rimuove mai una voce già presente, il
  che significa che applicare due profili in sequenza lascia l'unione di entrambi.
- I valori di token sono stime a circa quattro caratteri per token, non output di un tokenizer.
- `foundry profile` scrive `.claude/settings.json`; non installa i plugin. Li installa Claude Code
  al caricamento successivo delle impostazioni.
