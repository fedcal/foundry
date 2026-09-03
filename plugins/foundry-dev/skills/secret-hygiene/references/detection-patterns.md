# Detection: patterns, surfaces, and false-positive filtering

Detection only. Nothing here uses a discovered credential.

## Tool-first, patterns as backup

Prefer a maintained scanner (`gitleaks`, `trufflehog`, forge-native secret scanning) because
they carry provider-specific formats and, importantly, **verification**: they can tell an
active credential from a random string. Use the regex set below when no scanner is available
or as a second pass for formats a scanner does not know, such as your own internal token
format.

Verify flags against the installed version; these invocations are illustrative.

```bash
# Working tree only
gitleaks detect --no-git --redact --report-path .foundry/scratch/gitleaks-tree.json
# Entire history, all refs
gitleaks detect --redact --log-opts="--all" --report-path .foundry/scratch/gitleaks-history.json
# Verified-only reduces noise dramatically
trufflehog git file://. --only-verified --json > .foundry/scratch/trufflehog.json
# A single suspicious string across all history
git log -S '<distinctive-fragment>' --oneline --all
```

## Structural patterns (format-based, low false positive)

```
-----BEGIN ((RSA|EC|DSA|OPENSSH|PGP) )?PRIVATE KEY-----
(?i)\bAKIA[0-9A-Z]{16}\b
(?i)aws_secret_access_key\s*[:=]
(?i)\bxox[baprs]-[0-9A-Za-z-]{10,}
(?i)\bgh[pousr]_[A-Za-z0-9]{20,}
(?i)\bglpat-[A-Za-z0-9_-]{20,}
(?i)\bsk_(live|test)_[0-9A-Za-z]{16,}
(?i)\bAIza[0-9A-Za-z_-]{35}\b
(?i)"type"\s*:\s*"service_account"
(?i)\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.
(?i)\b[a-z0-9+/]{40}\b\s*#?\s*(secret|key)
```

## Contextual patterns (higher recall, higher noise)

```
(?i)(api[_-]?key|apikey|secret|password|passwd|pwd|token|auth|credential|private[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']
(?i)(mongodb|postgres|postgresql|mysql|redis|amqp|mssql)://[^:\s]+:[^@\s]+@
(?i)\b(Authorization|X-Api-Key)\s*:\s*(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}
(?i)(client[_-]?secret|refresh[_-]?token|session[_-]?key)\s*[:=]
```

Run with `rg -n --hidden -g '!.git'` and a pattern file. Review every hit; contextual
patterns are lead generators, not findings.

## File-name sweeps per ecosystem

```bash
# High-signal filenames anywhere in history
git rev-list --objects --all | rg -i '(^|/)(\.env(\..*)?|\.npmrc|\.pypirc|\.netrc|credentials|id_rsa|id_ed25519|\.pem|\.p12|\.pfx|\.jks|\.keystore|secrets?\.ya?ml|serviceAccount.*\.json|terraform\.tfstate)'
# Files someone deleted - still fully present in history
git log --all --diff-filter=D --name-only --pretty=format: | sort -u | rg -i '\.env|\.pem$|secret|credential|key'
```

| Ecosystem | Look at |
|---|---|
| Node | `.npmrc` (`_authToken`), `.env*`, `next.config`, front-end bundles under `dist/`, `NEXT_PUBLIC_*` variables that should not be public |
| Java | `application*.yml/properties`, `gradle.properties`, `settings.xml` (`<servers>`), `*.jks`, `*.keystore` |
| Python | `.pypirc`, `settings.py`, `local_settings.py`, `.env`, notebooks (outputs retain values) |
| Go | embedded config, `//go:embed` targets |
| .NET | `appsettings*.json`, `web.config`, `secrets.json` accidentally committed |
| Terraform | `*.tfvars`, `terraform.tfstate*` (state stores values in plaintext by design), provider blocks |
| Kubernetes | `Secret` manifests (base64 is encoding, not encryption), `ConfigMap` with credentials, Helm `values.yaml` |
| Docker | `ARG`/`ENV` in `Dockerfile` (values persist in layers even if later unset), `.docker/config.json` |
| CI | workflow files with inline values, and job **logs** and artifacts |
| Mobile | `*.plist`, `strings.xml`, `local.properties`, values compiled into the binary |

## Non-repository surfaces

- **CI logs and artifacts** — echoed variables, `set -x`, failing steps printing config,
  test artifacts uploaded with a `.env` inside. Masking is best-effort and does not survive
  base64, chunking or reversal.
- **Container images** — inspect each layer's filesystem, not only the final one. A secret
  added in layer 3 and deleted in layer 7 is still in the image.
- **Log aggregation** — search the index for known credential formats. If a token was ever
  logged, it is in the index for the retention period; that is a rotation trigger.
- **Issue trackers, chat and code review** — a credential pasted "just for debugging"
  outlives the debugging.
- **Backups and database dumps** kept in the repository or in a shared drive.

## False-positive filtering

Before escalating, confirm the hit is a real credential:

1. **Format match** — does it match a provider's documented shape, or is it a random
   40-character string that happens to look like one?
2. **Verification** — where the scanner supports it, use verified-only mode. Otherwise, ask
   the provider's *identity* endpoint whether the credential is recognised. Never exercise
   the privilege the credential grants.
3. **Location** — `test/`, `fixtures/`, `examples/`, `docs/`, a `.spec` file. Test data is
   frequently deliberately fake. Deliberately fake is fine; accidentally real test data
   pointing at a shared sandbox is not — check what it points at.
4. **Known dummies** — values like `xxx`, `changeme`, `AKIAIOSFODNN7EXAMPLE`, `password123`,
   and provider-published example keys. Maintain an allow-list with a reason per entry.
5. **Entropy alone proves nothing.** Hashes, UUIDs, minified code, base64 images, checksums
   and lockfile integrity strings all score high.

Record allow-list entries in the scanner's configuration file, in the repository, with a
comment explaining why — not as a `--exclude` flag in one person's shell history.

## Reporting

Emit `finding.v1` entries via the `security-review` skill's artifact for anything confirmed:
`standard` as `OWASP ASVS 5.0 V14 Data Protection; CWE-798`, severity from what the
credential grants, `failureScenario` naming the credential type and the access it confers.
**Never put the credential value in the artifact** — reference it by
`file:line` and by the last four characters at most.
