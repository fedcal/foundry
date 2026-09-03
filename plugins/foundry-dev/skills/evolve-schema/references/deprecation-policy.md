# Deprecation policy

A deprecation is a project with a start date, an end date, an owner and a measurable exit
condition. Anything less is a comment in a YAML file that will still be there in three years.

---

## The register: `docs/deprecations.md`

One table, reviewed monthly, single source of truth. Every deprecated element is a row.

```markdown
| Element | Kind | Replacement | Announced | Sunset | Consumer class | Usage (30d) | Owner | ADR |
|---|---|---|---|---|---|---|---|---|
| `GET /v1/orders?since=` | query param | `?cursor=` | 2026-03-01 | 2026-09-01 | internal + partner | 412 calls / 2 clients | orders-team | 0024 |
| `OrderPlaced.v1` | event type | `OrderPlaced.v2` | 2026-05-14 | 2027-05-14 | public | 0 calls / 0 consumers | sales-team | 0031 |
| `customerRef` | response field | `customerId` | 2026-06-01 | 2026-09-01 | internal | 3 clients | orders-team | 0027 |
```

A row with an empty `Usage` column has not been measured, which means the sunset date is fiction.
A row with an empty `Owner` gets one assigned in the monthly review or the deprecation is
cancelled — an unowned deprecation never completes.

---

## Notice periods

Minimum from announcement to removal. These are floors, not targets.

| Consumer class | Minimum notice | Reason |
|---|---|---|
| Internal, same team | 30 days | You control both sides and can coordinate |
| Internal, other teams | 90 days | Fits inside a quarter's planning cycle |
| Named partners under contract | 180 days, or whatever the contract says if longer | Read the contract; some specify 12 months and a written notice procedure |
| Public / anonymous | 12 months | You cannot contact them and cannot know when they read the changelog |
| Anything a regulator depends on | Ask `foundry-legal` before setting a date | |

Additional constraints:

- **At most two majors in parallel.** Announcing v3 starts v1's removal clock on the same day.
- **No sunset during a freeze window** — the consumer's peak season, not yours. For retail that
  usually means nothing is removed between mid-November and mid-January.
- **Extending a sunset date is allowed once**, publicly, with a reason. A second extension means
  the deprecation was never viable; cancel it and write an ADR explaining why the old element is
  now permanent.

---

## Announcement

The same message goes to four places on the announcement day. Missing one is how a consumer is
surprised six months later.

1. **The contract.** `deprecated: true`, plus a description that names the replacement and the
   exact removal date:
   ```yaml
   deprecated: true
   description: |
     Deprecated 2026-03-01, removed on 2026-09-01. Use `cursor` instead; see
     contracts/CHANGELOG.md#2026-03-01 for the migration. Offset paging drifts on a collection
     that changes under the reader.
   ```
2. **The wire.** A `Sunset` header (**RFC 8594**) carrying the removal date as an HTTP-date, plus
   a `Link` with `rel="deprecation"` (and `rel="successor-version"` where one exists, RFC 8288),
   plus the IETF HTTPAPI deprecation header field — that field has been standardised; take its
   current RFC number from the specification rather than writing one from memory.
   ```
   Sunset: Wed, 01 Sep 2026 00:00:00 GMT
   Link: <https://api.acme.com/docs/deprecations#since-param>; rel="deprecation"; type="text/html"
   ```
3. **`contracts/CHANGELOG.md`**, written by a human, with the migration steps a consumer must
   perform — not a diff.
4. **The consumers themselves**, by name, using the usage measurement below. A changelog entry is
   not a notification.

---

## Measuring usage, per consumer

Aggregate percentages hide the only fact that matters: *who* is still calling.

```bash
# HTTP: deprecated endpoint/param usage by client, last 30 days
# (adapt to your log store; the shape is what matters)
grep -h "GET /v1/orders" access.log \
  | grep -- "since=" \
  | awk '{print $NF}' \
  | sort | uniq -c | sort -rn
```

Emit a dedicated metric instead of relying on log grep where you can:

```
api_deprecated_usage_total{element="orders.since_param", client_id="...", version="v1"}
```

For events, "usage" is consumer-group subscription, not message volume:

```bash
kafka-consumer-groups.sh --bootstrap-server "$BROKER" --list \
  | while read g; do
      kafka-consumer-groups.sh --bootstrap-server "$BROKER" --describe --group "$g" \
        | grep -q 'sales\.orders\.v1' && echo "still consuming v1: $g"
    done
```

A consumer group with a committed offset on the old topic is a live dependency even if it has
processed nothing this month.

---

## Brownouts

Announced, time-boxed failures of the deprecated element before its removal. They convert a
future incident into a scheduled test, and they are the only reliable way to find consumers who
never read the changelog.

| Point in the notice period | Duration | Behaviour |
|---|---|---|
| 50% elapsed | 1 hour | Deprecated element returns `410 Gone` with a problem document naming the replacement |
| 75% elapsed | 4 hours | Same |
| 90% elapsed | 24 hours | Same |
| Sunset date | permanent | `410 Gone`, kept for at least 90 days before becoming `404` |

Rules:

- Announce each brownout at least 14 days ahead, in the same four places as the original notice.
- Never brownout during the consumer's peak window.
- The problem document must be actionable:
  ```json
  {
    "type": "https://api.acme.com/problems/deprecated-removed",
    "title": "This parameter was removed",
    "status": 410,
    "detail": "The `since` parameter was removed on 2026-09-01. Use `cursor`.",
    "instance": "/problems/01HZ8Q4P0R"
  }
  ```
- **A brownout that generates complaints has succeeded.** The correct response is to contact the
  callers you just identified, not to cancel the next brownout. Cancelling turns the sunset date
  into an unannounced outage instead.
- Skip brownouts only when usage has been measured at exactly zero for the whole notice period,
  and say so in the register.

---

## Removal condition

Remove only when **both** hold:

1. The notice period has fully elapsed, and every scheduled brownout ran.
2. Either usage is zero for 30 consecutive days, **or** every remaining named consumer has
   explicitly signed off with a date recorded in the register.

Silence is not sign-off. An unreachable consumer is not a consumer who has agreed.

If the condition is not met at the sunset date, you have exactly two honest options: extend once
with a public reason, or remove and accept the breakage as a decision — recorded in an ADR, with
the affected consumers named. Quietly slipping the date without announcing it teaches everyone
that your deprecations are not real, and the next one will be ignored too.

---

## After removal

- Keep returning `410 Gone` with the pointer to the replacement for at least 90 days. `404` tells
  a caller they have a bug in their URL; `410` tells them the truth.
- Move the register row to a `## Removed` section with the actual removal date. Do not delete it —
  the next person to ask "what happened to `since`?" needs an answer.
- Delete the implementation, the flag, the dual write and the tests in one change. Leftover
  scaffolding is how a removed feature comes back.
- Close the loop in the ADR: append the actual removal date to the ADR that announced it. The ADR
  body is otherwise immutable, so this line goes in `docs/adr/README.md` next to the entry.
