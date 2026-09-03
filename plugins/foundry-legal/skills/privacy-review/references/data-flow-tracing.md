# Data flow tracing

> **Automated technical assessment. Not legal advice.**

How to find personal data in a codebase without trusting the data model.

## Why not start from the schema

The schema shows what someone chose to model. It does not show the free-text column where users write
their diagnosis, the analytics payload assembled inline, the error report carrying the request body,
or the prompt sent to a model provider. Start at the boundary and work inwards; use the schema to
check you found everything, not to define the search.

## Entry point taxonomy

| Class | Where to look | What is usually missed |
|---|---|---|
| HTTP request bodies | route/controller definitions, the DTO or validation schema | fields accepted but not validated, and `additionalProperties` passthrough |
| Query and path parameters | route patterns | identifiers in URLs, which land in access logs and referrer headers |
| Headers and cookies | middleware | device identifiers, session tokens, `X-Forwarded-For` |
| Forms and client state | form components | hidden fields, autofilled fields, drafts saved to local storage |
| File uploads | upload handlers | EXIF GPS, faces in images, personal data inside documents and spreadsheets |
| Third-party callbacks | webhook handlers, OAuth callbacks | the whole payload persisted "for debugging" |
| Free text | notes, bios, tickets, messages, prompts | special-category data users volunteer |
| Telemetry | `track(`, `capture(`, `logEvent(`, `identify(` | user traits attached to every event |
| Error reporting | Sentry/Bugsnag/Rollbar init | default `sendDefaultPii`, request bodies, breadcrumbs |
| Session replay | replay SDK config | keystrokes and screen content, masked only if configured |
| Derived data | scoring, segmentation, embeddings, recommendation features | inferred attributes that are personal data and sometimes special category |
| Batch import | CSV ingestion, CRM sync, enrichment vendors | enrichment appends data the user never gave you |

## Search patterns

Grep is for locating candidates. Evidence is the code you then read.

### Field names that indicate personal data

```
email|e_mail|mail_address|phone|mobile|msisdn|tel
first_?name|last_?name|full_?name|surname|given_?name
address|street|postcode|post_?code|zip|city
dob|date_?of_?birth|birth_?date|age
ssn|nino|codice_?fiscale|tax_?id|passport|id_?card|national_?id
ip_?address|device_?id|advertising_?id|idfa|gaid|fingerprint
lat|lng|latitude|longitude|geo|coords|location
iban|card_?number|pan|cvv|account_?number
health|diagnos|medic|prescription|allerg|symptom
religio|ethnic|union|political|orientation|disabilit
```

### Whole-object logging

```
log\.(info|debug|warn|error)\([^)]*\b(user|req|request|body|payload|customer|profile|ctx)\b
console\.(log|error|debug)\(
print\(.*\b(user|request|payload)\b
System\.out\.print|printStackTrace
logger\.\w+\(.*\{.*\}\)
```

### Telemetry and third-party sinks

```
analytics\.|mixpanel|amplitude|segment|posthog|gtag|dataLayer|fbq|_paq
Sentry\.|bugsnag|rollbar|datadog|newrelic|opentelemetry
sendDefaultPii|beforeSend|maskAllInputs|blockClass
openai|anthropic|bedrock|vertex|generativelanguage|mistral|cohere
```

### Deletion and retention mechanisms

```
deleted_?at|is_?deleted|soft_?delete|archived_?at
TTL|expire|expiry|lifecycle|retention|purge|prune|cleanup|reap
ON DELETE (CASCADE|SET NULL|RESTRICT)
@cron|schedule\(|CronJob|celery.*beat|sidekiq.*cron
```

### Consent

```
consent|cookie_?consent|cmp|gdpr|optin|opt_?in|opt_?out|preferences
GlobalPrivacyControl|Sec-GPC|doNotTrack|navigator\.globalPrivacyControl
```

### Rights endpoints

```
(export|download)_?(user|my|personal)_?data|dsar|sar|subject_?request
delete_?account|close_?account|erase|right_?to_?be_?forgotten|rtbf
```

## Per-ecosystem notes

| Ecosystem | Where the data model really lives | Trap |
|---|---|---|
| Node/TypeScript | Prisma schema, TypeORM entities, Drizzle schema, Zod validators | `z.object().passthrough()` and `any` typed payloads |
| Python | SQLAlchemy models, Django models, Pydantic schemas | `**kwargs` propagation, `model_dump()` into logs |
| Java/Kotlin | JPA entities, records, Bean Validation | `toString()` on an entity, logged by default in many frameworks |
| Go | structs with db tags | `%+v` formatting in logs, which prints every field |
| Ruby | ActiveRecord models, strong parameters | `inspect` in logs, `permit!` |
| .NET | EF Core entities, DTOs | default `ILogger` structured logging of whole objects |

## Building the flow map

For each entry point, follow the value to rest. Record the chain, not just the endpoints:

```
POST /api/support/ticket  →  body.description (free text, may contain health data)
  → TicketService.create()          src/support/service.ts:88
  → tickets.description (Postgres)  prisma/schema.prisma:210     retention: none configured
  → OpenSearch index "tickets"      infra/search.tf:33           retention: none configured
  → analytics.track('ticket_created', { description })  src/support/service.ts:96   ← over-collection
  → Sentry breadcrumb on error      default config, not scrubbed                    ← leakage
  → LLM summarisation call          src/support/ai.ts:24         provider retention: unverified
```

Three properties make a flow map useful:

1. **Every hop has a file:line.** Without it the map cannot be re-verified next quarter.
2. **Every terminus is a row in the store inventory.** If a terminus is not in the inventory, the
   inventory is wrong.
3. **Arrows that surprised you are marked.** The surprising hops are where the findings are.

## Cross-checking

When the map is drawn, run three reverse checks:

- **Schema → map.** Every personal-data column in the schema appears as a terminus. Any that does not
  means an entry point was missed.
- **Vendor → map.** Every third-party endpoint in configuration appears as a terminus. Any that does
  not means an undocumented flow.
- **Erasure → map.** Walk the delete handler and mark each terminus it reaches. The unmarked termini
  are the erasure gap, and that list is the single most useful artefact this skill produces.
