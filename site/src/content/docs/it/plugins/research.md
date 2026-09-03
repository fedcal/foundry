---
title: foundry-research
description: Ricerca di dominio, valutazione tecnologica, verifica delle affermazioni e ingegneria della documentazione.
sidebar:
  order: 2
---

`foundry-research` copre il lavoro che precede e circonda il codice: capire un dominio di business
che nessuno in squadra sa parlare, scegliere una tecnologia con cui bisognerà convivere, verificare
un'affermazione prima che diventi portante, e trasformare la documentazione da cartella di markdown
a sistema con responsabili e una build.

## Installazione

```bash
/plugin install foundry-research@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- La squadra non sa ancora nominare gli utenti, il flusso di lavoro che si sta sostituendo o il
  vocabolario del dominio.
- Va scelto un framework, un database, una coda, un provider di autenticazione o un vendor di
  osservabilità e sbagliare costerebbe caro.
- Un numero, un obbligo normativo o una garanzia di compatibilità sta per finire in un ADR e
  nessuno lo ha inseguito fino alla fonte.
- Il progetto ha un README che nessuno riesce a seguire, o un sito di documentazione senza
  architettura dell'informazione.

## Quando non usarlo

- Non serve a scrivere codice — quello è `foundry-dev`.
- `technical-writer` lavora su una pagina il cui quadrante Diátaxis e il cui pubblico sono già
  assegnati. Non decide la struttura del sito: lo fa `docs-architect`, che a sua volta non scrive
  la prosa.
- `evidence-verifier` verifica **un'affermazione alla volta**. Non è un revisore di documenti, un
  auditor di codice o un controllore di stile.
- La documentazione di riferimento generabile da OpenAPI, protobuf, Javadoc o TypeDoc va generata,
  non scritta a mano. `api-reference` lo impone.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `domain-researcher` | Stabilisce chi sono davvero gli utenti, quale flusso manuale o preesistente si sta sostituendo e qual è il vocabolario del dominio, prima che esistano codice, schema o interfaccia. | `opus` | `high` |
| `tech-scout` | Valuta tecnologie candidate quando convivere con la scelta sbagliata sarebbe costoso, e produce una raccomandazione con le opzioni scartate messe a verbale. | `opus` | `high` |
| `evidence-verifier` | Cerca di **confutare** una singola affermazione portante anziché confermarla, insegue ogni citazione fino all'origine e restituisce `refuted` quando l'affermazione non è dimostrabile. | `opus` | `xhigh` |
| `docs-architect` | Progetta l'architettura dell'informazione, mappa i pubblici sui quadranti Diátaxis, collega la toolchain docs-as-code e assegna a ogni pagina un responsabile e una cadenza di revisione. Verifica anche un sito esistente. | `opus` | `high` |
| `technical-writer` | Scrive o revisiona una singola pagina secondo uno stile dichiarato: titoli orientati al compito, un'idea per paragrafo, esempi che funzionano davvero. Gira con `isolation: worktree`. | `sonnet` | `medium` |

`domain-researcher`, `tech-scout`, `evidence-verifier` e `docs-architect` dichiarano tutti
`disallowedTools: Write, Edit, NotebookEdit`: sono di sola lettura per costruzione e producono
output attraverso la blackboard.

## Skill

| Skill | Quando si attiva |
|---|---|
| `research-domain` | Un dominio di business sconosciuto va esplorato da più fonti prima che inizi la progettazione. |
| `evaluate-technology` | Si sta scegliendo un framework, un database, una coda, un provider di autenticazione o un vendor di osservabilità. |
| `docs-site` | Si avvia o si verifica un sito di documentazione — struttura, navigazione, ricerca, versioni, traduzioni, responsabilità e la CI che fallisce quando la documentazione marcisce. |
| `write-readme` | Un progetto non ha un README, o ne ha uno che non porta il lettore al primo successo. |
| `api-reference` | La documentazione di riferimento va generata dalla fonte di verità e mantenuta verificata rispetto al codice in CI. |

`research-domain` ed `evaluate-technology` accettano `--budget-searches N`, così una campagna di
ricerca ha un tetto di costo che imposti tu e non uno che l'agente scopre strada facendo.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `domain-researcher` | `requirement.v1` | voci `fact.v1` più un `handoff.v1` |
| `tech-scout` | `requirement.v1` | `adr.v1` |
| `evidence-verifier` | `finding.v1` — una sola affermazione | `finding.v1` con `verdict` impostato a `confirmed`, `plausible` o `refuted` |
| `docs-architect` | `requirement.v1` | `plan.v1` |
| `technical-writer` | `plan.v1` | `review.v1` |

## Limiti

- La ricerca sul web dipende dagli strumenti che la sessione ha davvero. Senza accesso alla rete
  questi agenti si riducono a ciò che c'è nel repository e lo dichiarano, invece di inventare fonti.
- `evidence-verifier` restituisce `refuted` quando un'affermazione non è dimostrabile. È
  deliberato: un'affermazione non verificabile e una falsa ricevono lo stesso trattamento, il che
  ogni tanto respingerà qualcosa che per caso era vero.
