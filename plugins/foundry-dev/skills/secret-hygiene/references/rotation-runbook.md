# Rotation runbook per credential type

Precondition, restated because it is the whole point: **rotation is mandatory whenever a
secret has been exposed, regardless of whether the commit is removed.**

General dual-key sequence: issue new → distribute → verify consumers moved (by usage logs
keyed on credential id) → revoke old → confirm revocation fails → record.

Verify each command against the installed tool version before running it; flags change.

---

## Cloud provider access keys (long-lived)

**Order.** Create the second key → update every consumer → confirm the old key's
last-used timestamp stops advancing → delete the old key → confirm a call with it fails.

**Breaks if you get it wrong.** Consumers you did not know about: CI runners, a partner
integration, a laptop `~/.aws/credentials`, a Terraform backend, a monitoring agent, a
serverless function's environment.

**Do better afterwards.** Long-lived provider keys are the leak class that keeps recurring.
Replace them with OIDC federation from CI and instance/workload identity in runtime. If
there is no key, there is nothing to leak.

---

## Database credentials

**Order.** Create a new user or set a second password if supported → update consumers →
**terminate existing sessions** (rotation alone does not evict an already-authenticated
connection) → drop or lock the old user → confirm.

**Breaks if you get it wrong.** Connection pools cache credentials until recycled; migration
jobs, read replicas, BI tools, backup jobs and ad-hoc analyst access each hold their own
copy. Object ownership tied to the old user causes permission failures after it is dropped —
check ownership before dropping, not after.

**Do better afterwards.** Dynamic per-consumer credentials with short leases, minted by a
secret manager.

---

## API keys for third-party services (payments, email, SMS, analytics)

**Order.** Most providers support multiple active keys — issue, distribute, revoke. Where
only one key exists, schedule a window.

**Breaks if you get it wrong.** Webhook *signing* secrets are a separate credential from
API keys and rotate on the provider's schedule, often requiring you to accept both old and
new signatures during an overlap. Plan the overlap explicitly; a missed webhook is silent
data loss.

**Also.** Some keys are scoped per environment and some are not. A leaked "test" key that is
actually usable in production is a common surprise — verify the scope rather than trusting
the name.

---

## OAuth client secrets

**Order.** Register a second secret if the authorisation server supports it → update the
confidential client → revoke the old.

**Breaks if you get it wrong.** Every deployment of the client, including blue/green and
canary instances, and any partner using the same client id. Existing access tokens issued
under the old secret remain valid until expiry: if the exposure is serious, revoke the
tokens too (RFC 7009) and force re-authentication.

**Do better afterwards.** Move to `private_key_jwt` (RFC 7523) or mTLS client authentication
(RFC 8705), so the credential never transits as a shared string.

---

## Signing keys (artifact signing, JWT signing, code signing)

Rotation is necessary but not sufficient.

**Order.** Generate a new key → publish the new public key or JWKS entry → start signing
with the new key while verifiers still accept both → wait out the verification window →
remove the old public key → revoke, and publish revocation where a trust list exists.

**Then decide.** Anything signed with the exposed key during the exposure window may not be
trustworthy. For JWT signing keys, this means every token issued in the window: force
re-authentication. For artifact signing keys, this means re-signing releases and, if the key
could have been used to sign something you did not produce, publishing a notice. This is the
decision people avoid; make it explicitly and record it.

---

## TLS private keys

**Order.** Generate a new key and CSR → obtain the new certificate → deploy → revoke the old
certificate through the CA → confirm the revocation is published.

**Breaks if you get it wrong.** Certificate pinning in mobile apps (a pinned old key means
a rotation bricks the app for existing installs — check for pinning *before* rotating);
intermediate certificate chains; every terminating layer (CDN, load balancer, mesh sidecar,
origin) holding its own copy.

**Do better afterwards.** Automated issuance and renewal (RFC 8555 / ACME) with short-lived
certificates, so rotation is routine rather than an event.

---

## SSH keys and deploy keys

**Order.** Add the new public key to every `authorized_keys` and forge deploy-key list →
verify access with the new key → remove the old → confirm the old fails.

**Breaks if you get it wrong.** Automation using the key from a host you forgot; a key
authorised on machines outside configuration management; agent-forwarding sessions still
open.

**Do better afterwards.** Short-lived SSH certificates from an internal CA, and deploy keys
scoped read-only to a single repository.

---

## CI/CD tokens (registry publish, forge tokens, runner tokens)

**Order.** Highest priority in any incident: these mint further access. Revoke first, ask
questions after — a broken pipeline is cheap.

**Then.** Audit what was published while the token was exposed. Compare every published
artifact's digest and provenance against the expected pipeline run. An unexpected publish is
a supply-chain incident: escalate to `supply-chain-guardian` and treat downstream consumers
as affected.

**Do better afterwards.** OIDC-federated, short-lived, per-workflow credentials; publish
tokens scoped to one package; provenance verified at install/deploy.

---

## Encryption keys (data at rest)

Rotation means re-encryption, so it is a migration, not a swap.

**Order.** Add the new key as the active encryption key while retaining the old for
decryption → re-encrypt existing data in batches → verify none remains under the old key →
retire the old key → destroy it per your key-destruction policy.

**Breaks if you get it wrong.** Backups encrypted with the old key must remain decryptable
for their retention period — do not destroy a key that a restorable backup still depends on.
See NIST SP 800-57 for key states and transitions.

---

## Rotation record

Write one per rotation, wherever your team will find it later:

```
Credential: <type + identifier, never the value>
Exposed via: <commit / log / image / ticket>, first seen <date>, exposure window <range>
Blast radius: <what it granted>
Contained: <timestamp, how>
Rotated: <timestamp, by whom>
Old credential revocation confirmed: <how it was verified>
Usage log review: <findings, or "no logs available - raised as finding SEC-nnn">
Follow-up: <migration to workload identity / prevention gate added>
Next rotation due: <date>
```

Never paste the old or new value into the record, the ticket, or the chat channel. That is
how a rotated secret leaks a second time.
