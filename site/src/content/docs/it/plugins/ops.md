---
title: foundry-ops
description: Pipeline GitHub Actions, container, Kubernetes, Terraform/OpenTofu, target cloud e PaaS, release engineering.
sidebar:
  order: 5
---

`foundry-ops` copre tutto ciò che sta fra un commit fuso e un sistema in esecuzione: la pipeline,
l'immagine, il cluster, il codice dell'infrastruttura, il target di deployment e il treno dei
rilasci.

Tre dei suoi sei agenti dichiarano `isolation: worktree`, perché scrivono file mentre altri agenti
potrebbero a loro volta scrivere file.

## Installazione

```bash
/plugin install foundry-ops@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Il repository non ha CI, oppure il feedback sulle PR è così lento che la gente smette di
  leggerlo.
- Il workflow usa segreti cloud di lunga durata o action di terze parti non fissate a un digest.
- Le immagini sono grandi, lente da costruire, o uno scanner segnala vulnerabilità e nessuno sa
  quali contino davvero.
- I pod vengono terminati per OOM o rallentati dal throttling della CPU, oppure le probe causano
  tempeste di riavvii e 502 durante i deploy.
- Il codice dell'infrastruttura è cresciuto per copia-incolla fra ambienti e va in deriva in
  silenzio.

## Quando non usarlo

- Non installarlo per "avere Kubernetes". `cloud-architect` esiste anche per dissuaderti da
  Kubernetes quando un target PaaS basta; installare questo plugin non ti impegna a un cluster.
- Non decide l'architettura applicativa — quello è `foundry-dev`.
- Non fissa gli SLO e non progetta gli allarmi. Lo fanno `sre-planner` e `observability-engineer`
  in `foundry-quality`.

## Agenti

| Agente | Che cosa fa | Modello | Effort | Isolamento |
|---|---|---|---|---|
| `pipeline-engineer` | Progetta, irrobustisce e velocizza le pipeline GitHub Actions: caching, grafo dei job, action fissate, OIDC al posto dei segreti di lunga durata. | `sonnet` | `medium` | `worktree` |
| `container-engineer` | Scrive e irrobustisce le immagini container: build multi-stage, dimensione e tempo di build, risultati dello scanner filtrati per ciò che è davvero raggiungibile. | `sonnet` | `medium` | `worktree` |
| `kubernetes-engineer` | Progettazione dei workload e strategia di rollout: dimensionamento di request e limit, diagnosi di OOMKill e throttling, probe che non causano tempeste di riavvii. | `opus` | `high` | `worktree` |
| `iac-engineer` | Terraform e OpenTofu su larga scala: confini dei moduli, stato remoto e locking, separazione degli ambienti senza copia-incolla, rilevamento della deriva, disciplina di revisione del plan. | `opus` | `high` | `worktree` |
| `cloud-architect` | Sceglie il target di deployment e i suoi confini fra AWS, Azure, GCP e PaaS (Vercel, Netlify, Fly.io, Render, Railway). | `opus` | `high` | — |
| `release-engineer` | Conduce i treni di rilascio: decisioni SemVer, changelog da conventional commit, tagging, promozione di un solo artefatto fra ambienti tramite digest, feature flag per disaccoppiare deploy e rilascio. | `sonnet` | `medium` | — |

## Skill

| Skill | Quando si attiva |
|---|---|
| `scaffold-pipeline` | Un repository ha bisogno di una pipeline GitHub Actions completa e irrobustita per il tipo di progetto rilevato — Node/Angular, Maven o Gradle, o un servizio containerizzato. |
| `containerise` | Un Dockerfile multi-stage irrobustito più un file compose per lo sviluppo locale, adattati allo stack rilevato nel repository. |
| `deploy-strategy` | Scegliere fra rolling update, blue-green e canary, dimensionarne i parametri sulle misure e scrivere la procedura di rollback come runbook. |
| `provision-environment` | Creare o estendere il codice Terraform/OpenTofu per un nuovo ambiente, con stato remoto e locking, gestione dei segreti e identità a privilegio minimo per CI e workload. |
| `release` | Condurre un rilascio dall'inizio alla fine — derivare la versione dall'intervallo di commit e da un diff delle API, generare il changelog, taggare, pubblicare e promuovere gli artefatti per digest, scrivere le note di rilascio. |

Tutte e cinque accettano `--dry-run`, `--plan-only` o un equivalente, così l'output generato si può
ispezionare prima che qualcosa venga scritto o promosso.

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `pipeline-engineer` | `requirement.v1` | `plan.v1` |
| `container-engineer` | `requirement.v1` | `review.v1` |
| `kubernetes-engineer` | `plan.v1` | `adr.v1` |
| `iac-engineer` | `plan.v1` | `risk.v1` |
| `cloud-architect` | `requirement.v1` | `adr.v1` |
| `release-engineer` | `plan.v1` | `handoff.v1` |

`deploy-strategy` scrive inoltre un runbook di rollback in `.foundry/runbooks/`, il che significa
che il prossimo incidente parte da una procedura e non dalla memoria.

## Interazione con gli hook di guardia

`foundry-core` protegge per impostazione predefinita `.github/workflows/**` e `**/*.lock`: una
scrittura lì innesca un'escalation `PreToolUse` che ti chiede conferma. È voluto: `scaffold-pipeline`
che cambia la tua CI dev'essere una decisione, non un effetto collaterale. Vedi
[Hook](/foundry/it/reference/hooks/) per modificare `protectedPaths`.

## Limiti

- Lo scaffolding delle pipeline è rivolto a **GitHub Actions**. Altri sistemi di CI non vengono
  generati.
- Il codice dell'infrastruttura è rivolto a Terraform e OpenTofu. CloudFormation, Pulumi e CDK no.
- Questi agenti scrivono configurazione; non detengono le tue credenziali cloud e non applicano
  nulla. `terraform apply`, `kubectl apply` e `docker push` restano da eseguire a te.
