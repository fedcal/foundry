# Release notes template

The changelog says *what changed*. The release notes say *what happens if it goes wrong*, and are
read under pressure. Copy this per release, fill in every placeholder, and attach it to the GitHub
release.

The mandatory field is the **rollback classification**. Everything else is context.

---

```markdown
# <PROJECT> v<VERSION>

**Released:** <YYYY-MM-DD>
**Tag:** `v<VERSION>` (`<COMMIT-SHA>`)
**Artefact digest:** `<REGISTRY>/<IMAGE>@sha256:<DIGEST>`
**Provenance:** verified - `gh attestation verify oci://<REGISTRY>/<IMAGE>@sha256:<DIGEST> --repo <OWNER>/<REPO>`
**SBOM:** `<SBOM-URL>`

## Rollback classification

**<REVERSIBLE | FORWARD-ONLY>**

<If REVERSIBLE:>
Rollback is redeploying the previous digest `<PREVIOUS-DIGEST>`.
Measured duration: **<MINUTES> min** (<method: kubectl rollout undo | GitOps revert + sync>).

<If FORWARD-ONLY:>
**There is no rollback for this release.** Cause: `<DESTRUCTIVE-MIGRATION | IRREVERSIBLE-SIDE-EFFECT | CONSUMED-EVENT>`.
Mitigation: kill switch `<FLAG-NAME>` - `<FLAG-KILL-COMMAND>` - tested on `<DATE>`.
Fix-forward: branch `<BRANCH>`, expected time to a patched release **<MINUTES> min**.

A forward-only release without a tested kill switch must not be promoted.

## Rollback command

```bash
<EXACT-COMMAND-SEQUENCE>
```

**What this does NOT undo:** `<MIGRATIONS | CONFIG | CONSUMED-MESSAGES | EXTERNAL-SIDE-EFFECTS | CDN-CONTENT>`.
Full procedure: `.foundry/runbooks/rollback-<service>.md`.

## Deployment

| Environment | Digest | Promoted | By |
|---|---|---|---|
| staging | `<DIGEST>` | `<TIMESTAMP>` | `<WHO>` |
| production | `<DIGEST>` | `<TIMESTAMP>` | `<WHO>` |

Strategy: `<rolling | blue-green | canary>`. Expected duration: `<MINUTES>` min.

## Migrations

| Id | Type | Reversible | Notes |
|---|---|---|---|
| `<MIGRATION-ID>` | expand / migrate / contract | yes / no | `<NOTES>` |

Expand/contract stage of this release: `<EXPAND | MIGRATE | CONTRACT>`.
The previous version `<CAN | CANNOT>` run against this schema.

## Compatibility

- Minimum compatible version of `<DEPENDENT-SERVICE>`: `<VERSION>`.
- This version is compatible with `<COUNTERPART>` `<N-1-VERSION>` and `<N-VERSION>`.
- Breaking API changes: `<LIST or none>`.
- Deploy order in this train: `<PROVIDER-FIRST-ORDER>`.
  Rollback order: **the reverse** - `<CONSUMER-FIRST-ORDER>`.

## Feature flags

| Flag | Default | Owner | Remove by |
|---|---|---|---|
| `<FLAG>` | off | `<OWNER>` | `<YYYY-MM-DD>` |

## Verification

Observation window: **<MINUTES> min** starting at promotion.

| Signal | Baseline | Threshold | Result |
|---|---|---|---|
| Error rate | `<BASELINE>` | `<THRESHOLD>` | `<RESULT>` |
| p95 latency | `<BASELINE>` | `<THRESHOLD>` | `<RESULT>` |
| `<BUSINESS-SIGNAL>` | `<BASELINE>` | `<FLOOR>` | `<RESULT>` |
| New error signatures | 0 | 0 | `<RESULT>` |

Smoke test: `<COMMAND>` - `<RESULT>`.

## Known issues

- `<ISSUE>` - `<WORKAROUND>` - tracked at `<URL>`.

## Contacts

- Release owner: `<NAME>`
- Rollback decision-maker: `<NAME>` (does **not** require escalation to trigger a rollback)
- On-call: `<ROTATION>`
```

---

## Notes on filling this in

- **Fill the classification before promoting, not after.** Deciding "is this reversible?" during
  an incident is how a team spends fifteen minutes discovering that the rollback they just ran
  changed nothing.
- **Record the previous digest before rolling forward.** Looking it up afterwards costs minutes at
  the worst moment.
- **Measure the rollback duration once** and reuse the number until the platform changes.
  Under GitOps it is the sync interval plus reconcile time, and it is usually larger than people
  expect.
- **Name the rollback decision-maker**, and make clear that triggering a rollback needs no
  approval. Rollbacks delayed by an escalation chain are the expensive kind.
