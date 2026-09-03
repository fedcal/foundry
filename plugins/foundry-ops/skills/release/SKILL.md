---
name: release
description: Run a release end to end - derive the version from the commit range and an API diff, generate the changelog, tag, publish and promote artefacts by digest, write release notes with the rollback classification, and verify after release. Use when cutting a release, promoting a build between environments, or coordinating a multi-service release with version skew.
user-invocable: true
disable-model-invocation: true
argument-hint: "[--bump auto|major|minor|patch] [--promote <env>] [--dry-run]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: operations
  foundry.io: "commit range -> version + CHANGELOG + tag + artefacts + handoff.v1"
license: Apache-2.0
---

# Release

Runs a release from commit range to verified production, with the version **derived** rather than
asserted and the rollback decided **before** promotion rather than during an incident.

Keep the two words apart throughout:
- **deploy** — the artefact is running in an environment;
- **release** — users can reach the behaviour.

**Do not use it** for package-registry publication mechanics per ecosystem (that is the pipeline's
job), for app-store submissions, or when the working tree is dirty. Stop at step 0 if it is.

This skill signs and pushes a tag and promotes artefacts, so it declares
`disable-model-invocation: true`: a human types `/release`, the model never decides on its own
that now is the moment to cut one. The `release-engineer` agent still preloads it — frontmatter
preloading is a separate path and is unaffected.

## Step 0 — Preconditions

```bash
git status --porcelain                      # must be empty
git fetch --tags --force
git switch <DEFAULT-BRANCH> && git pull --ff-only
gh run list --branch <DEFAULT-BRANCH> --limit 1 --json conclusion -q '.[0].conclusion'  # success
```

Also check the runbook first, per Foundry's standing rule: `runbook_list` (MCP tool), and follow
`.foundry/runbooks/release-train.md` if it exists.

Abort if: the tree is dirty, the default branch is behind, CI is red, or an unresolved incident is
open on the service. Releasing on top of an open incident compounds it.

## Step 1 — Decide the version, do not assert it

**Never write a version number from memory.** Compute it.

```bash
LAST=$(git describe --tags --abbrev=0)
echo "last tag: $LAST"
git log "$LAST"..HEAD --pretty='%h %s' | tee /dev/stderr | wc -l

# breaking
git log "$LAST"..HEAD --pretty='%s%n%b' | grep -E '^(BREAKING CHANGE:|[a-z]+(\(.+\))?!:)' && echo "-> MAJOR"
# features
git log "$LAST"..HEAD --pretty='%s' | grep -qE '^feat(\(.+\))?:' && echo "-> MINOR"
# fixes
git log "$LAST"..HEAD --pretty='%s' | grep -qE '^fix(\(.+\))?:'  && echo "-> PATCH"
```

Then **override the commit-derived guess with an API diff.** A `feat:` that removes a response
field is a MAJOR regardless of its prefix, and commit prefixes are written by humans in a hurry.
Run the checker your language provides (Java: japicmp or revapi; Go: `gorelease`; Rust:
`cargo-semver-checks`; OpenAPI: a spec diff tool). Details and the `0.y.z` caveat in
`references/version-decision.md`.

Print both signals and the resulting version before doing anything irreversible.

## Step 2 — Changelog

Generate the entries from the commit range; do not hand-edit the generated block — the next run
will eat any prose written inside it. Curated highlights go **above** it.

Every breaking change gets a **migration instruction**, not just a description. "Removed
`legacy_id`" is a defect; "Removed `legacy_id`; use `id`, populated since `<VERSION>`" is a
changelog entry.

Template and section rules: `references/changelog-template.md`.

Commit the changelog **before** tagging, so the tag contains it.

## Step 3 — Tag

```bash
git tag -s "v<VERSION>" -m "<PROJECT> v<VERSION>"
git push origin "v<VERSION>"
git verify-tag "v<VERSION>"
git describe --tags --exact-match HEAD
```

- Annotated and signed. Lightweight tags carry no author, date or message — worthless for audit.
- Tag the commit CI actually built and tested, not a later `HEAD`.
- **The tag is the release identity** and must never move. Protect it:
  `gh api repos/<OWNER>/<REPO>/rulesets` — a tag ruleset blocking updates and deletions.
- Monorepos: prefix per package (`<package>/v<VERSION>`) with independent version lines, or
  version everything together. Both work; mixing them does not.

## Step 4 — Artefacts: build once

The tag push triggers the release workflow. It builds **once** and everything downstream travels
by digest.

```bash
gh run watch --exit-status
DIGEST=$(docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<VERSION> --format '{{ .Manifest.Digest }}')
echo "release digest: $DIGEST"
gh attestation verify "oci://<REGISTRY>/<IMAGE>@$DIGEST" --repo <OWNER>/<REPO>
```

Record the digest in the release notes. It is the value every rollback and every promotion needs,
and looking it up during an incident costs minutes you do not have.

## Step 5 — Release notes with the rollback classification

Use `references/release-notes-template.md`. The mandatory field is the classification:

- **Reversible** — no schema change, no irreversible external side effect. Rollback = redeploy the
  previous digest.
- **Forward-only** — a destructive migration, an irreversible external call, a consumed one-way
  event, a notification already sent. There is no rollback. The mitigation is a kill switch plus a
  prepared fix-forward patch.

**If a release is forward-only and has no tested kill switch, it is not ready to promote.**

Write out the rollback command, with its measured duration, before promoting. Under GitOps that
duration is the sync interval plus reconcile time — measure it once and reuse the number.

## Step 6 — Promote by digest

Never rebuild per environment: the thing tested in staging would not be the thing running in
production, and every environment-specific bug becomes unfalsifiable.

```bash
# promote = add a tag to the SAME manifest
docker buildx imagetools create -t <REGISTRY>/<IMAGE>:<ENV> <REGISTRY>/<IMAGE>@"$DIGEST"
# prove it is the same bytes
docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<ENV> --format '{{ .Manifest.Digest }}'
```

Full mechanics, including registry-to-registry copies and the gate checks per environment, in
`references/promote-by-digest.md`. Re-scan before production — new CVEs are published between
staging and prod — and re-verify provenance at each gate.

Deployment manifests reference `<IMAGE>@sha256:<DIGEST>`, never a floating tag.

## Step 7 — Multi-service coordination

If more than one service ships together, assume **every combination of adjacent versions runs
simultaneously**. That is the definition of a rolling deploy, not an edge case.

- Deploy **providers before consumers**, each to 100 % and stable before the next.
- Never let a consumer require a capability that is only partially rolled out — gate it behind a
  flag flipped after the provider reaches 100 %.
- Expand / migrate / contract across three releases, never two.
- Contract tests run against the **previous released version** of each counterpart, not just
  `main`. A green suite against `main` proves nothing about skew.
- One coordination document per train: services, versions, order, gates, the point of no return,
  and the rollback decision-maker **by name**.

## Step 8 — Verify after release

Deployment finished is not release succeeded. Window and thresholds are defined **before**
promotion, in `references/post-release-verification.md`.

Compare against the pre-release baseline for the same window length, not against an absolute
threshold that hides a doubling. Watch error rate, p95/p99 latency, the specific business signal
the release touched, and new error signatures (a novel signature matters even at a low rate).

If any signal breaches, execute the rollback from the release notes **without further debate** and
diagnose afterwards.

## Step 9 — Record

Emit `handoff.v1` to `.foundry/blackboard/<wave>/release-engineer.json` via `blackboard_write`:
artefacts (tag, digest, SBOM, changelog, notes), `status` set from the **verification result**
rather than from optimism, and `openQuestions` for anything a human must confirm.

Then update `.foundry/runbooks/release-train.md` with anything that surprised you. Foundry's
standing rule: after the work, update the runbook.

If `superpowers` is installed, invoke `superpowers:verification-before-completion` before
declaring the release done.

## Rollback

Decided at step 5, executed here.

1. **Behind a flag?** Turn the flag off first — seconds instead of minutes, and it does not
   disturb anything else that shipped in the same release.
2. **Reversible:** redeploy the previous digest through the normal path. Under GitOps,
   `git revert <PROMOTION-SHA> && git push`, then force a sync rather than waiting for the
   interval.
3. **Forward-only:** there is no rollback. Kill switch, then the fix-forward patch release.
4. **Do not delete or re-point the bad tag.** Publish `<VERSION+PATCH>` and mark the bad version
   yanked in the changelog and in the registry's deprecation mechanism. Deleting a tag breaks
   every consumer that pinned it and destroys the audit trail.
5. **Multi-service rollback runs in reverse of the deploy order: consumers first, then
   providers.** Rolling back a provider while its new consumers are live recreates the outage.
6. Record the rollback, its trigger, its duration and the root cause in the runbook.

## References

- `references/version-decision.md` — SemVer rules, the conventional-commit mapping, the API-diff
  override, `0.y.z`, pre-releases and monorepo tagging.
- `references/changelog-template.md` — section structure, migration instructions, yank entries.
- `references/release-notes-template.md` — including the reversible / forward-only classification.
- `references/promote-by-digest.md` — promotion mechanics, per-environment gates, verification.
- `references/post-release-verification.md` — the window, the metrics, the abort thresholds.

## Deliberately not covered

- Per-ecosystem publishing mechanics (npm, Maven Central, PyPI, crates.io) — `scaffold-pipeline`.
- App-store review processes.
- Writing the migrations; this skill enforces expand/contract and refuses to promote a release
  that violates it.
- Incident command and customer communication during an outage.
- Choosing a feature-flag vendor.

## Exit criteria

- [ ] Version **derived** from the commit range plus an API-compatibility check, both outputs
      shown. No version asserted from memory.
- [ ] Changelog generated, breaking changes carry migration instructions, committed before the tag.
- [ ] Annotated signed tag pushed; `git verify-tag` passes; tag protection ruleset verified.
- [ ] Exactly **one** build; the digest recorded and provenance verified.
- [ ] Release classified reversible or forward-only; every forward-only release has a tested
      kill switch.
- [ ] Rollback command and its **measured** duration written down before production promotion.
- [ ] Promotion done by digest; `imagetools inspect` proves each environment tag resolves to the
      same manifest.
- [ ] Production gate re-scans the image and re-verifies provenance.
- [ ] Multi-service: deploy order provider-first, rollback order consumer-first, contract tests
      green against the previous released versions.
- [ ] Post-release window observed, metrics compared with the baseline and recorded.
- [ ] `handoff.v1` `status` reflects the verification result.
- [ ] Runbook updated.
