---
title: Contratti
description: Gli undici schemi versionati che gli agenti si passano, come un errore di validazione raggiunge l'agente che lo ha causato, come si legge un errore con JSON pointer e perché una versione pubblicata non si modifica mai.
sidebar:
  order: 4
---

Quando un agente passa a un altro un paragrafo di prosa, chi riceve deve interpretarlo, e ogni
fraintendimento riemerge tre passi dopo come una risposta sbagliata detta con sicurezza. Quando gli
passa JSON che deve soddisfare uno schema, un fraintendimento è un errore di validazione nel momento
in cui accade, indirizzato all'agente che lo ha commesso.

È tutto l'argomento. Un contratto non è burocrazia: è la differenza fra un errore intercettato in un
secondo da un'espressione regolare e un errore intercettato in un'ora da una persona.

## Che cosa impone un contratto

Prendi `finding.v1`. Richiede `failureScenario`: "Concrete inputs/state leading to the wrong
outcome." Un agente che vuole segnalare un problema deve dichiarare come il problema si verifica
davvero.

```json
{
  "schema": "finding.v1",
  "producedBy": "appsec-reviewer",
  "id": "F-014",
  "severity": "high",
  "title": "No rate limit on the login endpoint",
  "summary": "POST /api/login accepts unlimited attempts per account and per source address.",
  "failureScenario": "An attacker sends 10k requests/min to /api/login with one username and a password list; no lockout, no delay, no CAPTCHA is triggered.",
  "standard": "OWASP ASVS V2.2.1",
  "confidence": "high"
}
```

Togli `failureScenario` e l'artefatto viene rifiutato. Un finding senza scenario è speculazione, e
lo schema lo rifiuta — senza nessuna persona nel ciclo, perché il rifiuto torna direttamente
all'agente che lo ha scritto.

Tutti e undici gli schemi richiedono `schema` e `producedBy`, e tutti impostano
`additionalProperties: false`. Un campo inatteso è un errore invece di essere ignorato in silenzio,
quindi un refuso nel nome di una proprietà viene intercettato invece che scartato.

## I dieci contratti

Vivono in `plugins/foundry-core/schemas/` come JSON Schema 2020-12, con nome
`<sostantivo>.v<major>.schema.json`.

| Contratto | Che cosa porta | Obbligatori oltre a `schema` e `producedBy` |
|---|---|---|
| `adr.v1` | Una decisione, i suoi driver, le opzioni soppesate e le conseguenze accettate | `number`, `title`, `status`, `date`, `context`, `options` (**almeno 2**), `decision` |
| `compliance-check.v1` | Un controllo valutato rispetto a un pacchetto di giurisdizione | `controlId`, `jurisdiction`, `instrument`, `requirement`, `status`, `rationale`, `assessedOn`, `disclaimer` |
| `estimate.v1` | Una stima a tre punti con le assunzioni esplicitate | `scope`, `items`, `assumptions` |
| `fact.v1` | Un fatto di progetto atomico e durevole, come artefatto del blackboard | `id` (`^fact-[0-9]{4,}$`), `type`, `scope`, `title` (≤80), `body` (≤900), `confidence`, `source`, `created` |
| `finding.v1` | Un difetto, una lacuna o un rischio trovato da un agente di audit, revisione o ricerca | `id`, `severity`, `title` (≤120), `summary` (≤600), `failureScenario`, `confidence` |
| `handoff.v1` | Ciò che un'ondata passa alla successiva | `wave`, `status`, `artifacts` (**almeno 1**), `summary` (≤1200 caratteri) |
| `plan.v1` | Un piano a ondate con gate espliciti, prodotto prima dell'implementazione | `goal`, `waves` |
| `requirement.v1` | Un requisito tracciabile con criteri di accettazione come comportamento verificabile | `id`, `kind`, `title`, `acceptanceCriteria`, `priority` |
| `review.v1` | L'esito di una revisione, con i finding ordinati per severità | `target`, `dimension`, `verdict`, `findings`, `summary` |
| `risk.v1` | Un rischio con esposizione quantificata e una mitigazione con un responsabile | `id`, `title`, `category`, `probability`, `impactEur`, `mitigation`, `owner`, `status` |
| `tracker-item.v1` | Un'unità di lavoro normalizzata da uno specifico issue tracker | `provider`, `sourceId`, `title` (≤200), `type`, `state`, `nativeState` |

Tre di questi codificano una regola più che una forma. `adr.v1` richiede almeno due opzioni, perché
un record di decisione con una sola opzione è una giustificazione scritta a posteriori.
`compliance-check.v1` richiede un `disclaimer`, perché un output di compliance che non dichiara di
non essere consulenza legale è una responsabilità. `tracker-item.v1` richiede `nativeState` accanto
a ogni `state` normalizzato, perché una normalizzazione che scarta in silenzio ciò che non è
riuscita a mappare è indistinguibile da una che ha mappato correttamente.

Ogni agente dichiara che cosa consuma e che cosa produce, alla lettera nel proprio corpo:

```markdown
## Input contract
`plan.v1` — the wave definitions and their gates

## Output contract
`finding.v1` — written to `.foundry/blackboard/audit/appsec-reviewer.json`
```

## Come un errore di validazione raggiunge l'agente

Quattro vie, tre delle quali automatiche.

**1. `blackboard_write` rifiuta prima di scrivere.** È la via normale. Lo strumento MCP valida
l'artefatto e, in caso di errore, non scrive nulla e restituisce:

```
Rejected: artifact does not satisfy finding.v1.
- #: missing required property "failureScenario"
- #/severity: must be one of ["critical","high","medium","low","info"]
Fix and call again.
```

L'agente ha gli errori nel proprio contesto e si corregge da solo.

**2. L'hook `validate-contract` intercetta le scritture dirette.** Se un agente usa Write o Edit su
un file `.json` sotto `.foundry/blackboard/`, l'hook `PostToolUse` lo valida e restituisce le
violazioni come contesto aggiuntivo:

```
Foundry: appsec-reviewer.json violates finding.v1. Fix it before continuing:
- #/evidence/0: missing required property "ref"
```

Questa via **non blocca**: quando il messaggio arriva il file è già stato scritto. Intercetta anche
i due casi che precedono la validazione — un file che non è JSON interpretabile e uno privo del
campo `schema` — e riporta l'elenco dei contratti disponibili quando l'id è sconosciuto.

**3. `foundry doctor` passa tutto in rassegna.** Ogni artefatto sotto `.foundry/blackboard/` viene
interpretato e validato; il controllo fallisce con il numero di violazioni per file. È quello che
intercetta gli artefatti scritti prima che uno schema venisse irrigidito.

**4. Su richiesta.** Da shell:

```bash
foundry validate finding.v1 .foundry/blackboard/audit/appsec-reviewer.json
```

```
INVALID against finding.v1:
  - #: missing required property "failureScenario"
```

Codice di uscita `1`. In sessione, lo strumento `contract_validate` fa lo stesso per un oggetto in
linea oppure per un percorso di file.

## Leggere un errore con JSON pointer

Ogni errore è `<puntatore>: <problema>`. Il puntatore parte da `#` per la radice del documento e
acquisisce un segmento per livello: `/<proprietà>` per una chiave di oggetto, `/<indice>` per una
posizione in un array.

| Errore | Dove guardare | Che cosa significa |
|---|---|---|
| `#: missing required property "failureScenario"` | Il livello superiore del documento | Un campo obbligatorio non è stato impostato |
| `#: unexpected property "notes"` | Il livello superiore | `additionalProperties: false` — il campo non è nello schema. Di solito un refuso, o un contenuto che va in `summary` |
| `#/severity: must be one of ["critical","high","medium","low","info"]` | Il campo `severity` | Un valore fuori dall'enum ammesso. Le maiuscole contano |
| `#/title: longer than 120 characters` | Il campo `title` | Violazione di `maxLength` |
| `#/options: needs at least 2 items` | L'array `options` | Violazione di `minItems` — per `adr.v1` è la regola delle due opzioni |
| `#/evidence/0: missing required property "ref"` | Il **primo** elemento di `evidence` | Gli indici degli array partono da zero |
| `#/evidence/2/kind: must be one of ["file","command","url","standard","measurement"]` | Il `kind` della terza evidenza | Gli oggetti annidati annidano il puntatore |
| `#/date: is not a valid date` | Il campo `date` | `format: date` vuole `YYYY-MM-DD` |
| `#/probability: above maximum 1` | Il campo `probability` | Un limite numerico |
| `#/schema: must equal "finding.v1"` | Il campo `schema` | L'artefatto dichiara un contratto diverso da quello contro cui viene verificato |

Il validatore copre il sottoinsieme di parole chiave usato dai dieci contratti: `const`, `enum`,
`type`, `required`, `properties`, `additionalProperties: false`,
`minLength`/`maxLength`/`pattern`/`format` (`date`, `date-time`, `uri`), `minimum`/`maximum`,
`minItems`/`maxItems`/`items` e `$ref` risolto per nome di file nella stessa directory di schemi.

Le parole chiave fuori da quel sottoinsieme — `oneOf`, `anyOf`, `allOf`, `if`/`then`,
`patternProperties`, `uniqueItems`, `dependentRequired` — vengono **ignorate, non rifiutate**. Uno
schema che le usa sembrerà validare qualsiasi cosa. Non scriverne uno: ogni schema Foundry è scritto
di proposito contro il sottoinsieme supportato.

Un'altra conseguenza del sottoinsieme: quando un controllo di `type` fallisce, la validazione di
quel sottoalbero si ferma. Passare una stringa dove è atteso un oggetto produce un errore, non
l'elenco di ogni campo mancante nella stringa.

## Una versione pubblicata non si modifica mai

`finding.v1` oggi significa esattamente ciò che significava il giorno in cui è stato pubblicato.
Rompere uno schema significa aggiungere `finding.v2` accanto, non cambiare `finding.v1`.

Il motivo è che i risultati di validazione sono già su disco e in git. Gli artefatti sotto
`.foundry/blackboard/` sono stati accettati contro una versione precisa; i corpi degli agenti
nominano una versione precisa come contratto di output; le esecuzioni vengono ripetute mesi dopo e
ci si aspetta lo stesso comportamento. Modifica `v1` e ognuno di quei riferimenti diventa
un'affermazione su un documento che non esiste più.

Le regole pratiche:

- **Additivo e non rompente** — una nuova proprietà facoltativa, un `maxLength` allargato, un nuovo
  valore di enum che non rifiuta nulla — può entrare in `v1`.
- **Tutto ciò che potrebbe invalidare un artefatto esistente** — un nuovo campo `required`, un enum
  ristretto, un `pattern` più stringente, una proprietà rimossa — è `v2`.
- La versione sta nel nome del file, quindi `v1` e `v2` convivono nella directory degli schemi e si
  risolvono entrambe.
- Migrare significa aggiornare il contratto di output dichiarato da ciascun agente a `v2`, in una
  modifica che puoi rivedere, lasciando validi contro `v1` gli artefatti vecchi.

`foundry-core` registra la famiglia che distribuisce in `plugin.json` come
`metadata.foundry.contracts: "v1"`, così un verticale può sapere quale generazione di contratti
fornisce il kernel installato.
