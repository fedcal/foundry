---
title: Strumenti MCP
description: I nove strumenti e le risorse esposte dal server MCP di Foundry, con i loro schemi di input reali e quando chiamare ciascuno.
sidebar:
  order: 2
---

`foundry-core` include un server MCP in `plugins/foundry-core/mcp/server.mjs`, registrato tramite
`.mcp.json` con il nome `foundry`. Parla JSON-RPC 2.0 su stdio, dichiara la versione di protocollo
`2025-06-18` e non ha dipendenze.

Esiste per una ragione sola: leggere la memoria di progetto attraverso uno strumento costa una
frazione dei token necessari a caricare i file di memoria nella finestra di contesto. Ogni strumento
restituisce il payload utile più piccolo possibile, mai un riversamento di file.

Gli strumenti si indirizzano come `mcp__plugin_foundry-core_foundry__<nome>` da dentro agenti e skill.

## Istruzioni del server

Alla `initialize` il server restituisce queste istruzioni, che sono ciò che orienta il comportamento
predefinito del modello:

> Memoria e contratti Foundry. Preferisci `memory_search` alla lettura dei file `.foundry`. Consulta
> `runbook_list` prima delle attività ricorrenti. Passa il lavoro fra agenti con `blackboard_write`,
> restituendo solo il percorso dell'artefatto e un riassunto breve.

## Gli strumenti in sintesi

| Strumento | Input obbligatorio | Chiamalo quando |
|---|---|---|
| `memory_search` | `query` | Prima di pianificare, prima di proporre un'architettura, ogni volta che l'utente cita una decisione passata |
| `memory_write` | `title`, `body`, `type` | È appena stata stabilita una decisione, un vincolo, una convenzione o un rischio |
| `memory_index` | — | Dopo aver scritto dei fatti |
| `runbook_list` | — | Prima di qualunque attività ricorrente o soggetta a errori |
| `runbook_get` | `slug` | Un runbook si applica e serve il testo completo |
| `contract_validate` | `schema` | Si verifica un artefatto prima di scriverlo, o al posto di scriverlo |
| `blackboard_write` | `wave`, `agent`, `schema`, `data` | Si passa il lavoro all'ondata successiva |
| `blackboard_read` | `wave` | Si riprende ciò che ha prodotto un'ondata precedente |
| `token_report` | — | Si risponde a "quanto sta costando" |

---

## `memory_search`

Cerca nella memoria di progetto e restituisce solo i fatti corrispondenti. Usalo al posto di leggere
i file sotto `.foundry/memory/`: è il percorso economico in token.

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `query` | stringa | sì | Parole chiave che descrivono ciò che ti serve sapere |
| `type` | enum | no | `decision` \| `constraint` \| `convention` \| `domain` \| `risk` \| `metric` \| `glossary` |
| `limit` | intero 1–25 | no | Il valore predefinito viene da `memoryRetrieval.maxFacts`, cioè `8` |

Restituisce un blocco per risultato:

```
### fact-0004 · decision · confidence high
**Persistence layer uses Flyway, not Liquibase**
Chosen for the plain-SQL migration format the team already reads.
_source: adr-0007 · scope: project_
```

Senza risultati: `No stored fact matches "<query>". Memory holds N active facts.`

## `memory_write`

Memorizza un singolo fatto atomico e durevole. Deduplica rispetto ai fatti esistenti, assegna l'id e
mantiene le catene di `supersedes`. **Non scrivere mai i file di memoria a mano.** Non usarlo per
stato transitorio di sessione.

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `title` | stringa | sì | Enuncia il fatto stesso, non l'argomento. Massimo 80 caratteri |
| `body` | stringa | sì | Massimo 120 parole. Per `decision` e `risk` includi le righe `Why:` e `How to apply:` |
| `type` | enum | sì | `decision` \| `constraint` \| `convention` \| `domain` \| `risk` \| `metric` \| `glossary` |
| `scope` | stringa | no | `project` \| `module:<nome>` \| `vertical:<nome>`. Predefinito `project` |
| `tags` | array di stringhe | no | Predefinito `[]` |
| `confidence` | enum | no | `high` \| `medium` \| `low`. Predefinito `medium` |
| `source` | stringa | no | `adr-0007` \| `conversation` \| `code` \| `external:<url>`. Predefinito `conversation` |
| `expires` | stringa | no | `AAAA-MM-GG` dopo la quale il fatto smette di essere caricato |

Restituisce l'azione compiuta e il costo dell'indice:

```
created: fact-0016 (supersedes fact-0009)
Index: 13/16 facts listed, ~1980 tokens, 3 omitted over budget.
```

L'indice viene ricostruito automaticamente a ogni scrittura, quindi una chiamata separata a
`memory_index` serve solo dopo aver modificato i fatti per altre vie.

## `memory_index`

Nessun input. Ricostruisce `.foundry/memory/INDEX.md` e riporta l'uso del budget.

```
Rebuilt /home/me/project/.foundry/memory/INDEX.md
13/16 facts listed, ~1980 tokens, 3 omitted.
```

## `runbook_list`

Nessun input. Elenca i runbook con le loro condizioni di attivazione. Consultalo **prima** di
qualunque attività ricorrente o soggetta a errori: un runbook che esiste va seguito, non
improvvisato.

```
- **deploy-production** — Deploy to production
  trigger: deploy, release to prod
- **rotate-api-keys** — Rotate third-party API keys
```

Se non ce ne sono: `No runbooks yet. Create one with the `runbook-author` skill after any task worth
repeating.`

## `runbook_get`

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `slug` | stringa | sì |

Restituisce il markdown completo di `.foundry/runbooks/<slug>.md`. Uno slug sconosciuto restituisce
un risultato di errore che elenca gli slug disponibili.

## `contract_validate`

Valida un artefatto JSON su uno schema di contratto Foundry. Restituisce l'elenco delle violazioni.

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `schema` | stringa | sì | Id del contratto, ad esempio `finding.v1` |
| `data` | oggetto | no | L'artefatto da validare |
| `path` | stringa | no | In alternativa, un percorso a un file JSON, risolto rispetto alla radice di progetto se relativo |

Va fornito esattamente uno fra `data` e `path`; senza nessuno dei due restituisce
`Provide either \`data\` or \`path\`.` come errore.

```
INVALID against finding.v1:
- missing required property "failureScenario"
```

oppure `VALID against finding.v1.`

## `blackboard_write`

Scrive un artefatto di ondata e lo valida sul suo contratto in un unico passaggio. È così che un
agente passa il lavoro all'ondata successiva.

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `wave` | stringa | sì | Id dell'ondata, ad esempio `analysis` |
| `agent` | stringa | sì | Nome dell'agente produttore |
| `schema` | stringa | sì | Id del contratto a cui l'artefatto è conforme |
| `data` | oggetto | sì | L'artefatto |

Il server imposta da sé `schema` e `producedBy` a partire da `schema` e `agent`, poi valida. In caso
di fallimento **non viene scritto nulla**:

```
Rejected: artifact does not satisfy finding.v1.
- missing required property "failureScenario"
Fix and call again.
```

In caso di successo scrive `.foundry/blackboard/<wave>/<agent>.json` e restituisce il percorso con
un costo in token, più l'istruzione del firewall:

```
Wrote .foundry/blackboard/audit/appsec-reviewer.json (2841 bytes, ~711 tokens).
Return to your caller ONLY this path and a summary of at most 300 tokens.
```

`wave` e `agent` vengono sanificati: tutto ciò che è fuori da `[A-Za-z0-9._-]` diventa `-`, ed
entrambi sono troncati a 80 caratteri. È questo che impedisce a un nome di ondata di uscire dalla
directory della blackboard.

## `blackboard_read`

Legge gli artefatti di un'ondata. Per impostazione predefinita restituisce metadati e riassunti.

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `wave` | stringa | sì | |
| `agent` | stringa | no | Limita a un solo produttore |
| `full` | booleano | no | Restituisce l'artefatto intero. Usalo solo se ti serve davvero |

Forma predefinita (riassunto), una voce per artefatto:

```
- **appsec-reviewer.json** · schema review.v1 · by appsec-reviewer · ~711 tokens
  Six findings, two high. Access control on /api/orders is the blocking one.
```

La riga di riassunto è presa da `summary`, poi `title`, poi `goal`, troncata a 400 caratteri;
`(no summary field)` quando nessuno dei tre esiste. Con `full: true` ogni artefatto viene restituito
alla lettera in un blocco JSON — che è esattamente il riversamento di file che il firewall di
contesto esiste per impedire, quindi passalo in modo deliberato.

## `token_report`

Nessun input. Riporta la contabilità dei token di Foundry per il progetto, inclusi gli eventi di
gate registrati.

```
# Foundry token report

- Memory index: ~1980 tokens of a 4000 budget (always in context)
- Facts stored: 16, ~9700 tokens total (retrieved on demand only)
- Blackboard artifacts: ~24800 tokens (never enter context wholesale)
- Recorded events: memory_search=41, memory_write=16, gate_blocked=3, blackboard_write=9

Loading all memory eagerly would cost ~34500 tokens per session; the index-first path costs ~1980.
```

I conteggi degli eventi provengono da `.foundry/metrics/events.jsonl`, che è escluso da git.

---

## Risorse

Il server implementa anche `resources/list` e `resources/read`. Due risorse sono sempre presenti,
più una per ogni runbook.

| URI | Nome | Contenuto |
|---|---|---|
| `foundry://memory/index` | Indice di memoria | `.foundry/memory/INDEX.md`, costruito al volo se manca |
| `foundry://contracts` | Contratti di I/O | Un elenco markdown di ogni id di contratto disponibile |
| `foundry://runbooks/<slug>` | Runbook: `<titolo>` | Il markdown del runbook; la descrizione della risorsa è il suo trigger |

Tutte e tre sono `text/markdown`. Un URI sconosciuto restituisce l'errore JSON-RPC `-32602` con il
messaggio `Unknown resource: <uri>`.

## Limiti

- `memory_search` è punteggio per parole chiave, non ricerca semantica. Un fatto formulato in modo
  diverso dalla tua query può non emergere; `type` e `limit` restringono, non allargano.
- Il server è privo di stato fra una chiamata e l'altra e rilegge da disco ogni volta. È economico,
  ma non è una cache.
- Uno strumento che solleva un'eccezione restituisce un *risultato* di errore anziché un errore
  JSON-RPC, così il modello vede il messaggio e può correggersi: `<strumento> failed: <messaggio>`.
- Sono implementati solo `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list` e
  `resources/read`. Non ci sono prompt, sampling né sottoscrizioni.
