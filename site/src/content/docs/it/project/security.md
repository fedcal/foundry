---
title: Sicurezza
description: Che cosa rientra nel perimetro di una segnalazione di sicurezza per Foundry, che cosa no, e come segnalare.
sidebar:
  order: 2
---

[`SECURITY.md`](https://github.com/fedcal/foundry/blob/main/SECURITY.md) nel repository è la
politica autorevole. Questa pagina la riassume.

## Segnalare

Segnala in privato, non in una issue pubblica. Usa la segnalazione privata di vulnerabilità di
GitHub sul [repository](https://github.com/fedcal/foundry) — scheda *Security*, *Report a
vulnerability*.

Includi, dove puoi:

- che cosa ottiene un attaccante;
- i passi esatti o l'input che innesca il problema;
- il file e la versione interessati;
- se richiede che l'utente abbia già accettato una chiamata a uno strumento.

L'ultimo punto conta qui più che nella maggior parte dei progetti: Foundry gira dentro Claude Code,
dove l'utente sta già concedendo a un modello la possibilità di eseguire comandi. Una segnalazione
dovrebbe dire che cosa Foundry aggiunge a quell'esposizione.

## Che cosa rientra nel perimetro

| Area | Esempi |
|---|---|
| Hook di guardia | Un pattern di comando distruttivo che aggira `guard-bash`; un formato di credenziale che sfugge a `guard-write`; un modo per far restituire *allow* a un gate che dovrebbe negare |
| Gestione dei percorsi | Uscire da `.foundry/blackboard/` tramite un argomento `wave` o `agent` costruito ad arte per `blackboard_write`; scrivere fuori dalla radice del progetto |
| Il server MCP | Leggere un file fuori dal progetto tramite l'argomento `path` di `contract_validate` o un URI di risorsa; far crollare il server in modo da disattivare i gate |
| Validazione dei contratti | Un artefatto che valida ma non dovrebbe, in modo tale da far agire un agente a valle su dati non verificati |
| Override | Far applicare un override scaduto, o far applicare un override a un gate che non nomina |
| Preparazione dei worktree | Collegare o scrivere fuori dal worktree previsto |
| Catena di fornitura di questo repository | Qualunque cosa in un workflow sotto `.github/workflows/` che possa eseguire input non fidato con permessi elevati |

## Che cosa non rientra nel perimetro

- **Il comportamento del modello.** Prompt injection contro Claude, un agente convinto a prendere
  una decisione sbagliata, o un modello che produce codice insicuro riguardano Claude Code e il
  modello, non sono vulnerabilità di Foundry. Segnalale ad Anthropic.
- **La qualità dei consigli.** Un agente che dà una raccomandazione architetturale, legale o di
  sicurezza sbagliata è un bug, non una vulnerabilità. Apri una issue normale.
- **L'accuratezza dei pacchetti di giurisdizione.** Ogni pacchetto ha `lastReviewed: null` e
  citazioni non verificate, per scelta e per dichiarazione. Una citazione errata è un problema di
  accuratezza: apri una issue normale con il testo ufficiale.
- **Il fatto che i gate siano aggirabili dall'utente.** `enforcement: off` e
  `.foundry/overrides.json` esistono deliberatamente. Un utente che disattiva i propri gate è il
  comportamento documentato, non una vulnerabilità.
- **Plugin di terze parti**, incluso `superpowers`. Segnalali a monte.

## Scelte progettuali rilevanti per la sicurezza

Alcuni comportamenti sembrano debolezze e sono deliberati. Sono documentati perché una segnalazione
possa riguardare se il compromesso sia quello giusto, e non se esista.

| Comportamento | Ragione |
|---|---|
| Un hook che non riesce a leggere il proprio input non esprime opinione anziché negare | Un payload malformato non deve bloccare una sessione. La modalità di guasto è permissiva per scelta. |
| Il gate `Stop` legge solo le ultime 400 righe del trascritto | Una lettura limitata a ogni turno. Una verifica molto più indietro in un turno lunghissimo può sfuggire. |
| Il rilevamento di credenziali non ha override | Se è reale non dovrebbe stare in un file tracciato; se è un segnaposto, rendilo palesemente finto. |
| I percorsi protetti generano escalation anziché diniego | Modificare la CI o un lockfile è legittimo; farlo senza che nessuno se ne accorga no. |
| `.foundry/metrics/` è escluso da git | I log degli eventi registrano query e motivazioni dei gate e restano sulla macchina che li ha prodotti. |

## Versioni supportate

Foundry è alla **0.1.0**. Le correzioni arrivano sulla release corrente; non esiste un ramo con
supporto a lungo termine.

## Divulgazione

Le segnalazioni vengono riscontrate e gestite in privato. La correzione viene pubblicata come
release insieme a un GitHub Security Advisory, con credito al segnalante salvo diversa richiesta.

`foundry-oss` include la skill `security-advisory` che esegue questo stesso processo — raccolta,
punteggio CVSS, pianificazione di correzione e backport, embargo, pubblicazione GHSA, richiesta CVE
e credito al segnalante — per i progetti che adottano Foundry.

## Licenza e indipendenza

Apache-2.0. Foundry è un progetto open source indipendente. Non è affiliato ad Anthropic, non è
approvato né sponsorizzato da Anthropic.
