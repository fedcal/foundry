# Compatibility matrix

Look up the change you want to make. `SAFE` means it can ship in the current major version;
`BREAK` means it needs expand-contract or a new major.

Read `SKILL.md` Step 1 first — "backward" and "forward" are directional and the whole table is
meaningless if you have them the wrong way round.

---

## 1. HTTP JSON payloads (OpenAPI 3.1 / JSON Schema 2020-12)

### Response bodies (server → consumer)

| Change | Verdict | Notes |
|---|---|---|
| Add an optional field | SAFE* | *Only if consumers are contractually tolerant readers. A consumer generated with strict/closed deserialisation will throw. State the obligation in the contract. |
| Add a required field | SAFE* | Same caveat. "Required" in a response only constrains the server. |
| Remove a field | BREAK | Even if you believe nobody reads it. Measure per consumer first. |
| Rename a field | BREAK | Add + migrate + deprecate + remove. There is no rename. |
| Make an optional field required | SAFE | Strengthens what the server promises. |
| Make a required field optional | BREAK | Consumers assume presence and will `NullPointerException` in production, not in your tests. |
| Widen a type (`integer` → `number`, add `"null"` to the type array) | BREAK | Consumer deserialisers are typed. |
| Narrow a type (`number` → `integer`) | BREAK | Some existing values may not fit the narrowed type — and old consumers already accept the wide one. |
| Add a member to an enum | BREAK unless pre-declared | Only safe if the contract already documents "clients MUST tolerate unknown members". Declare that on day one or you can never extend an enum. |
| Remove a member from an enum | SAFE for consumers, but check: any consumer with an exhaustive `switch` on the old set still compiles and now has dead code. Harmless. |
| Relax a constraint (`maxLength` up, `minimum` down) | BREAK for strict validators | Consumers that validate responses will start rejecting valid data... eventually, when a long value appears. |
| Tighten a constraint | SAFE | You are promising less variety. |
| Change `format` (`date` → `date-time`) | BREAK | It is a type change wearing a string. |
| Reorder fields / change whitespace | SAFE | Unless a consumer hashes the raw body — which some signature schemes do. Check before assuming. |
| Change the meaning of an existing field | BREAK, and undetectable | No tool catches this. Add a new field instead. |
| Add a new endpoint | SAFE | |
| Add a new optional query parameter | SAFE | |
| Add a new response status code | BREAK-ish | Old clients have no branch for it. Safe only for codes in a class they already handle generically. |

### Request bodies (consumer → server)

| Change | Verdict | Notes |
|---|---|---|
| Add an optional field | SAFE | |
| Add a required field | BREAK | Old clients do not send it. Add optional + default, tighten in the next major. |
| Remove a field | SAFE if ignored | Old clients keep sending it; the server must ignore it silently, not 400. Do not use `additionalProperties: false` and then remove a field in the same change. |
| Make an optional field required | BREAK | |
| Make a required field optional | SAFE | |
| Add an enum member | SAFE | Server accepts more than before. |
| Remove an enum member | BREAK | Old clients still send it. |
| Relax a constraint | SAFE | |
| Tighten a constraint (`maxLength` down, new `pattern`) | BREAK | Requests that were valid yesterday get 422 today. |
| Add `additionalProperties: false` to an existing schema | BREAK | Clients commonly send extra fields; this turns tolerance into rejection. |

**Rule of thumb:** requests get stricter over time only across a major boundary; responses get
richer over time within a major.

---

## 2. Protocol Buffers

Wire compatibility is by **field number**, not name, which makes protobuf forgiving about names
and unforgiving about numbers.

| Change | Verdict | Notes |
|---|---|---|
| Add a new field with a new number | SAFE | Unknown fields are preserved by conformant implementations. |
| Delete a field | SAFE **only with `reserved`** | `reserved 7; reserved "customer_ref";` — otherwise a future author reuses 7 and old data deserialises into the wrong field, silently. |
| Reuse a deleted field number | BREAK, catastrophically | The classic protobuf data-corruption bug. This is what `reserved` exists to prevent. |
| Rename a field, same number | SAFE on the wire | BREAK for JSON mapping and for generated code — treat as breaking for consumers. |
| `int32` ↔ `int64` ↔ `uint32` ↔ `uint64` ↔ `bool` | SAFE on the wire (all varint) | But values outside the narrower range truncate. Widening is fine; narrowing loses data. |
| `sint32`/`sint64` ↔ `int32`/`int64` | BREAK | Different varint encoding (zig-zag). |
| `string` ↔ `bytes` | SAFE if the bytes are valid UTF-8 | Otherwise the string parse fails. |
| `fixed32` ↔ `sfixed32`, `fixed64` ↔ `sfixed64` | SAFE | Same wire size. |
| singular → `repeated` (same type) | SAFE-ish | Old readers of a repeated field see the last value; new readers of a singular field see a one-element list. Verify against your language's runtime before relying on it. |
| Change a field's `oneof` membership | BREAK | Moving a field into or out of a `oneof` changes semantics. |
| Add a value to an `enum` | SAFE if consumers handle unknown | Always define `X_UNSPECIFIED = 0` as the first member so the default is explicit. Closed enums in proto2 reject unknown values — check your syntax level. |
| Change a package or message name | BREAK for gRPC routing | The full method name is on the wire. |

Gate it: `buf breaking --against '.git#branch=main'` in CI, as a required check.

---

## 3. Avro

Avro resolves schemas by **name**, with **default values** doing the compatibility work.

| Change | Backward (new reader, old data) | Forward (old reader, new data) |
|---|---|---|
| Add a field **with** a default | SAFE | SAFE |
| Add a field **without** a default | BREAK | SAFE |
| Remove a field **that had** a default | SAFE | SAFE |
| Remove a field **without** a default | SAFE | BREAK |
| Rename a field | SAFE only with an `aliases` entry on the new name | Aliases are read-side; the old reader has no alias for the new name ⇒ BREAK |
| Change a field's type | BREAK unless the pair is a permitted promotion (`int`→`long`→`float`→`double`, `string`↔`bytes`) | Promotions are one-directional |
| Add a member to a union | SAFE for the reader that has it | BREAK for readers that do not |
| Change a default value | SAFE for the wire, but changes the meaning of historical absent values — treat as a semantic change |
| Reorder fields | SAFE | Resolution is by name |

**Registry compatibility mode.** Set it per subject and mean it:

| Mode | Use for |
|---|---|
| `BACKWARD` | short-retention topics, consumers upgrade first (the common default) |
| `FORWARD` | producers upgrade first, consumers lag (rare, but real for third-party consumers) |
| `FULL` | either order; the safe choice for shared topics |
| `*_TRANSITIVE` | **any topic that can be replayed from the beginning.** Non-transitive modes only compare against the latest version, so a chain of individually-compatible changes can end up incompatible with version 1 — which is exactly what a replaying consumer reads. |
| `NONE` | never, on a published subject |

---

## 4. JSON Schema for events

Events on a log are harder than HTTP responses because the reader cannot ask the writer to
resend, and replay means old versions come back.

- Version in the **message type**, not only in the schema file:
  `com.acme.sales.order.placed.v1`. Consumers switch on it.
- A breaking event change is a **new type**, published to the same channel alongside the old one
  during the migration, or to a new channel. Publishing both to the same channel keeps ordering
  per key intact, which is usually what you want.
- Producers dual-publish v1 and v2 for the whole deprecation window. Consumers subscribe to the
  version they understand.
- Never mutate the schema of an already-published version. Registries with `NONE` compatibility
  will let you. Do not.

---

## 5. Event-sourced stores: upcasting

An event store has infinite retention by definition, so deletion is not available and every
version ever written must remain readable forever.

- Keep the serialised form immutable. Never rewrite history in place; a "migration" that rewrites
  stored events destroys the audit property that justified event sourcing in the first place.
- Read-side **upcasters** transform old versions to the current one at load time, chained
  `v1 → v2 → v3`. Each upcaster is a pure function with its own unit test and a golden fixture of
  a real v1 payload checked into `contracts/fixtures/events/`.
- Store `eventType` and `schemaVersion` on every record so the upcaster chain is selectable
  without sniffing the payload.
- Upcasters accumulate. Budget for them: a chain longer than ~3 hops for a hot event type is a
  signal to snapshot and, if truly necessary, to write a new stream with an explicit,
  audited one-time transformation — a decision that deserves its own ADR.
- Adding a field with no historical value: the upcaster must supply a default that is
  *semantically correct for the past*, not merely type-correct. `discountApplied: false` is a
  claim about history; make sure it is true.

---

## 6. What no tool will catch

Automated checkers compare structure. These pass every check and break production:

1. **Semantic change under a stable shape.** A field's meaning, unit, timezone, or rounding
   changes. Fix: never; add a new field with a new name.
2. **Unit changes.** `amount` in cents becoming `amount` in euros. Include the unit in the name
   (`amountMinorUnits`) so this is impossible to do silently.
3. **Nullability convention drift.** A field that used to be omitted now appears as `null`, or
   vice versa. Consumers distinguish these more often than you expect.
4. **Identifier format change.** `ord_123` becoming a UUID. Structurally still a string; every
   consumer regex breaks.
5. **Ordering or cardinality assumptions.** A list that was always sorted, or always had exactly
   one element, now does not.
6. **Timing change.** The event now fires before the state is queryable through the API, so
   consumers that call back get a 404 they never saw before. Nothing in the schema changed at all.

For each of these the mitigation is the same: it is a **new field or a new event type**, plus a
deprecation timeline for the old one.
