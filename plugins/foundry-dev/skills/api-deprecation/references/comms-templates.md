# Communication templates

English only, as required by the Foundry authoring contract. Adapt the tone, keep the
structure: **what, why, successor, steps, date, consequence**. Every template names a date and
a person.

Send to a named contact. A changelog entry is not an announcement.

---

## T1 — Deprecation announcement (phase 2)

> **Subject: [Action required by YYYY-MM-DD] `GET /v1/orders` is deprecated**
>
> Hello <name>,
>
> We are deprecating `GET /v1/orders`. Our telemetry shows your application
> (`client_id: acme-billing`) called it N times in the last 30 days, most recently on
> YYYY-MM-DD.
>
> **What is changing.** `GET /v1/orders` will stop responding on **YYYY-MM-DD**. After that
> date it returns `410 Gone`.
>
> **Why.** <One honest sentence. "The v1 response cannot represent partial shipments", not
> "to improve your experience".>
>
> **What to use instead.** `GET /v2/orders`. Migration guide:
> <https://docs.example.test/migrate/orders-v1-to-v2>
>
> **What you need to do.**
> 1. Read the migration guide; the field mapping table covers every v1 field.
> 2. Update your integration. Estimated effort for a typical consumer: <N hours>.
> 3. Verify against v2 in our sandbox: <url>.
> 4. Confirm to <owner@example.test> when you have migrated.
>
> **Differences you should know about**, including the ones that are less convenient for you:
> - `total` is now an object with `amount` and `currency` rather than a decimal.
> - Default page size is 50 instead of 100.
> - `status` gains the value `PARTIALLY_SHIPPED`; treat unknown values as non-terminal.
>
> **Track your own usage:** <dashboard url> shows your remaining calls to v1 in real time.
>
> **Timeline.**
> - YYYY-MM-DD — deprecated, `Deprecation` and `Sunset` headers now returned
> - YYYY-MM-DD — reminder
> - YYYY-MM-DD — announced brownout, 10 minutes, 410 responses
> - YYYY-MM-DD — sunset: v1 returns 410
> - YYYY-MM-DD — removed
>
> If this date is not workable, reply by YYYY-MM-DD and we will discuss. Silence will be
> treated as agreement with the date above.
>
> — <name>, <team>

---

## T2 — Reminder (90 / 30 / 7 / 1 days)

> **Subject: [N days left] `GET /v1/orders` sunsets on YYYY-MM-DD**
>
> Hello <name>,
>
> `GET /v1/orders` stops responding in **N days**, on YYYY-MM-DD.
>
> Your application (`client_id: acme-billing`) made **N calls in the last 7 days**, most
> recently YYYY-MM-DD HH:MM UTC. Live view: <dashboard url>.
>
> Migration guide: <url>. Sandbox: <url>. Questions: <owner@example.test>.
>
> If you cannot meet this date, reply today with the date you can meet and the reason.
>
> — <name>, <team>

Escalate channel with each reminder: email → shared chat → the consumer's on-call or account
manager. If usage has not moved by the 30-day reminder, the email channel has failed; change it.

---

## T3 — Brownout notice

> **Subject: [Scheduled] `GET /v1/orders` will return 410 for 10 minutes on YYYY-MM-DD**
>
> To surface remaining integrations before the sunset on YYYY-MM-DD, `GET /v1/orders` will
> return `410 Gone` for **10 minutes**, from HH:MM to HH:MM UTC on YYYY-MM-DD.
>
> This is a rehearsal. Normal service resumes automatically at HH:MM.
>
> If this affects you, it means you have not yet migrated. Guide: <url>.

Never send this the same day. Never brownout a payment, safety or regulatory path.

---

## T4 — Sunset executed

> **Subject: `GET /v1/orders` has been withdrawn**
>
> As announced on YYYY-MM-DD, `GET /v1/orders` now returns `410 Gone`.
>
> Successor: `GET /v2/orders`. Guide: <url>.
>
> The v1 code remains deployed until YYYY-MM-DD (N weeks). If this has broken a critical
> production system, contact <escalation> immediately and state the business impact — we can
> restore v1 within minutes during this window only. After YYYY-MM-DD the code is removed and
> restoration is not possible.

---

## T5 — Extension granted

> **Subject: `GET /v1/orders` sunset extended for `acme-billing` to YYYY-MM-DD**
>
> We have agreed a new sunset date of **YYYY-MM-DD** for your integration, because <reason>.
>
> This is the final extension. The `Sunset` header now advertises the new date.
>
> Agreed with <name> on YYYY-MM-DD.

Record every extension against a named person and a new date. An extension without a new date
is a cancellation, and it will be treated as one by everyone involved.

---

## Changelog entries

```markdown
## [Unreleased]

### Deprecated
- `GET /v1/orders` — deprecated 2026-09-01, sunset 2027-03-31. Use `GET /v2/orders`.
  Migration guide: docs/migrate/orders-v1-to-v2.md

### Removed
- `GET /v1/orders` — removed. Deprecated 2026-09-01, sunset 2027-03-31, announced to all
  22 registered consumers; 0 calls in the 30 days before removal.
```

The `Removed` entry carries the evidence. It is what a future auditor, or a future you, will
read to decide whether the process was followed.
