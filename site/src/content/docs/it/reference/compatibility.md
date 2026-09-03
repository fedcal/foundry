---
title: Compatibilità
description: Quale versione di Claude Code prende di mira Foundry, quali campi dello schema dei plugin usa e come verificare la propria installazione.
sidebar:
  order: 6
---

## Requisiti

| Requisito | Versione | Note |
|---|---|---|
| Claude Code | **2.1.x o successiva** | Lo schema dei plugin usato qui è dell'epoca 2.1 |
| Node.js | **20 o successiva** | Per il kernel: CLI, server MCP, hook |
| `superpowers` | facoltativo | Foundry gli delega e degrada con grazia quando è assente |

Non ci sono altre dipendenze a runtime. `npm install` non è mai necessario per usare Foundry: ogni
file eseguibile usa soltanto la libreria standard di Node.js.

`AUTHORING.md` è stato verificato sulla documentazione ufficiale di Claude Code il **2026-08-27**
per Claude Code **2.1.247**. È la versione contro cui gli asset sono stati scritti.

## Campi dello schema da cui Foundry dipende

Foundry non usa tutto lo schema dei plugin. Usa queste parti, e una versione di Claude Code priva di
una di esse non lo eseguirà correttamente.

| Campo o funzionalità | Dove | Perché serve a Foundry |
|---|---|---|
| `dependencies` in `plugin.json` | ogni verticale | Ogni verticale dichiara `foundry-core`, quindi installandone una arriva il kernel |
| `bin/` aggiunto al PATH | `foundry-core` | Espone il comando `foundry` |
| `mcpServers` fuso da `.mcp.json` | `foundry-core` | Registra il server MCP `foundry` |
| `hooks` fusi da `hooks/hooks.json` | `foundry-core` | Registra le nove voci di hook |
| `workflows/` | `foundry-core` | Tre workflow dinamici |
| `outputStyles` da `output-styles/` | `foundry-core` | Tre stili di output |
| Oggetto libero `metadata` | ogni plugin | Porta `foundry.vertical` e `foundry.contracts` |
| `defaultEnabled` | ogni plugin | `true` sul kernel, `false` su ogni verticale |
| `effort` degli agenti | ogni agente | L'instradamento per effort è metà dell'economia dei token |
| `isolation: worktree` sugli agenti | ops, research | Chi scrive in parallelo ha bisogno di checkout isolati |
| `memory: project` sugli agenti | quasi tutti | Memoria di agente persistente fra sessioni |
| `context: fork` e `agent:` sulle skill | `compliance-scan` e altre | Esegue una skill attraverso un agente nominato nel proprio contesto |
| `disable-model-invocation` sulle skill | `foundry-init` | Invocabile solo dall'utente |
| Condizioni `if` degli hook | contratto di authoring | Documentate per chi scrive asset |
| Evento hook `SubagentStop` | `foundry-core` | Il firewall di contesto |
| `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` | hook, `.mcp.json` | Risoluzione dei percorsi |

Il server MCP dichiara la versione di protocollo `2025-06-18` e implementa `initialize`, `ping`,
`tools/list`, `tools/call`, `resources/list` e `resources/read`. Non implementa prompt, sampling né
sottoscrizioni.

## Come verificare

### Claude Code

```
/help
```

La versione è mostrata nell'intestazione. Foundry richiede la 2.1.x o successiva.

### Node.js

```bash
node --version
```

Se stampa qualcosa sotto `v20`, la CLI, gli hook e il server MCP falliranno. Nient'altro in Foundry
dipende da Node.

### Foundry stesso

```bash
foundry doctor
```

Se il comando non viene trovato, `foundry-core` non è installato oppure Claude Code non ne ha
aggiunto la `bin/` al PATH — riavvia Claude Code o esegui `/reload-plugins`.

`foundry doctor` verifica stato, memoria, runbook, override e artefatti della blackboard, e esce con
codice diverso da zero se qualcosa fallisce. L'elenco completo dei controlli è in
[CLI](/foundry/it/reference/cli/).

### Plugin e MCP

```
/plugin
```

Elenca i plugin installati e se ciascuno è abilitato. `foundry-core` dev'essere presente e
abilitato; ogni verticale installata dev'essere elencata con `foundry-core` soddisfatto come
dipendenza.

```
/mcp
```

Deve elencare un server chiamato `foundry`. Se manca, `.mcp.json` non è stato fuso — verifica che
`foundry-core` sia abilitato e non solo installato.

### Asset, se stai contribuendo

```bash
node scripts/validate-assets.mjs
```

Valida ogni asset rispetto a `AUTHORING.md`, inclusi gli enum di modello ed effort e il limite di
500 righe per il corpo delle skill.

## Versionamento

Tutti e nove i plugin e il marketplace stesso sono alla **0.1.0**. Le verticali dichiarano
`"dependencies": [{ "name": "foundry-core", "version": "^0.1.0" }]`, quindi un kernel `0.1.x`
soddisfa una verticale `0.1.x`.

I contratti sono versionati indipendentemente dai plugin, nel nome del file: `finding.v1`, `adr.v1`
e così via. Un cambiamento rompente a un contratto aggiunge `*.v2` e lascia `*.v1` al suo posto,
così un agente più vecchio continua a validare.

## Limiti noti

- Foundry è provato contro lo schema dei plugin documentato al 2026-08-27. Una versione più recente
  di Claude Code che cambiasse i nomi dei campi nel payload degli hook —
  `last_assistant_message`, `transcript_path`, `worktree_path`, `end_reason`, `agent_type` —
  degraderebbe in silenzio i gate che li leggono, poiché un hook che non riesce a leggere il proprio
  input restituisce *nessuna opinione* anziché bloccare.
- Il gate `Stop` analizza il file di trascritto come righe JSON. Un cambiamento a quel formato
  disattiva il gate anziché rompere la sessione.
- Foundry non registra alcun hook `WorktreeCreate`, quindi nulla collega lo stato di Foundry dentro
  un worktree. Il contenuto di `.foundry/` che è committato arriva tramite git; `.foundry/blackboard/`
  è gitignorato e quindi per-worktree. `.worktreeinclude` copia file per file e salta i symlink,
  perciò una directory elencata che ne contenga arriva incompleta.
- Foundry è un progetto open source indipendente. Non è affiliato ad Anthropic, non è approvato né
  sponsorizzato da Anthropic, e non offre alcuna garanzia sulle release future di Claude Code.
