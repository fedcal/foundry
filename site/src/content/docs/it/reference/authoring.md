---
title: Scrivere asset
description: Una lettura discorsiva delle regole che ogni agente, skill, hook e workflow di Foundry deve rispettare — la CI le fa rispettare.
sidebar:
  order: 5
---

:::note[La fonte normativa è il file, non questa pagina]
[`AUTHORING.md`](https://github.com/fedcal/foundry/blob/main/AUTHORING.md) nella radice del
repository è normativo, e `scripts/validate-assets.mjs` lo fa rispettare in CI. Questa pagina lo
spiega; dove le due cose divergono, vince il file.
:::

`AUTHORING.md` è stato verificato sulla documentazione ufficiale di Claude Code il **2026-08-27**
per Claude Code **2.1.247**. Non scrivere asset basandoti sul ricordo di schemi più vecchi.

## Le sette regole non negoziabili

| # | Regola | Perché |
|---|---|---|
| 1 | **Solo inglese** in ogni asset — agenti, skill, hook, comandi, workflow, commenti nel codice. | La documentazione per l'utente è bilingue e vive in `site/`, mai dentro i plugin. |
| 2 | **Nessun contenuto di terze parti incorporato.** | Tutto qui è lavoro originale sotto licenza Apache-2.0. |
| 3 | **Non duplicare mai `superpowers`.** Se una capacità esiste lì, invocala. | Reimplementare la disciplina TDD o la metodologia di debugging produce due versioni sottilmente diverse della stessa idea. |
| 4 | **Niente GSD.** Nulla può referenziare, richiedere o reimplementare `gsd-*`. | |
| 5 | **Zero dipendenze a runtime.** Node.js ≥ 20, solo libreria standard. | `npm install` non è mai necessario per usare Foundry. |
| 6 | **Multipiattaforma.** *Forma exec* degli hook (`command` + `args`), mai pipeline di shell. | Gli hook devono girare senza modifiche su Linux, macOS e Windows. |
| 7 | **Niente riempitivo generico.** Un asset che si applicherebbe a qualunque progetto senza modifiche è un difetto. | Ogni asset nomina file, comandi, soglie, standard o modalità di guasto concreti. |

## Frontmatter di un agente

```yaml
---
name: kebab-case-unique          # required, no ':' (reserved for plugin namespacing)
description: <when Claude should delegate here>   # required, decides routing
tools: Read, Grep, Glob, Bash    # omit to inherit all
disallowedTools: Write, Edit     # applied before tools resolution
model: sonnet                    # sonnet|opus|haiku|fable|<full id>|inherit
effort: medium                   # low|medium|high|xhigh|max
maxTurns: 20
permissionMode: default          # default|acceptEdits|auto|dontAsk|plan|bypassPermissions
skills: [skill-a, skill-b]       # preloaded into the agent context at startup
mcpServers: [foundry]            # scoped to this agent only
memory: project                  # user|project|local
background: false
isolation: worktree              # temporary git worktree, isolated checkout
color: cyan
hooks: { ... }                   # agent-scoped hooks
---
```

`description` è la chiave di instradamento. Decide se Claude delegherà qui, quindi va scritta come
*quando usarlo e quando no*, non come un titolo di ruolo.

### Strumenti negati ai subagent

I subagent si annidano fino a tre livelli sotto la conversazione principale e comunicano con
`SendMessage`. Al limite di profondità lo strumento `Agent` viene rimosso. Questi strumenti sono
**sempre** negati ai subagent, quindi non scrivere mai un agente che dipenda da essi:

`AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode`, `ScheduleWakeup`,
`TaskOutput`, `Workflow`.

Limita esplicitamente la profondità con `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`.

## Frontmatter di una skill

```yaml
---
name: kebab-case
description: <what it does AND when to use it>   # this is the retrieval key
allowed-tools: Read Grep Glob                    # space-separated; restricts and pre-approves
disallowed-tools: Write Edit
disable-model-invocation: true                   # user-invocable only (/name)
user-invocable: true
argument-hint: "[path] [--fix]"
context: fork                                    # run the skill in its own subagent context
agent: <agent-name>                              # run through a specific agent
model: haiku
effort: low
paths: ["src/**"]                                # scope the skill to matching paths
metadata: { foundry.vertical: dev, foundry.io: "input->output" }
license: Apache-2.0
---
```

Il corpo di `SKILL.md` **deve restare sotto le 500 righe** — `validate-assets.mjs` fa fallire la
build a 501. Tutto ciò che è più lungo va in `references/*.md`, `scripts/` o `templates/` e viene
caricato solo su richiesta. Questa è la divulgazione progressiva, ed è la differenza fra una skill
che costa 400 token soltanto per essere considerata e una che ne costa 4000.

## Instradamento di modello ed effort

Dichiara `model:` ed `effort:` su **ogni** agente. Discostarsi richiede una riga di giustificazione
nel corpo dell'agente.

| Lavoro | model | effort |
|---|---|---|
| Estrazione, classificazione, formattazione, generazione di indici, triage di lint | `haiku` | `low` |
| Implementazione, revisione, scrittura di test, refactoring, documentazione | `sonnet` | `medium` |
| Architettura, threat modelling, analisi legale, modellazione economica, sintesi finale | `opus` | `high` |
| Verifica avversariale di un risultato ad alto impatto | `opus` | `xhigh` |

### Il firewall di contesto è obbligatorio

Qualunque agente che legga molto — ricerca, audit, scansione — DEVE:

1. scrivere il proprio output completo in `.foundry/blackboard/<wave>/<agent>.json`, e
2. restituire al chiamante **solo** il percorso dell'artefatto più un riassunto di **al massimo 300
   token**.

Restituire riversamenti di file al contesto del chiamante è un difetto, e il gate `SubagentStop` lo
fa rispettare al triplo del budget configurato. Vedi [Hook](/foundry/it/reference/hooks/).

## Il modello di memoria

Quattro livelli. Non inventarne un quinto.

| Livello | Percorso | Durata | Git |
|---|---|---|---|
| T0 scratch | `.foundry/scratch/<sessione>/` | sessione | ignorato |
| T1 fatti | `.foundry/memory/facts/<id>.md` | progetto | tracciato |
| T2 runbook | `.foundry/runbooks/<slug>.md` | progetto | tracciato |
| T3 decisioni | `docs/adr/NNNN-<slug>.md` | per sempre | tracciato |

Il corpo di un fatto è al massimo 120 parole. I fatti di tipo `decision` e `risk` devono includere
una riga `**Why:**` e una `**How to apply:**` — `foundry doctor` fallisce se non ci sono. Collega i
fatti correlati con `[[fact-id]]`.

`.foundry/memory/INDEX.md` è generato, è l'**unico** file di memoria caricato nel contesto per
impostazione predefinita, ed è limitato rigidamente a 4000 token. Tutto il resto viene recuperato su
richiesta tramite il server MCP `foundry`.

**Non** scrivere mai la memoria a mano da un agente. Chiama `memory_write`, che deduplica, assegna
gli id e mantiene le catene di `supersedes`.

## Contratti di I/O

Ogni agente dichiara, alla lettera, nel proprio corpo:

```
## Input contract
`<schema-id>` — <what it needs>

## Output contract
`<schema-id>` — written to `.foundry/blackboard/<wave>/<agent>.json`
```

Gli schemi sono elencati in [Contratti](/foundry/it/reference/contracts/). Rompere uno schema
significa aggiungere `*.v2`, mai modificare `*.v1`.

## Hook

Foundry usa questi eventi, dei 31 disponibili:

| Evento | Bloccante | Bersaglio del matcher |
|---|---|---|
| `SessionStart` | no | `startup`, `resume`, `clear`, `compact`, `fork` |
| `UserPromptSubmit` | sì | — |
| `PreToolUse` | sì | nome dello strumento |
| `PostToolUse` | no | nome dello strumento |
| `PostToolUseFailure` | no | nome dello strumento |
| `PostToolBatch` | sì | — |
| `PermissionRequest` | tramite decisione | nome dello strumento |
| `SubagentStart` / `SubagentStop` | stop: sì | tipo di agente |
| `Stop` | sì | — |
| `PreCompact` / `PostCompact` | pre: sì | `manual`, `auto` |
| `TaskCreated` / `TaskCompleted` | sì | — |
| `InstructionsLoaded` | no | motivo del caricamento |
| `FileChanged` | no | nomi di file letterali |
| `WorktreeCreate` | sì | — |
| `SessionEnd` | no | motivo di chiusura |

Forma di una voce, sempre in forma exec:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "if": "Bash(git push *)",
        "statusMessage": "Foundry: checking push safety",
        "timeout": 20,
        "command": "node",
        "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/guard-bash.mjs"]
      }]
    }]
  }
}
```

Contratto di output su stdout:

```json
{ "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "...",
    "additionalContext": "...",
    "updatedInput": { }
} }
```

Budget che contano: gli hook `SessionEnd` condividono **1,5 s** fra tutti i plugin;
`UserPromptSubmit` ha un timeout di 30 s e ogni prompt lo paga. Uscire con 0 senza stdout significa
*nessuna opinione*.

## Workflow

JavaScript semplice con `await` di livello superiore, che inizia con un `meta` di soli letterali:

```js
export const meta = {
  name: 'foundry-feature-delivery',
  description: 'Wave-based delivery: analysis -> implementation -> convergence',
  phases: [{ title: 'Analysis' }, { title: 'Implementation' }, { title: 'Convergence' }],
}
```

Disponibili: `agent(prompt, opts)`, `parallel(thunks)`, `pipeline(items, ...stages)`,
`phase(title)`, `log(msg)`, `args`, `budget`, `workflow(nameOrRef, args)`.

`Date.now()`, `new Date()` e `Math.random()` **sollevano un'eccezione**. Passa i timestamp tramite
`args`.

Preferisci `pipeline()` a `parallel()`: usa una barriera solo quando una fase ha davvero bisogno di
tutti i risultati precedenti in una volta.

## Variabili di sostituzione

| Variabile | Si risolve in | Da usare per |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | directory di installazione del plugin | script, schemi e template inclusi |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/{id}/`, sopravvive agli aggiornamenti | cache, stato generato |
| `${CLAUDE_PROJECT_DIR}` | radice del progetto; nei worktree resta al checkout principale | percorsi locali al progetto |
| `${CLAUDE_SKILL_DIR}` | la directory della skill stessa | script referenziati in `allowed-tools` |
| `${user_config.KEY}` | valore di `userConfig` del plugin | endpoint e percorsi configurabili |

Nei worktree `${CLAUDE_PROJECT_DIR}` **non** segue il worktree. Leggi invece `cwd` dallo stdin
dell'hook: è ciò che fa `projectRoot()` in `lib/foundry.mjs`.

## Nomenclatura

| Elemento | Convenzione | Esempio |
|---|---|---|
| Plugin | `foundry-<verticale>` | `foundry-dev` |
| Agenti | `<dominio>-<ruolo>` | `angular-architect`, `gdpr-analyst`, `cost-engineer` |
| Skill | `<verbo>-<oggetto>` o `<dominio>-<artefatto>` | `design-api-contract`, `adr-write` |
| Comandi e skill invocabili dall'utente | `/foundry-<verticale>:<nome>` | `/foundry-legal:compliance-scan` |
| File di blackboard | `.foundry/blackboard/<wave>/<agent>.json` | |
| Schemi | `<sostantivo>.v<major>.schema.json` | `finding.v1.schema.json` |

## Interoperabilità con `superpowers`

Una dipendenza debole, rilevata a runtime, mai presunta.

| Necessità | Delegare a |
|---|---|
| Disciplina test-first | `superpowers:test-driven-development` |
| Individuare la causa radice di un guasto | `superpowers:systematic-debugging` |
| Trasformare un'idea in una specifica | `superpowers:brainstorming` |
| Trasformare una specifica in un piano | `superpowers:writing-plans` |
| Chiedere e ricevere revisione | `superpowers:requesting-code-review`, `superpowers:receiving-code-review` |
| Dichiarare il completamento | `superpowers:verification-before-completion` |

Il pattern da usare dentro una skill:

> If the `superpowers` plugin is installed, invoke `superpowers:test-driven-development` and follow
> it. If it is not, apply the reduced checklist in `references/tdd-fallback.md`.

## Worktree e parallelismo

- Un agente che scrive file mentre altri agenti scrivono file DEVE dichiarare
  `isolation: worktree`.
- I worktree finiscono in `.claude/worktrees/<nome>/`. I file ignorati da git ma necessari lì dentro
  vanno elencati in `.worktreeinclude` nella radice del repository. Il runtime copia quelle voci
  **una per una e salta i symlink**, perciò una directory che ne contenga arriva incompleta: elenca
  file veri, e verifica.
- **Foundry non registra alcun hook `WorktreeCreate`.** L'evento esiste e un hook su di esso può
  preparare l'ambiente (un'uscita non-zero annulla la creazione), ma nulla collega automaticamente
  lo stato di Foundry dentro un worktree. Il contenuto di `.foundry/` che è committato arriva
  tramite git; `.foundry/blackboard/` è gitignorato e quindi per-worktree, perciò un artefatto
  scritto dentro un worktree è invisibile al checkout principale.
- `${CLAUDE_PROJECT_DIR}` non segue un worktree: risolvi la radice del progetto dal campo `cwd`
  sullo stdin dell'hook, come fa ogni hook di Foundry.
- Gli agenti di sola lettura — audit, ricerca, revisione — **non** devono usare i worktree. È puro
  sovraccarico.

## L'asticella di qualità

Un asset viene rilasciato solo se valgono tutte queste condizioni:

- [ ] Nomina artefatti **concreti**: percorsi di file reali, comandi reali, chiavi di configurazione
      reali.
- [ ] Dichiara **quando non usarlo** e che cosa deliberatamente non copre.
- [ ] Definisce criteri di uscita **misurabili** — soglie, conteggi, gate — non "fallo bene".
- [ ] Dichiara `model:` ed `effort:` e rispetta la tabella di instradamento.
- [ ] Dichiara i contratti di input e output (agenti), o la divulgazione progressiva (skill).
- [ ] Degrada con grazia quando una dipendenza facoltativa — `superpowers`, un server MCP, una CLI
      come `gh` — è assente: rileva, dichiara, prosegui.
- [ ] Il corpo è di 500 righe o meno; il materiale più lungo vive in `references/`.
- [ ] Cita lo standard che applica quando ne esiste uno: un numero di SC WCAG 2.2, un id di
      controllo OWASP ASVS, una clausola ISO, un articolo del GDPR, un numero di RFC.

## Verificare il proprio lavoro

```bash
node scripts/validate-assets.mjs
```

Il validatore controlla il manifesto del marketplace, ogni `plugin.json`, il frontmatter di agenti e
skill, gli enum di modello ed effort, il limite di 500 righe per le skill, e cerca testo italiano
finito dentro un asset. Gira in CI e ci si aspetta che passi con zero errori.
