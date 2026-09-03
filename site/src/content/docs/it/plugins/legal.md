---
title: foundry-legal
description: Un motore di conformità guidato da pacchetti di giurisdizione, più analisi di privacy, governance dell'AI, conformità di accessibilità e licenze.
sidebar:
  order: 8
---

:::caution[Valutazione tecnica automatica. Non è consulenza legale.]
Un pacchetto di giurisdizione è una checklist leggibile da una macchina, scritta da ingegneri. Non è
un enunciato di legge, non è esaustivo e non sostituisce un avvocato qualificato o un responsabile
della protezione dei dati. Ogni pacchetto in questo repository ha `lastReviewed: null` e un array
`sources` vuoto, e il motore è tenuto a dichiararlo in ogni report.
:::

`foundry-legal` separa i **dati** dal **ragionamento**. I controlli stanno in pacchetti JSON; il
giudizio sta negli agenti. Aggiungere un Paese significa lasciar cadere un file JSON in `packs/` —
nessuna modifica ad agenti, skill o codice.

## Installazione

```bash
/plugin install foundry-legal@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Il prodotto tratta dati personali e nessuno ha tracciato dove entrano, come fluiscono, dove sono
  conservati, replicati, registrati e cancellati.
- Si sta rilasciando una funzionalità di AI e il ruolo dell'organizzazione — fornitore, deployer,
  integratore — non è mai stato classificato.
- Va resa pubblica una dichiarazione di conformità all'accessibilità e qualcuno deve decidere che
  cosa si possa onestamente dichiarare con le evidenze disponibili.
- Le licenze delle dipendenze non sono mai state inventariate, o potrebbe essersi attivata una
  clausola di copyleft.
- Stai costruendo per la pubblica amministrazione italiana o europea, dove gli obblighi sono
  espliciti.

## Quando non usarlo

- Non usarlo al posto di un legale. Produce evidenze e lacune, non pareri di diritto.
- Non usarlo per dichiarare conformità. I pacchetti dicono solo che cosa va *dimostrato*; nessun
  pacchetto afferma che qualcosa *è* conforme.
- Il test e la correzione tecnica dell'accessibilità spettano ad `accessibility-engineer` in
  `foundry-dev`. Questo plugin si occupa della dichiarazione di conformità, del suo perimetro e
  della sua onestà.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `compliance-engine` | Determina quali pacchetti si applicano dal profilo di progetto, valuta il predicato `appliesWhen` di ogni controllo ed emette un `compliance-check.v1` per controllo. | `opus` | `high` |
| `privacy-engineer` | Protezione dei dati fin dalla progettazione nel codice: traccia dove i dati personali entrano, fluiscono, sono conservati, replicati, registrati e cancellati; mappa ogni finalità su una base giuridica. | `opus` | `high` |
| `ai-governance-analyst` | Classifica il sistema di AI e il ruolo dell'organizzazione (fornitore, deployer, integratore), determina gli obblighi di trasparenza e informativa, verifica la supervisione umana. | `opus` | `high` |
| `accessibility-compliance-analyst` | Il lato legale dell'accessibilità: il perimetro di una dichiarazione di conformità, che cosa si possa onestamente dichiarare con le evidenze disponibili, la stesura della dichiarazione. | `opus` | `high` |
| `licence-analyst` | Igiene di licenze open source e proprietà intellettuale: inventario delle licenze delle dipendenze, compatibilità fra termini permissivi, copyleft debole, copyleft forte e copyleft di rete. | `opus` | `high` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `compliance-scan` | Si esegue una valutazione di conformità sui pacchetti di giurisdizione. Determina quali pacchetti si applicano dal profilo di progetto — dati trattati, utenti, settore, geografia di deployment. |
| `privacy-review` | Una revisione di protezione dei dati a livello di codice: dove entrano i dati personali, come fluiscono, dove sono conservati e replicati, dove finiscono nei log, e se vengano davvero cancellati. Gira attraverso `privacy-engineer`. |
| `licence-audit` | Costruzione dell'inventario delle licenze delle dipendenze dall'albero transitivo risolto e dall'artefatto distribuito, e determinazione di quali obblighi siano davvero attivati dal modo in cui il software viene distribuito. Gira attraverso `licence-analyst`. |
| `accessibility-statement` | Produzione di una dichiarazione di conformità e di accessibilità a partire da evidenze reali di audit, rifiutando di dichiarare più di quanto le evidenze sostengano. Gira attraverso `accessibility-compliance-analyst`. |

`compliance-scan` gira attraverso l'agente `compliance-engine` in un contesto separato
(`context: fork`, `agent: compliance-engine`, `model: opus`, `effort: high`) e accetta:

```
/foundry-legal:compliance-scan [--packs eu,it,global-baseline] [--profile path]
                               [--theme privacy|ai|accessibility|licensing] [--dry-run]
```

`--dry-run` valida i pacchetti stessi: unicità di `controlId`, enum di `theme` e `severity`, e
qualsiasi fatto di profilo referenziato da un pacchetto ma assente dal vocabolario pubblicato.

Le tre skill tematiche accettano tutte un argomento di restrizione, così una revisione ha un
perimetro delimitato:
`privacy-review [--flow entry|storage|logs|deletion|rights|transfers]`,
`licence-audit [--conveyance saas|binary|container|onprem|library] [--fail-on copyleft|unknown]`,
`accessibility-statement [--instrument en301549|section508|wcag] [--scope <percorso-o-pattern-url>]`.

## Pacchetti di giurisdizione

| Id pacchetto | Nome | Controlli |
|---|---|---|
| `global-baseline` | Base globale (standard e framework, non legge) | 40 |
| `eu` | Unione europea | 39 |
| `it` | Italia (strato nazionale sopra `eu.json`) | 16 |
| `north-america` | Stati Uniti e Canada | 26 |
| `uk-apac-latam` | Regno Unito, Asia-Pacifico e America Latina | 26 |

Il pacchetto italiano è uno strato nazionale sopra quello europeo e copre strumenti come il Codice
Privacy (D.Lgs. 196/2003), i provvedimenti del Garante, la Legge 4/2004 (Stanca) e le linee guida
AgID sull'accessibilità, il Codice dell'Amministrazione Digitale (D.Lgs. 82/2005), il Codice dei
contratti pubblici (D.Lgs. 36/2023) e il recepimento italiano della direttiva NIS2 vigilato da ACN.

### Formato del pacchetto

`packs/PACK-FORMAT.md` è la descrizione normativa di `pack.v1`. In sintesi:

| Campo di intestazione | Regola |
|---|---|
| `id` | kebab minuscolo, uguale al nome del file senza `.json`; diventa `compliance-check.v1.jurisdiction` |
| `name` | etichetta leggibile |
| `scope` | a chi si applica **e** che cosa esclude deliberatamente |
| `lastReviewed` | `null` in questo repository; un fork che verifica sui testi ufficiali imposta la data e riempie `sources` |
| `sources` | vuoto finché qualcuno non verifica; le voci sono `{ instrument, url, consultedOn }` |
| `verificationRequired` | frase di avvertimento obbligatoria, presente in ogni pacchetto |

| Campo del controllo | Obbligatorio | Note |
|---|---|---|
| `controlId` | sì | `<packId>-<instrument-slug>-<short-name>`, unico fra tutti i pacchetti |
| `theme` | sì | uno fra `governance` `privacy` `security` `ai` `accessibility` `licensing` `records` `resilience` `consumer` |
| `instrument` | sì | copiato alla lettera in `compliance-check.v1.instrument` |
| `requirement` | sì | l'obbligo in termini generali, una o due frasi, senza soglie inventate |
| `appliesWhen` | sì | predicato: `always`, `allOf`, `anyOf`, `noneOf` |
| `evidenceHints` | sì | almeno due, ciascuna con prefisso `code:` `doc:` `cmd:` `config:` `ask:` |
| `severity` | sì | `critical` \| `high` \| `medium` \| `low` — esposizione se non affrontato, non sforzo |
| `unverifiedCitation` | no | `true` quando la citazione non è stata confermata sul testo ufficiale |

### Come vengono trattate le incognite

Il predicato `appliesWhen` viene valutato su un profilo di progetto fatto di booleani con namespace
puntato (`data.personal`, `markets.eu`, `product.genai-feature`, `org.controller` e così via) con
tre valori possibili: `true`, `false` e `"unknown"`. Ciò che manca dal profilo è `"unknown"`.

1. Se un fatto referenziato è `"unknown"` e il predicato non è già decidibile dai fatti noti, il
   controllo viene emesso con `status: "undetermined"` e una motivazione che nomina il fatto di
   profilo mancante. Non viene mai scartato in silenzio.
2. Se il predicato è decidibilmente falso, il controllo viene emesso come `not-applicable` con il
   fatto che lo ha deciso.
3. Altrimenti viene valutato sulle evidenze.

"Unknown" non viene mai ridotto a "false". Quella riduzione è il modo più comune in cui uno
strumento di conformità automatico produce una risposta sbagliata con sicurezza.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `compliance-engine` | `handoff.v1` e `requirement.v1` | `compliance-check.v1`, un artefatto per controllo, scritto come array |
| `privacy-engineer` | `compliance-check.v1` | `compliance-check.v1` per controllo di privacy, più `finding.v1` per i difetti a livello di codice |
| `ai-governance-analyst` | `compliance-check.v1` | `compliance-check.v1` per controllo relativo all'AI |
| `accessibility-compliance-analyst` | `compliance-check.v1` | `compliance-check.v1` per controllo di accessibilità |
| `licence-analyst` | `compliance-check.v1` | `compliance-check.v1` per controllo di licenza |

`compliance-check.v1` richiede un campo `disclaimer` il cui unico valore ammesso è la costante
`"Automated technical assessment. Not legal advice."`. Lo schema rende la clausola non rimovibile:
un artefatto che ne è privo non valida.

Richiede inoltre uno `status` fra `compliant`, `partial`, `non-compliant`, `not-applicable`,
`undetermined` — e una `rationale` per quello scelto.

## Aggiungere una giurisdizione

1. Copia un pacchetto esistente, mantieni la forma dell'intestazione, imposta `lastReviewed: null` e
   `sources: []`.
2. Scrivi i controlli usando il vocabolario di profilo pubblicato; non aggiungere fatti se non è
   davvero necessario.
3. Esegui `/foundry-legal:compliance-scan --packs <nuovo-id> --dry-run`.
4. Apri una PR che dichiari, controllo per controllo, se la citazione è stata confermata su un testo
   ufficiale. Ciò che non è confermato mantiene `unverifiedCitation: true`.

Non inventare mai un numero di articolo, una scadenza, una soglia monetaria o l'entità di una
sanzione. Se non sei certo, nomina soltanto lo strumento e imposta `unverifiedCitation: true`.

## Limiti

- Ogni pacchetto qui distribuito è **non verificato**: `lastReviewed` è `null` e `sources` è vuoto.
  Le citazioni possono essere errate o superate, e il motore lo dichiara in ogni report.
- La copertura è disomogenea per scelta. I pacchetti europeo e di base globale sono i più
  approfonditi; APAC e America Latina sono raggruppati in un solo pacchetto di 26 controlli e non
  sono esaustivi.
- Il motore valuta le evidenze presenti nel repository. Gli obblighi assolti fuori dalla codebase —
  un DPA firmato, una DPIA completata, un registro tenuto in un altro sistema — risultano
  `undetermined` a meno che tu non punti il profilo verso di essi.
