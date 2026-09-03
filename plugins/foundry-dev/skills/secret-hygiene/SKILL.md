---
name: secret-hygiene
description: Detect, rotate and remove leaked secrets - scan the working tree and the full git history, rotate in the correct order so nothing breaks, migrate to a secret manager or short-lived workload identity, and prevent recurrence with pre-commit and CI gates. Use when a scanner or review finds a credential in code, config, logs, an image or CI, when onboarding a repository of unknown provenance, or before making a repository public. Removing a secret from git history does not un-leak it - rotation is mandatory.
allowed-tools: Read Grep Glob Bash Write Edit TodoWrite
model: sonnet
effort: medium
user-invocable: true
argument-hint: "<repo path> [--scan-history] [--incident]"
metadata:
  foundry.vertical: dev
  foundry.io: "repo + history -> rotation runbook + prevention controls"
license: Apache-2.0
---

# Secret hygiene

## The rule that governs everything else

**Rewriting git history does not un-leak a secret. Rotation is mandatory, always, without
exception.**

By the time you find a committed credential, it may have been: cloned by every developer
and CI runner; mirrored to a backup, a code-search index or an artifact cache; fetched by
a bot within seconds of the push if the repository was ever public; retained in a forge's
own storage where the commit stays reachable by SHA after a force-push; captured in a pull
request view, a code-review tool, an editor cache, a chat notification or a CI log; and
included in any container image or build artifact produced from that commit.

You cannot enumerate those copies and you cannot delete them. The only action that reliably
ends the exposure is invalidating the credential. History rewriting is optional hygiene
performed *after* rotation, never instead of it.

Standards: OWASP ASVS 5.0 V13 Configuration / V14 Data Protection · CWE-798 (hard-coded
credentials), CWE-522 (insufficiently protected credentials), CWE-312 (cleartext storage),
CWE-532 (secrets in logs), CWE-540 (secrets in source) · NIST SP 800-57 (key management) ·
NIST SP 800-218 (SSDF) for protecting code from unauthorised access.

Defensive scope only: detection, containment, rotation, prevention. No credential-abuse
tooling.

## Order of operations (incident path)

Do these in order. Rotating before you understand blast radius causes an outage; enumerating
before you rotate leaves the credential live longer than it needs to be. The compromise
below is deliberate.

### 1 — Classify (5 minutes, no longer)

| Question | Why it changes the response |
|---|---|
| What does the credential grant? | read-only analytics key vs production database owner |
| Was the repository ever public, or is it a fork of a public one? | public means "assume actively used", not "assume at risk" |
| Is it still valid? | check by identity metadata (whoami-style API calls), never by exercising the privilege |
| How long has it been in history? | `git log -S '<fragment>' --oneline` gives first and last touch |
| Does a rotation break a running system? | decides single-step vs dual-key rotation |
| Is there a usage log? | tells you whether to open an incident, and gives the audit window |

If the credential grants production data access **and** the repository was ever public,
open an incident before continuing. Everything below is still done, but under incident
process with a named commander, not as a chore.

### 2 — Contain

Prefer scoping down to deleting when an outage would be worse than a short extension of
exposure: strip the credential's privileges, restrict its source IP range, or disable the
specific permission it grants, then continue to full rotation. If it grants
crown-jewel access and you have no dual-key path, revoke immediately and accept the outage
— an outage is recoverable, a breach is not.

### 3 — Rotate

Full per-credential-type procedure in `references/rotation-runbook.md`. The general dual-key
sequence, which avoids downtime:

1. **Issue** a new credential alongside the old one. Most systems support two valid keys.
2. **Distribute** the new one to every consumer: application config, CI, IaC, developer
   environments, cron and batch hosts, partner systems, mobile builds if applicable.
3. **Verify** every consumer is using the new one — by usage logs keyed on credential id,
   not by assumption. This is the step teams skip and the reason rotations cause outages.
4. **Revoke** the old one.
5. **Confirm** revocation with a negative check: the old credential must now fail.
6. **Record** the rotation: what, when, who, why, and the new expiry date.

Single-key systems (no dual-key support) require a maintenance window, or a proxy that lets
you swap behind a stable interface. Decide which before starting.

Where the leaked material is a **signing key** or a **certificate private key**, rotation is
not enough on its own: revoke and, where a trust list exists, publish the revocation, then
consider whether anything signed with it must be re-signed or distrusted. Where it is a
**database password**, rotation does not evict existing sessions — terminate them. Where it
is an **encryption key**, rotation requires re-encrypting data; plan it as a migration.

### 4 — Assess exposure

With rotation done, look at what the credential did while it was exposed. Pull access logs
for the credential id over its whole exposure window (not just since discovery) and look for:
use from unexpected source addresses or regions; unusual volumes; access to resources the
legitimate consumer never touches; use outside the legitimate consumer's operating hours;
and creation of new credentials, users or grants — persistence is the first thing an
intruder establishes.

No logs is itself a finding: raise it, because it means you cannot answer "was it used?"
for this or any future incident.

### 5 — Remove from the code

Replace the literal with a reference: an environment variable injected by the platform, a
secret manager lookup, or — best — a short-lived credential obtained through workload
identity so there is no static secret to leak. Then validate at startup that the secret is
present and well-formed, and fail loudly if not: a missing secret must not silently fall
back to a default (CWE-1188).

### 6 — Optionally rewrite history

Only after rotation, and only if it buys something real: making a repository public,
satisfying a contractual requirement, or removing a secret that cannot be rotated (rare,
and usually means "cannot be rotated *yet*"). Procedure, coordination cost and the reasons
it often is not worth it: `references/history-rewrite.md`.

### 7 — Prevent recurrence

`references/prevention.md`. Without this step, the same class of leak returns within months;
the fix is layered gates, not a policy document.

## Detection

Scan three surfaces. They fail differently and you need all three.

**Working tree** — fast, catches what is about to be committed:
```bash
gitleaks detect --no-git --redact --report-path .foundry/scratch/gitleaks-tree.json
rg -n --hidden -g '!.git' -f <(cat <<'PAT'
(?i)(api[_-]?key|secret|passwd|password|token|private[_-]?key|credential)\s*[:=]\s*["'][^"']{8,}["']
-----BEGIN (RSA|EC|OPENSSH|PGP|DSA)? ?PRIVATE KEY-----
(?i)aws_secret_access_key\s*=
PAT
) .
```

**Full history** — the surface that matters, and the one most audits skip:
```bash
gitleaks detect --redact --log-opts="--all" --report-path .foundry/scratch/gitleaks-history.json
trufflehog git file://. --only-verified --json > .foundry/scratch/trufflehog.json
git log -S 'AKIA' --oneline --all
git log --all --diff-filter=D --name-only | rg -i '\.env|\.pem$|credentials|id_rsa'
git rev-list --objects --all | rg -i '\.pem$|\.p12$|\.pfx$|\.jks$|\.keystore$|\.env$'
```
A deleted file is still in history. `--diff-filter=D` finds the ones somebody "removed".

**Everything else** — the surfaces people forget:
CI logs and job artifacts; container image layers (`docker history`, and a filesystem scan
of each layer — `ARG`/`ENV` values persist even if later unset); Kubernetes ConfigMaps and
opaque Secrets that are only base64, not encrypted; Terraform state files (they store
values in plaintext by design); `.env`, `.npmrc`, `.pypirc`, `.netrc`, `.aws/credentials`,
`.docker/config.json`, IDE run configurations, shell history; front-end bundles and mobile
app binaries; database seed and fixture files; documentation, README examples, screenshots
and support tickets; log aggregation indices.

Pattern library, false-positive filtering and per-ecosystem file lists:
`references/detection-patterns.md`.

**Verification before alarm.** A high-entropy string is not a secret. Before escalating,
confirm it: does it match a known credential format, does the provider's identity endpoint
recognise it, is it in a fixture directory, is it an example from documentation? Use
verified-only modes where the scanner offers them. The false-positive discipline from the
`security-review` skill applies: an unverified "leak" that triggers an emergency rotation
costs more than the scan saved.

## Migrating to a secret manager

The target is **no static secret in any artifact you build or store**. In order of
preference:

1. **Workload identity / short-lived credentials.** The application proves what it is
   (cloud instance identity, Kubernetes service account token, CI OIDC token) and receives a
   credential valid for minutes. There is no long-lived secret to leak. This is the only
   option that removes the problem class rather than relocating it.
2. **Secret manager with dynamic secrets.** The manager mints per-consumer database
   credentials with a lease and revokes them automatically.
3. **Secret manager with static secrets**, injected at runtime, never baked into an image.
4. **Platform-injected environment variables** from an encrypted store.
5. **Encrypted-in-repo** (`sops`-style, `git-crypt`-style) — acceptable only when the
   decryption key is itself managed by 1–3, and never for a repository that may become
   public.

Migration checklist:
- [ ] Every secret has a named owner and a stated rotation period.
- [ ] Access to each secret is least-privilege: which workload, which environment.
- [ ] Reads are audited; an unexpected read is alertable.
- [ ] Production secrets are unreadable by developers by default; break-glass access is
      separate, time-bounded and logged.
- [ ] The application fails fast and loudly on a missing or malformed secret.
- [ ] Secrets are not passed as command-line arguments (visible in process lists) and not
      written to disk unencrypted.
- [ ] Logging redacts known secret formats, proven by a test that logs a fake token of each
      format and asserts redaction.
- [ ] Non-production environments use different credentials from production. A shared
      credential means a staging compromise is a production compromise.

## Exit criteria

- [ ] Every confirmed secret rotated, with revocation confirmed by a negative check.
- [ ] Exposure window analysed against usage logs, or the absence of logs recorded as a
      finding.
- [ ] No literal secret remains in the working tree; each replaced by a managed reference.
- [ ] Startup validation present for every required secret.
- [ ] Full-history scan run and clean, or every remaining hit triaged as a verified false
      positive with a documented allow-list entry.
- [ ] Pre-commit hook and CI scanning gate active on the default branch.
- [ ] Forge-level push protection enabled if the platform offers it.
- [ ] Rotation record written: what, when, who, new expiry date, and the owner.
- [ ] If history was rewritten: every collaborator notified, forks handled, and the forge
      asked to expire cached views — with rotation already complete beforehand.

## What this skill deliberately does not cover

- **Cryptographic key management design** — hierarchy, HSM policy, key ceremonies,
  envelope encryption. See NIST SP 800-57; route to the ops or platform vertical.
- **Full incident response**: legal and regulatory notification (GDPR Art. 33/34 timelines),
  customer communication, forensics preservation, law-enforcement contact. This skill covers
  the technical containment path only.
- **Choosing a secret manager product.**
- **Data-at-rest encryption for application data.**
- **Password policy and user credential storage** — see `identity-engineer` and
  NIST SP 800-63B.
- **Determining whether a leak was exploited.** It analyses available logs; it does not
  perform forensics.
- **Any tool's current flag set.** Verify commands against the installed version; the
  invocations here are illustrative.

## Degradation

- No scanner installed: use the `rg` pattern set in `references/detection-patterns.md` plus
  `git log -S` and the deleted-file sweep. Recall is lower — say so in the report rather
  than declaring the repository clean.
- No network access: scan and inventory, produce the rotation runbook, and mark rotation as
  a pending action with owners. Never mark a secret rotated that you did not rotate.
- Cannot rotate immediately (vendor process, maintenance window): contain by scoping down
  privileges, record the accepted exposure with a deadline and an owner, and set a reminder.
  An undated "we will rotate later" is a permanent leak.
- Repository history is enormous: scan incrementally by date range with `--log-opts`, and
  prioritise branches that were ever pushed to a public or third-party remote.
- `superpowers` present: use `superpowers:systematic-debugging` when a rotation breaks a
  consumer and the failing component is not obvious, and
  `superpowers:verification-before-completion` before closing.

## References

- `references/rotation-runbook.md` — rotation order per credential type, with the
  breaks-if-you-get-it-wrong notes.
- `references/detection-patterns.md` — patterns, file lists per ecosystem, and
  false-positive filtering.
- `references/history-rewrite.md` — how to rewrite, what it does not achieve, and the
  coordination cost.
- `references/prevention.md` — layered gates: pre-commit, CI, forge push protection,
  architecture changes that remove the need for a secret at all.
