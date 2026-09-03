# Preventing recurrence

One control fails. Layer them so a leak has to pass every layer, and so the earliest layer
is the cheapest to act on.

## Layer 0 — Remove the need for the secret

The strongest control is architectural: if there is no long-lived credential, there is
nothing to commit.

- CI authenticates to cloud providers by OIDC federation and receives a short-lived token.
- Workloads use instance or service-account identity, not stored keys.
- Databases issue per-consumer dynamic credentials with a lease.
- Service-to-service calls use mTLS or workload identity rather than a shared API key.

Every long-lived static credential that survives this pass is a permanent liability with a
recurring cost. Count them; the number should go down each quarter.

## Layer 1 — Developer machine, before the commit exists

- A pre-commit hook running a secret scanner on staged content only (fast enough that nobody
  disables it — target well under a second on a normal diff).
- Installed automatically: a bootstrap script in the repository, plus a check in CI that the
  hook ran, because a hook everyone must install manually is a hook half the team does not
  have.
- `.gitignore` covering `.env*`, `*.pem`, `*.p12`, `*.jks`, `credentials`, `*.tfstate*`,
  `.npmrc`, `.pypirc`. Note that `.gitignore` does nothing for a file already tracked.
- A committed `.env.example` with placeholder values, so the real `.env` never needs to be
  committed "for reference".
- Editors and shells configured not to sync history containing credentials.

A hook is bypassable with `--no-verify`. That is acceptable: its job is to catch accidents,
not to stop a determined engineer. Do not rely on it as the only gate.

## Layer 2 — Forge, at push time

Enable platform-native push protection where it exists: it rejects the push containing the
credential, which is the only gate that prevents the secret from ever reaching the server.
Everything after this point is detection, not prevention.

Configure who may bypass it, and require a written reason that lands in an audit log.

## Layer 3 — CI, on every pull request and on a schedule

- Scan the diff on every pull request; fail the build on a verified hit.
- Scan the **full history** on a schedule (weekly is a reasonable default): new detection
  rules find old secrets, and this is how a leak from before the gates existed is found.
- Scan built artifacts and container images, not only source.
- Keep the allow-list in the repository, reviewed like code. An allow-list edited to silence
  an alert without review is how the next real one is missed.
- Fail closed: a scanner that errors must fail the build, not pass it.

## Layer 4 — Runtime and logging

- Redaction at the logging layer for known credential formats, **proven by a test**: log a
  fake token of each format and assert the output is redacted.
- No secrets in URLs (they reach access logs, proxies and `Referer` headers) and none passed
  as command-line arguments (visible in process lists).
- Error handlers that never serialise configuration objects into a response or a crash
  report.
- Alert on unexpected reads from the secret manager: a read from a workload that has never
  read that secret before is a strong signal.

## Layer 5 — Process

- Rotation schedule per secret, with an owner and a due date; overdue rotations visible on a
  dashboard rather than in someone's calendar.
- Offboarding checklist that rotates anything a departing person could have copied. Access
  revocation is not rotation.
- New-repository template that ships the hook config, the `.gitignore`, the scanner config
  and the CI job on day one.
- A blameless path to report a leak. If reporting one is embarrassing, people delete the
  commit quietly and skip rotation — which is the worst possible outcome and the exact
  behaviour a punitive culture produces.

## Measuring that it works

| Metric | Target |
|---|---|
| Long-lived static credentials in inventory | decreasing every quarter |
| Secrets caught at layer 1 or 2 (never reached the server) | increasing share of total |
| Mean time from leak introduction to detection | hours, not months |
| Mean time from detection to confirmed rotation | hours for production credentials |
| Full-history scan result on the default branch | clean, or every hit allow-listed with a reason |
| Repositories missing the CI scanning gate | zero |

Report these with the `security-review` artifact when the skill is run as part of an audit,
so the trend is visible rather than each incident being treated as the first one.
