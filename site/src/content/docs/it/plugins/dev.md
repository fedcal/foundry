---
title: foundry-dev
description: Architettura, modellazione del dominio, protocolli, dati, sicurezza, identità, UX e accessibilità, Angular e Spring Boot.
sidebar:
  order: 3
---

`foundry-dev` è la verticale più ampia: diciannove agenti e diciassette skill che coprono le decisioni
costose da revocare e il lavoro di implementazione che ne consegue. È opinionata sullo stack in due
punti — Angular sul frontend, Spring Boot 3 e PostgreSQL sul backend — e neutrale altrove.

## Installazione

```bash
/plugin install foundry-dev@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Stai prendendo decisioni architetturali con cui dovrai convivere: confini, modelli di coerenza,
  topologia, build o acquisto.
- Stai scrivendo codice Angular o Spring Boot e vuoi che vengano rispettate le convenzioni già
  presenti nella codebase, non uno scaffold generico.
- Ti serve un threat model, una revisione di sicurezza applicativa, un audit di accessibilità o un
  contratto API progettato prima dell'implementazione.

## Quando non usarlo

- Non esegue la CI e non fa deploy — quello è `foundry-ops`.
- Non possiede la strategia di test, i budget di performance in CI o gli SLO — quello è
  `foundry-quality`.
- `accessibility-engineer` corregge l'accessibilità sul piano tecnico; il lato *legale* di una
  dichiarazione di conformità sta in `foundry-legal`.
- Gli agenti Angular e Spring rilevano prima le convenzioni reali del progetto. Su una codebase che
  non usa né l'uno né l'altro gran parte di quel valore svanisce; gli agenti di architettura,
  sicurezza e dati restano applicabili.

## Agenti

| Agente | Che cosa fa | Modello | Effort |
|---|---|---|---|
| `solution-architect` | Decisioni costose da revocare: confini fra componenti, modelli di coerenza e di stato, topologia di runtime e deployment, build o acquisto, selezione tecnologica. | `opus` | `high` |
| `domain-modeler` | Trasforma un dominio confuso in bounded context nominati, una context map con pattern di relazione espliciti, aggregati con invarianti dichiarate e un linguaggio ubiquo. | `opus` | `high` |
| `integration-architect` | Due sistemi che scambiano dati attraverso un confine di processo, squadra o fornitore: sincrono o asincrono, semantica di consegna, idempotenza, outbox transazionale, saga e compensazione, anti-corruption layer. | `opus` | `high` |
| `protocol-engineer` | Scelta e uso corretto di un protocollo di trasporto — HTTP/1.1, HTTP/2, HTTP/3, maturità REST, gRPC, GraphQL, WebSocket, SSE, AMQP, Kafka, MQTT, CoAP. | `sonnet` | `medium` |
| `database-architect` | Progettazione di schema orientata a PostgreSQL: normalizzazione e denormalizzazione deliberata, strategia di chiave primaria, progettazione degli indici verificata con `EXPLAIN`. | `opus` | `high` |
| `persistence-engineer` | Correttezza e prestazioni JPA/Hibernate: strategie di fetch, rilevamento N+1, entity graph, proiezioni, locking ottimistico, batching JDBC. | `sonnet` | `medium` |
| `migration-engineer` | Cambiare lo schema del database senza downtime: expand/migrate/contract, convenzioni Flyway o Liquibase, backfill a lotti, evitare i lock su PostgreSQL. | `sonnet` | `medium` |
| `spring-engineer` | Codice applicativo Spring Boot 3: struttura dei package, dependency injection, binding della configurazione, confini transazionali, Bean Validation, errori RFC 9457, Testcontainers. | `sonnet` | `medium` |
| `python-engineer` | Codice generico di applicazione e libreria Python: type hint e tipizzazione statica, packaging e gestione delle dipendenze, async/await e concorrenza strutturata, architettura della gestione degli errori, progettazione di test pytest. | `sonnet` | `medium` |
| `fastapi-engineer` | Codice di servizio FastAPI: dependency injection, schema Pydantic v2, sessioni async SQLAlchemy 2.0, migrazioni Alembic, wiring OAuth2/JWT, gestori di eccezioni, generazione OpenAPI, test pytest/httpx. | `sonnet` | `medium` |
| `angular-engineer` | Angular moderno: componenti standalone, signal, control flow integrato, deferrable view, form reattivi tipizzati, routing lazy, SSR. | `sonnet` | `medium` |
| `frontend-performance-engineer` | Core Web Vitals (LCP, INP, CLS) con obiettivi numerici, budget di bundle in `angular.json`, strategia di immagini e font, costo dell'hydration. | `sonnet` | `medium` |
| `ux-architect` | Interazione, non decorazione: flussi di attività, architettura dell'informazione, carico cognitivo, prevenzione e recupero dagli errori, progettazione dei form, stati vuoti/di caricamento/di errore, microcopy. | `opus` | `high` |
| `accessibility-engineer` | Verifica e corregge rispetto a WCAG 2.2 livello AA, ai pattern ARIA Authoring Practices e a EN 301 549: operabilità da tastiera, gestione del focus nei cambi di rotta SPA. | `sonnet` | `medium` |
| `security-architect` | Costruisce il threat model scomponendo il sistema in flussi di dati, applicando STRIDE per confine di fiducia e ordinando le minacce per sfruttabilità rispetto all'impatto. | `opus` | `high` |
| `appsec-reviewer` | Revisione avversariale di sicurezza applicativa rispetto a OWASP ASVS 5.0 e OWASP Top 10 — injection, controllo di accesso rotto inclusi IDOR e mass assignment, SSRF, deserializzazione non sicura. | `opus` | `high` |
| `identity-engineer` | Autenticazione e autorizzazione: scelta del flusso OAuth 2.1 / OIDC per tipo di client, PKCE, durata e rotazione dei token, rilevamento del riuso del refresh token, session fixation. | `opus` | `high` |
| `supply-chain-guardian` | Generazione e verifica di SBOM (CycloneDX/SPDX), triage delle vulnerabilità distinguendo il raggiungibile dal non raggiungibile, pinning e integrità dei lockfile. | `sonnet` | `medium` |
| `service-versioning-engineer` | Compatibilità attraverso i confini di servizio: SemVer per i servizi rispetto alle API, versioning su URI, media type o header, contract testing guidato dal consumatore, finestre di deprecazione. | `opus` | `high` |

## Skill

| Skill | Quando si attiva |
|---|---|
| `write-adr` | Una decisione è costosa da revocare e serve un `adr.v1` validato più il file `docs/adr/NNNN-slug.md` generato. |
| `design-api-contract` | Progettazione contract-first di un'API HTTP (OpenAPI 3.1) o di un'API a eventi (AsyncAPI 3), con modello di errore problem-details RFC 9457. |
| `evolve-schema` | Uno schema di API o di eventi deve cambiare senza rompere i consumatori — classificare il cambiamento, eseguire una migrazione expand-contract. |
| `api-deprecation` | Un ciclo completo di deprecazione: marcare, annunciare, misurare l'uso, dismettere, rimuovere, con gli header `Deprecation` (RFC 9745) e `Sunset` (RFC 8594). |
| `decompose-service` | Decidere se estrarre un servizio da un monolite, usando accoppiamento e coesione misurati anziché intuizione. |
| `spring-endpoint` | Aggiungere o modificare un endpoint HTTP Spring Boot end-to-end, seguendo le convenzioni già presenti nella codebase. |
| `angular-component` | Creare o rifattorizzare un componente Angular conforme alle convenzioni reali del progetto, rilevate e non presunte. |
| `python-service` | Creare o revisionare un servizio Python/FastAPI end-to-end: layout del progetto e packaging, validazione delle impostazioni all'avvio, wiring di SQLAlchemy async con baseline Alembic, una rotta vertical-slice funzionante, test harness, endpoint di liveness e readiness, Dockerfile. |
| `design-tokens` | Stabilire o rifattorizzare un sistema di token a tre livelli con temi, dark mode e validazione del contrasto di ogni coppia semantica. |
| `ux-review` | Una revisione di usabilità euristica e basata su compiti di un flusso, con severità legate all'impatto sull'utente. |
| `audit-accessibility` | Un audit WCAG 2.2 livello AA ripetibile di una pagina, rotta o componente — prima il passaggio automatico con `axe`, poi i controlli manuali che l'automazione non può fare. |
| `threat-model` | Una sessione di threat modelling su una codebase reale: punti di ingresso enumerati dal sorgente, STRIDE per confine di fiducia. |
| `security-review` | Un passaggio avversariale su un diff, un modulo o un intero servizio, mappato su OWASP ASVS 5.0 e CWE. |
| `harden-headers` | Impostare header di sicurezza HTTP e flag dei cookie: CSP senza `unsafe-inline` incluso il percorso di migrazione a nonce o hash, HSTS, COOP/COEP/CORP, Referrer-Policy. |
| `secret-hygiene` | Rilevare, ruotare e rimuovere segreti trapelati nel working tree e in tutta la storia git, nell'ordine di rotazione corretto. |
| `optimise-query` | Una query o un endpoint ORM lento: riprodurre, misurare con `EXPLAIN (ANALYZE, BUFFERS)`, una ipotesi e un cambiamento alla volta. |
| `write-migration` | Una migrazione revisionata e sicura da eseguire su un database PostgreSQL vivo, con fasi expand/migrate/contract ed evitando i lock. |

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `solution-architect` | `requirement.v1` | `adr.v1` |
| `domain-modeler` | `requirement.v1` (accettati grezzi e incompleti) | `requirement.v1` — ciascuno tracciato a un comando, una policy o un'invariante trovata nel dominio |
| `integration-architect` | `requirement.v1` | `adr.v1` |
| `protocol-engineer` | `requirement.v1` | `adr.v1`, più `finding.v1` per gli usi scorretti individuati |
| `database-architect` | `requirement.v1` | `adr.v1` |
| `persistence-engineer` | `finding.v1[]` con un `failureScenario`, oppure `plan.v1` | `review.v1`, `dimension: persistence`, con `metrics` che porta i numeri prima/dopo |
| `migration-engineer` | `adr.v1` | `plan.v1` |
| `spring-engineer` | `plan.v1` | `review.v1` |
| `angular-engineer` | `requirement.v1` e `plan.v1` | `handoff.v1` |
| `frontend-performance-engineer` | `requirement.v1` | `finding.v1` |
| `ux-architect` | `requirement.v1` | `review.v1` |
| `accessibility-engineer` | `requirement.v1` | `finding.v1` |
| `security-architect` | `plan.v1` | `risk.v1` |
| `appsec-reviewer` | una richiesta di revisione delimitata | `review.v1` con un array di `finding.v1` in `findings` |
| `identity-engineer` | una richiesta delimitata di progettazione o revisione | `adr.v1` in modalità progettazione, un ADR per decisione |
| `supply-chain-guardian` | una richiesta di scansione delimitata | `review.v1`, `dimension: supply-chain`, con voci `finding.v1` |
| `service-versioning-engineer` | `adr.v1` | `adr.v1` e `review.v1` |

## Che cos'altro contiene

`references/stack-versions.json` è un **risolutore**, non un elenco di versioni. Non contiene
deliberatamente alcun numero di versione: dice a un agente come leggere dai file su disco le
versioni che il progetto usa davvero, e quale endpoint upstream interrogare per sapere "che cosa è
attuale oggi". Il campo `verifiedOn` è `null` in questo repository, il che obbliga un agente a
trattare ogni affermazione su una "release corrente" come ignota e a risolverla in diretta prima di
asserirla.

La ragione è scritta nel file: un asset di marketplace sopravvive alla release contro cui è stato
scritto, e un numero di versione fissato e ormai vecchio è peggio di nessun numero perché è
sbagliato con sicurezza.

## Limiti

- `database-architect`, `migration-engineer` e `optimise-query` presuppongono PostgreSQL. Il
  ragionamento generale è trasferibile; il comportamento specifico dei lock, l'output di `EXPLAIN`
  e il DDL no.
- `audit-accessibility` esegue prima un passaggio automatico, e l'automazione dimostrabilmente non
  può decidere la maggior parte dei criteri WCAG. La copertura reale sta nella checklist manuale,
  che richiede una persona o una sessione di browser.
- `supply-chain-guardian` dipende dalla presenza nell'ambiente di un generatore di SBOM e di una
  fonte di vulnerabilità. Ne dichiara l'assenza invece di tirare a indovinare.
