# `pricing.json` — the only source of model prices

## Why this file exists

Model prices change, differ by tier, region, batch or priority mode, and by contract. A price
recalled from training data is wrong in a way that is invisible to the reader, because it looks
exactly like a price that was checked. Putting prices in a project file makes them **auditable**:
they have a source, a date, and a person who read them.

Rule, without exception: **no agent, skill or script in this vertical states a per-token price
it did not read from this file.**

## Location

Resolution order:

1. `.foundry/economics/pricing.json` — Foundry convention, preferred
2. `<project root>/pricing.json`
3. the path in `.foundry/config.json` under `economics.pricingPath`

Commit it. It is configuration, not a secret — it contains published prices, not credentials.
If your contract prices are confidential, keep the file out of version control and say so in
the report; the analysis still runs, it just is not reproducible by a third party.

## Schema

```json
{
  "currency": "EUR",
  "source": "<exact URL or document, and who read it>",
  "asOf": "YYYY-MM-DD",
  "notes": "<tier, region, batch mode, contractual discount>",
  "models": {
    "<model-id>": {
      "inputPerMTok": 0,
      "outputPerMTok": 0,
      "cacheWritePerMTok": 0,
      "cacheReadPerMTok": 0
    }
  },
  "otherServices": {
    "<service>": { "unit": "<unit>", "pricePerUnit": 0 }
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `currency` | yes | ISO code. If your provider bills in another currency, record the FX rate and date in `notes` — an FX assumption is an assumption. |
| `source` | yes | Where the numbers came from. Without it the file is unverifiable. |
| `asOf` | yes | Date the prices were read. Drives the staleness warning. |
| `models.<id>.inputPerMTok` | yes | Price per 1,000,000 input tokens |
| `models.<id>.outputPerMTok` | yes | Price per 1,000,000 output tokens |
| `models.<id>.cacheWritePerMTok` | if caching is used | Price to write tokens into the prompt cache |
| `models.<id>.cacheReadPerMTok` | if caching is used | Price to read cached tokens |
| `otherServices` | no | Non-token charges: search, code execution, storage, per-call tools |

Model ids must match exactly what appears in your usage export, or the join fails silently.
Copy them from the export, not from documentation.

## The zero convention

**Zero means "not filled in", never "free".** A model whose price entries are all zero is
treated as unpriced: the report names it and emits `<<UNPRICED>>` rather than a total of zero.

This matters because a silent zero would produce a beautifully formatted report concluding
that AI costs nothing — the most dangerous possible output of this vertical.

## Staleness

Compare `asOf` to today. Beyond 90 days, warn:

> `pricing.json` was last updated on `<asOf>`, more than 90 days ago. Prices may have changed.
> Re-read the provider's published pricing before relying on the monetary figures below.

Re-read on: any provider pricing announcement, a new model entering the workflow, a contract
change, a change of tier or region, and at least quarterly.

## Filling it in — the human's job, not the agent's

1. A human opens the provider's current published pricing page.
2. A human copies the figures into `.foundry/economics/pricing.json`.
3. A human records the URL in `source` and today's date in `asOf`.
4. A human notes tier, region and any negotiated discount in `notes`.

An agent may create the file **from the template with zeros and placeholders**, and may point
out which model entries are missing. An agent may not fill in a number.

## Sanity checks worth running on the file

- Output price should exceed input price for the same model. If not, a column has been swapped.
- Cache read should be well below base input, and cache write at or above it. If not, the
  cache break-even formula will produce nonsense — check before using it.
- Every model id referenced by an agent's `model:` frontmatter across the installed plugins
  should have an entry, or the report will silently under-count. Enumerate them:
  `grep -rn "^model:" plugins/*/agents/*.md`
- `currency` matches the currency of every other figure in the analysis. Mixed currencies
  without a stated FX rate are a defect.

## Related

- `metrics-schema.md` — what the metrics file can and cannot measure
- `levers.md` — what to do once the numbers exist
- `pricing.template.json` — the file to copy
