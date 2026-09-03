---
title: foundry-oss
description: Governance open source — diritti di decisione, processo RFC, triage delle issue, versionamento semantico, comunicazione dei rilasci e disclosure coordinata.
sidebar:
  order: 9
---

`foundry-oss` copre la parte di un progetto open source che non è codice: chi decide, come una
proposta diventa una decisione, come una casella di issue diventa un elenco di azioni ordinate per
priorità, come un numero di versione si deriva dal diff reale, e come si gestisce una segnalazione
di sicurezza senza improvvisare.

## Installazione

```bash
/plugin install foundry-oss@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Un progetto sta per diventare pubblico e non ha file CONTRIBUTING, CODE_OF_CONDUCT, SECURITY o
  GOVERNANCE.
- Nessuno sa dire chi decide, o quando un cambiamento richiede una RFC.
- Le issue arrivano più in fretta di quanto vengano smistate e il backlog ha smesso di essere
  informativo.
- Le versioni si scelgono in base all'intenzione anziché a ciò che è cambiato davvero.
- Arriva privatamente una segnalazione di sicurezza e non esiste un processo di disclosure.

## Quando non usarlo

- Su un progetto interno a codice chiuso gran parte di questo è inapplicabile. Il profilo
  `oss-library` esiste per il caso opposto.
- Non esegue i rilasci in CI — quello è `release-engineer` in `foundry-ops`. Questo plugin decide e
  comunica la versione; ops la spedisce.
- `triage-inbox`, `version-bump` e `security-advisory` operano su GitHub tramite `gh`. Senza un `gh`
  autenticato descrivono le azioni invece di applicarle.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `governance-architect` | Decide chi decide: BDFL, consiglio di manutentori o consenso, quando un cambiamento richiede una RFC, come i manutentori vengono nominati e rimossi, come si risolvono i conflitti. | `opus` | `high` |
| `community-manager` | Progetta e ripara l'imbuto dei contributori: good-first-issue davvero completabili, tempi di risposta dichiarati pubblicamente, galateo della revisione, riconoscimento, pratica del codice di condotta. | `sonnet` | `medium` |
| `issue-triager` | Il triage come protocollo ripetibile: verifica di riproducibilità, tassonomia delle label, severità separata dalla priorità, rilevamento dei duplicati, trasformazione di una segnalazione vaga in qualcosa di azionabile. | `sonnet` | `medium` |
| `release-communicator` | Applica SemVer 2.0.0 al diff reale — incluse regressioni di comportamento e prestazioni — scrive un changelog per esseri umani a partire dai Conventional Commit e produce le note di aggiornamento. | `sonnet` | `medium` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `bootstrap-oss` | Si crea o si ripara l'insieme dei file di governance di un repository, a una banda di maturità dichiarata (`--band B0..B3`). |
| `rfc` | Si conduce il ciclo di vita di una RFC per un cambiamento sopra la soglia di proposta del progetto: `new`, `discuss`, `decide`, `record`. |
| `triage-inbox` | Si lavora sulle issue e pull request aperte secondo le regole di contribuzione del progetto stesso, producendo un elenco di azioni prioritizzate e i comandi `gh` esatti. |
| `version-bump` | Si decide la versione successiva dal diff reale anziché dall'intenzione dell'autore, si genera un changelog dallo storico dei commit e si scrivono le note di migrazione per un cambiamento rompente. |
| `security-advisory` | Si conduce la disclosure coordinata dall'inizio alla fine: `intake`, `score` (CVSS), `plan` (correzione e backport), `publish` (GHSA, richiesta CVE, credito al segnalante). |

`bootstrap-oss` e `triage-inbox` accettano entrambe `--dry-run`; `triage-inbox` richiede inoltre un
`--apply` esplicito prima di modificare qualsiasi cosa sul repository.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `governance-architect` | `requirement.v1` | `adr.v1` — le decisioni di governance registrate come qualsiasi altra decisione costosa da revocare |
| `community-manager` | `finding.v1` | `plan.v1` |
| `issue-triager` | `handoff.v1` | `review.v1` |
| `release-communicator` | `review.v1` | `handoff.v1` |

## Che cosa contiene

Tredici template di governance in `templates/`, usati da `bootstrap-oss`:

| File | Scopo |
|---|---|
| `README.md` | scheletro del README di progetto |
| `CONTRIBUTING.md` | flusso di contribuzione |
| `CODE_OF_CONDUCT.md` | politica di condotta |
| `SECURITY.md` | percorso di segnalazione e versioni supportate |
| `GOVERNANCE.md` | diritti di decisione e ciclo di vita dei manutentori |
| `SUPPORT.md` | dove chiedere che cosa |
| `MAINTAINERS.md` | chi è responsabile di che cosa |
| `CODEOWNERS` | instradamento delle revisioni |
| `FUNDING.yml` | metadati di finanziamento |
| `PULL_REQUEST_TEMPLATE.md` | checklist per le PR |
| `ISSUE_TEMPLATE/bug_report.yml` | raccolta strutturata dei bug |
| `ISSUE_TEMPLATE/feature_request.yml` | raccolta strutturata delle proposte |
| `ISSUE_TEMPLATE/config.yml` | configurazione del selettore di issue |

`templates/labels.json` fornisce la tassonomia di label che `triage-inbox` e la skill `github-setup`
del PMO applicano entrambe, così i due plugin non sono in disaccordo sul significato di una label.

## Limiti

- Specifico di GitHub. Template di issue, advisory GHSA, Projects v2 e ruleset non hanno qui
  equivalenti per GitLab o Codeberg.
- Il punteggio CVSS è un giudizio strutturato, non una consultazione. `security-advisory --score`
  produce un vettore e una motivazione che ci si aspetta tu riveda prima della pubblicazione.
- I template sono punti di partenza a una banda di maturità, non un artefatto di conformità. Un
  progetto con obblighi normativi dovrebbe usare anche `foundry-legal`.
