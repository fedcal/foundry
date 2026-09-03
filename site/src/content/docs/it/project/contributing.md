---
title: Contribuire
description: L'asticella di qualità per un asset Foundry e i tre controlli da eseguire in locale prima di aprire una pull request.
sidebar:
  order: 1
---

I contributi sono benvenuti. Due documenti li governano:

- [`AUTHORING.md`](https://github.com/fedcal/foundry/blob/main/AUTHORING.md) — **normativo**, e
  fatto rispettare dalla CI. Leggilo per primo. Una lettura discorsiva è in
  [Scrivere asset](/foundry/it/reference/authoring/).
- [`CONTRIBUTING.md`](https://github.com/fedcal/foundry/blob/main/CONTRIBUTING.md) — il processo:
  branch, commit, pull request, revisione.

## I tre controlli in locale

Eseguili tutti e tre prima di aprire una pull request. Sono gli stessi controlli che esegue la CI.

```bash
node scripts/validate-assets.mjs                    # every asset against AUTHORING.md
node --test 'plugins/*/test/*.test.mjs'  # test unitari, tutti i plugin
cd site && npm ci && npm run build                  # the documentation site
```

| Controllo | Che cosa intercetta |
|---|---|
| `validate-assets.mjs` | Una voce di marketplace senza directory di plugin, un `plugin.json` il cui nome non corrisponde alla directory, frontmatter di agente o skill mancante, un `model` o un `effort` fuori dall'enum ammesso, un corpo di `SKILL.md` oltre le 500 righe, e testo italiano finito dentro un asset. |
| `node --test` | Regressioni nel kernel: risoluzione dei percorsi, archivio di memoria, generatore dell'indice, validatore JSON Schema, contabilità dei token. |
| `npm run build` | Link interni rotti, frontmatter non valido, e qualunque pagina che non compili. |

Solo il terzo richiede `npm`. I primi due usano la libreria standard di Node.js, perché Foundry
stesso ha zero dipendenze a runtime e la sua toolchain si tiene alla stessa regola.

## L'asticella di qualità

Un asset viene rilasciato solo se valgono tutte queste condizioni. È la checklist con cui lavorano i
revisori.

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

La regola che coglie in fallo la maggior parte dei primi contributi è **niente riempitivo
generico**. Un asset che si applicherebbe invariato a qualunque progetto è un difetto, non un punto
di partenza.

## Regole non negoziabili

| Regola | Conseguenza se violata |
|---|---|
| Solo inglese dentro i plugin | `validate-assets.mjs` fallisce sui marcatori italiani |
| Nessun contenuto di terze parti incorporato | PR respinta; tutto qui è lavoro originale Apache-2.0 |
| Non duplicare mai `superpowers` | PR respinta; invocalo invece |
| Zero dipendenze a runtime | PR respinta; solo libreria standard |
| Hook multipiattaforma, solo forma exec | PR respinta; niente pipeline di shell |
| Non modificare mai uno schema `*.v1` in modo rompente | Aggiungi `*.v2` |

## Dove va che cosa

| Contributo | Posizione |
|---|---|
| Un nuovo agente | `plugins/foundry-<verticale>/agents/<dominio>-<ruolo>.md` |
| Una nuova skill | `plugins/foundry-<verticale>/skills/<verbo>-<oggetto>/SKILL.md` |
| Materiale di riferimento per una skill | `references/` accanto al `SKILL.md`, caricato su richiesta |
| Un nuovo contratto | `plugins/foundry-core/schemas/<sostantivo>.v<major>.schema.json` |
| Una nuova giurisdizione | `plugins/foundry-legal/packs/<id>.json` — vedi il formato in [foundry-legal](/foundry/it/plugins/legal/) |
| Documentazione | `site/src/content/docs/{en,it}/…`, entrambe le lingue |

La documentazione è bilingue EN/IT e vive in `site/`, mai dentro un plugin. Le pagine italiane
mantengono nomi di file e `sidebar.order` identici; viene tradotto solo il contenuto.

## Template di issue

Il repository include quattro percorsi di ingresso sotto `.github/ISSUE_TEMPLATE/`: una segnalazione
di bug, una proposta di asset, una proposta di pacchetto di giurisdizione, e una configurazione che
instrada tutto il resto.

Usa il template delle giurisdizioni per un pacchetto di conformità: chiede, controllo per controllo,
se la citazione è stata confermata su un testo ufficiale — la domanda che decide se
`unverifiedCitation` resta `true`.

## Licenza

Apache-2.0. Contribuendo accetti che il tuo contributo sia rilasciato sotto tale licenza. Vedi
[`LICENSE`](https://github.com/fedcal/foundry/blob/main/LICENSE) e
[`NOTICE`](https://github.com/fedcal/foundry/blob/main/NOTICE).
