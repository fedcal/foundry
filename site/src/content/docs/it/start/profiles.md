---
title: Profili
description: Che cosa seleziona ciascuno dei cinque profili, che cosa cambia davvero su disco applicarne uno e come scriverne uno tuo.
sidebar:
  order: 3
---

Un profilo risponde a una sola domanda: per questo tipo di progetto, quali plugin, quali regole di
permesso e quale livello di enforcement? È un singolo file JSON, applicato con un comando.

```bash
foundry profile              # elenca
foundry profile oss-library  # applica
```

## I cinque profili

| Profilo | Plugin | Enforcement | Budget indice | Scelto perché |
|---|---|---|---|---|
| `angular-spring-enterprise` | core, dev, quality, ops, pmo, legal | `gate` | 4000 | Un prodotto enterprise full-stack porta con sé CI, migrazioni di database e configurazione di produzione che non devono cambiare in silenzio, più obblighi GDPR e di accessibilità che non sono facoltativi. |
| `oss-library` | core, oss, research, quality, dev | `gate` | 3000 | Una libreria pubblica vive di governance e documentazione. `LICENSE` e `NOTICE` sono protetti perché modificarli ha conseguenze legali per ogni utente a valle. |
| `pa-italia` | core, legal, dev, quality, pmo, oss, economics | `gate` | 5000 | Il software per la pubblica amministrazione italiana deve produrre una traccia auditabile. L'accessibilità è un obbligo di legge, non un obiettivo di qualità, e gli ADR sono evidenza per gli appalti. È il budget di indice più alto dei cinque, perché il contesto di compliance vale il costo. |
| `startup-mvp` | core, dev, economics, research | `warn` | 2500 | La velocità conta più della cerimonia, ma gli errori che la velocità non recupera — segreti esposti, storia distrutta — ti fermano comunque. |
| `full` | tutti e nove | `gate` | 6000 | Per esplorare Foundry. In un progetto reale un profilo più stretto mantiene basso il costo di routing. |

### Permessi impostati da ciascun profilo

| Profilo | Pre-approvati | Chiedono conferma | Negati |
|---|---|---|---|
| `angular-spring-enterprise` | `mvn`, `./mvnw`, `gradle`, `./gradlew`, `npm run`, `npx ng`, git in sola lettura, `Read`/`Glob`/`Grep` | `git push`, `docker push`, `kubectl apply`, `terraform apply` | lettura di `.env*`, `**/secrets/**`, `*.pem`, `*.p12` |
| `oss-library` | `npm run`, `npm test`, `npx`, `gh issue`, `gh pr`, git in sola lettura, `Read`/`Glob`/`Grep` | `npm publish`, `gh release`, `git push`, `git tag` | lettura di `.env*` |
| `pa-italia` | `Read`/`Glob`/`Grep`, git in sola lettura | `git push`, `gh release` | lettura di `.env*`, `**/dati-personali/**` |
| `startup-mvp` | `npm`, `npx`, tutto `git`, `Read`/`Glob`/`Grep`, `Write`, `Edit` — con `defaultMode: acceptEdits` | `git push` | lettura di `.env*` |
| `full` | solo `Read`/`Glob`/`Grep` | `git push` | lettura di `.env*` |

### Percorsi protetti aggiunti da ciascun profilo

I `protectedPaths` non negano una scrittura: la fanno risalire a te per conferma.

| Profilo | Protetti |
|---|---|
| `angular-spring-enterprise` | `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `**/src/main/resources/db/migration/**`, `**/application-prod.*` |
| `oss-library` | `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `LICENSE`, `NOTICE` |
| `pa-italia` | `.github/workflows/**`, `**/*.lock`, `**/accessibility-statement*`, `docs/adr/**` |
| `startup-mvp` | `.github/workflows/**`, `**/*.lock` |
| `full` | il default interno: `.github/workflows/**`, `**/*.lock`, `package-lock.json`, `db/migrations/**` |

:::note[Che cosa addolcisce davvero warn]
`warn` addolcisce le regole Bash da un diniego a una richiesta di conferma, e nient'altro. Con
`warn`, `startup-mvp` continua a negare in modo netto le scritture di segreti, continua a far
risalire i percorsi protetti, continua a verificare le dichiarazioni di completamento e continua a
imporre il context firewall dei subagenti — questi ultimi due sono governati da `verifyOnStop` e
`handoffSummaryTokenBudget`, non dal livello di enforcement. La matrice esatta è in
[Gate](/foundry/it/concepts/gates/).
:::

## Che cosa cambia davvero applicare un profilo

`foundry profile <id>` tocca esattamente due file.

**`.claude/settings.json`** — unito, mai sostituito:

- `extraKnownMarketplaces.foundry` viene impostato alla sorgente GitHub `fedcal/foundry`.
- `enabledPlugins` acquisisce `<plugin>@foundry` per ogni plugin del profilo, come unione insiemistica.
- `permissions.allow`, `.ask` e `.deny` acquisiscono le voci del profilo, come unioni insiemistiche.
- `permissions.defaultMode` viene sovrascritto se il profilo ne dichiara uno.

**`.foundry/config.json`** — riscritto come la configurazione effettiva corrente fusa con il
`foundryConfig` del profilo. Le chiavi che il profilo non nomina mantengono il valore attuale.

Poi stampa l'elenco dei plugin e ricorda di riavviare o di eseguire `/reload-plugins`.

### Che cosa non fa

- Non installa e non scarica plugin. Registra quali plugin vanno abilitati; il marketplace deve
  comunque essere raggiungibile.
- Non rimuove mai nulla. Permessi e plugin abilitati vengono uniti, quindi passare da `full` a
  `startup-mvp` lascia gli altri sei plugin abilitati. Per restringere, modifica
  `.claude/settings.json` a mano.
- `foundry profile <id>` applica `plugins`, `permissions` e `foundryConfig`, poi stampa `notes`,
  `recommendedMcpServers` e `jurisdictionPacks` perché tu vi dia seguito. Quei tre campi sono
  consigli, non automazione: nessun server MCP viene installato e nessun pack giurisdizionale viene
  abilitato al posto tuo.

## Scriverne uno tuo

I profili sono file sotto `profiles/` in un checkout del repository Foundry. `foundry profile`
risolve quella directory tre livelli sopra la CLI (`bin/../../../profiles`), quindi un profilo
personalizzato deve stare nello stesso checkout del plugin installato. Non esiste una directory di
profili a livello utente, né un modo per puntare il comando altrove.

Crea `profiles/data-platform.json`:

```json
{
  "id": "data-platform",
  "name": "Data platform",
  "description": "Batch and streaming pipelines: schema changes are the risk, not the UI.",
  "plugins": ["foundry-core", "foundry-dev", "foundry-quality", "foundry-ops"],
  "foundryConfig": {
    "enforcement": "gate",
    "indexTokenBudget": 3500,
    "protectedPaths": [
      ".github/workflows/**",
      "**/*.lock",
      "dbt/models/**/schema.yml",
      "airflow/dags/**"
    ]
  },
  "permissions": {
    "allow": ["Bash(dbt:*)", "Bash(python -m pytest:*)", "Read(**)", "Glob(**)", "Grep(**)"],
    "ask": ["Bash(dbt run:*)", "Bash(airflow dags trigger:*)", "Bash(git push:*)"],
    "deny": ["Read(./.env)", "Read(./.env.*)"],
    "defaultMode": "default"
  }
}
```

`id`, `description` e `plugins` sono i tre campi che la CLI richiede: `id` e `description` vengono
stampati da `foundry profile` senza argomenti, e su `plugins` il codice itera senza controlli,
quindi un profilo che lo omette solleva un'eccezione invece di fallire in modo pulito.
`foundryConfig` e `permissions` sono facoltativi.

Applica e verifica:

```bash
foundry profile data-platform
foundry doctor
```

Due regole da tenere presenti quando ne progetti uno. Metti un percorso in `protectedPaths` quando
una modifica sbagliata è costosa ma a volte corretta: il gate chiede, non rifiuta. Metti un comando
in `permissions.ask` quando l'azione è irreversibile fuori dal repository: pubblicare, taggare,
fare deploy, applicare infrastruttura.
