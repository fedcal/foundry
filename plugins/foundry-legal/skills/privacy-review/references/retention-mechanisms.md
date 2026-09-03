# Retention and deletion mechanisms

> **Automated technical assessment. Not legal advice.**

A retention period is only real if something executes it. This file defines what counts as a
mechanism per storage technology, and how to verify it actually runs.

## The three questions per store

1. **Where is the period configured?** A file path and a value, or `undetermined`.
2. **Does the mechanism execute?** A schedule definition **and** evidence of execution.
3. **Does it reach everything?** Denormalised copies, indexes, derived aggregates, backups.

A retention schedule in `docs/` answers none of these. It is a claim.

## What counts as a mechanism

| Storage | Mechanism | Verify by |
|---|---|---|
| PostgreSQL / MySQL | scheduled `DELETE`, partition drop, `pg_cron` job, application cron | find the job definition, then find its last run in job history or logs |
| MongoDB | TTL index on a date field | `db.collection.getIndexes()` — a TTL index with `expireAfterSeconds` |
| Redis | `EXPIRE` / `SETEX` on write, or `maxmemory-policy` | read the write site: a key set without a TTL never expires |
| S3 / GCS / Azure Blob | bucket lifecycle rule | the IaC resource, plus the rule as deployed — they drift |
| Elasticsearch / OpenSearch | ILM policy, rollover with delete phase | the policy document attached to the index template |
| Kafka / event streams | topic `retention.ms`, compaction settings | the topic config, not the broker default |
| CloudWatch / Stackdriver / Loki | log group retention setting | the configured value per log group; the default is often "never" |
| Data warehouse | scheduled deletion, table expiry, partition expiration | the expiry property on the table or dataset |
| Backups / snapshots | backup plan lifecycle | the retention rule in the backup plan |
| CDN | cache TTL, purge on delete | whether the erasure path issues a purge |
| Client-side | explicit removal, cookie `Max-Age`, storage clear on logout | the logout handler |
| SaaS vendors (CRM, support, email) | vendor-side retention configuration | the setting in the vendor, evidenced by a screenshot or an API read — not by intention |
| LLM providers | the provider's data retention / zero-retention setting | the configured value in the client or account, per endpoint |

## Verifying execution

A schedule that was never deployed is not a mechanism. Look for at least one of:

- job run history (Kubernetes `CronJob` last schedule time, Airflow DAG runs, Sidekiq/Celery beat records);
- a metric or log line emitted by the job with a count of rows removed;
- a query showing the oldest record in the store is no older than the retention period. **This is the
  strongest evidence available and it is one query.** Run it:

```sql
SELECT MIN(created_at) AS oldest, NOW() - MIN(created_at) AS age FROM <table>;
```

If `age` exceeds the stated retention, the mechanism is not working regardless of what the config
says. Record the result as `measurement` evidence. This single check has a very high hit rate.

## Soft delete

`deleted_at IS NOT NULL` retains the data. That may be entirely defensible — for audit, for dispute
resolution, for a legal hold — but it is a **different claim** and must be stated as one.

When you find soft delete, establish:

- Is there a second stage that hard-deletes after a defined window, and does it run?
- Do queries actually filter on the flag everywhere, including reporting, exports and admin tools?
- Does the soft-deleted row still appear in the search index, the warehouse and the event stream?

Report soft delete presented as erasure as a `partial` with the gap named explicitly.

## Cascade and orphans

Row deletion does not imply data deletion:

- `ON DELETE SET NULL` leaves the child row and its personal data behind.
- Denormalised copies (a `user_name` column on `orders`) survive the parent delete.
- Audit and history tables usually retain the previous values by design.
- Event stores and outbox tables hold the full payload of past writes.
- Materialised views and warehouse tables refresh from a source that no longer has the row, but keep
  what they already copied unless something deletes it.

Enumerate these per entity. The reliable method is to search the schema for every occurrence of a
personal-data column name, not just its canonical home.

## Backups

Backups are the one store where immediate erasure is usually impossible, and the failure is not
having a position.

An acceptable position states: the backup retention horizon, that restored data is re-processed
against the deletion log before or immediately after restore, and who is accountable. An unacceptable
position is silence, or a privacy notice implying instant total erasure.

Check for a **deletion log or tombstone set** that survives a restore. Without it, a restore
resurrects deleted records and nobody notices.

## Fine-tuned models and embeddings

Deleting a source record does not remove its influence from model weights, and often does not remove
its vector from an index. Check:

- vector stores: is there a delete-by-source-id path, and does the erasure handler call it?
- caches of embeddings and derived features keyed by user;
- fine-tuning datasets retained after training;
- the model itself, where it was fine-tuned on personal data — record this explicitly as a limitation
  on any erasure claim and hand it to `ai-governance-analyst`.

## Recording the finding

For a retention or erasure control, the `rationale` decomposes into the six elements from the store
inventory and states which were verified. Example gap wording that is specific enough to act on:

> Retention is configured only for the primary `events` table (14 days,
> `infra/rds/retention.sql:12`, verified by MIN(created_at) age of 11 days). No retention on the
> OpenSearch `events-*` indices (no ILM policy attached, `infra/search.tf:41`), on the warehouse copy
> (`dbt/models/events.sql`, no partition expiry), or on the CloudWatch log group
> `/aws/lambda/ingest` (retention: Never expire). Erasure path `src/privacy/erase.ts:60` reaches the
> primary table only: 1 of 4 stores covered.
