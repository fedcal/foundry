# Promotion by digest

**Build once, promote by digest.** Rebuilding per environment means the artefact tested in staging
is not the artefact running in production, and every environment-specific bug becomes
unfalsifiable — you can never prove whether the difference was the code or the build.

---

## Tags versus digests

| | Tag | Digest |
|---|---|---|
| Mutable | yes, unless the registry forbids it | no, by construction |
| Identifies | a pointer | the exact bytes |
| For | humans | machines |
| Rollback target | unreliable — it may have been overwritten | reliable |

Deployment manifests reference `<IMAGE>@sha256:<DIGEST>`. Tags exist so that a person can read a
dashboard.

Enable registry-side tag immutability where the registry supports it. Without it, "roll back to
`v1.4.2`" can silently mean "roll back to whatever `v1.4.2` points at today".

---

## Resolve the digest

```bash
# from a tag, without pulling the image
docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<TAG> --format '{{ .Manifest.Digest }}'

# from the running workload - the value that matters during an incident
kubectl -n <NS> get deploy/<NAME> \
  -o jsonpath='{.spec.template.spec.containers[0].image}'; echo

# multi-arch: confirm the manifest list covers what you deploy
docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<TAG> --raw \
  | jq -r '.manifests[]?.platform | "\(.os)/\(.architecture)"'
```

For a multi-arch image, **the digest of the manifest list is the identity**, not the digest of any
single-platform manifest inside it. Promoting a per-platform digest gives environments that
silently differ by architecture.

---

## Promote

Promotion adds a tag to the **same manifest**. Nothing is rebuilt and nothing is re-pushed.

```bash
DIGEST=$(docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<VERSION> --format '{{ .Manifest.Digest }}')

docker buildx imagetools create -t <REGISTRY>/<IMAGE>:<ENV> "<REGISTRY>/<IMAGE>@$DIGEST"

# prove it: both must print the same digest
docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<ENV>     --format '{{ .Manifest.Digest }}'
docker buildx imagetools inspect <REGISTRY>/<IMAGE>:<VERSION> --format '{{ .Manifest.Digest }}'
```

### Across registries

When production pulls from a different registry (an isolated account, an air-gapped mirror), copy
the manifest rather than rebuilding:

```bash
crane copy <SOURCE-REGISTRY>/<IMAGE>@sha256:<DIGEST> <DEST-REGISTRY>/<IMAGE>:<VERSION>
crane digest <DEST-REGISTRY>/<IMAGE>:<VERSION>     # must equal the source digest
```

Copy the **attestations and SBOM** too, or the production gate has nothing to verify. Confirm
which referring artefacts your tooling carries across; several copy tools need an explicit flag.

---

## Per-environment gates

Re-run what is cheap and environment-sensitive. Skip what is already proven for this digest —
with one exception.

| Check | dev | staging | production |
|---|---|---|---|
| Unit and integration tests | at build | skip (same digest) | skip (same digest) |
| Image vulnerability scan | at build | skip | **re-run** |
| Provenance verification | at build | verify | **verify** |
| Config validation for this environment | yes | yes | yes |
| Migration dry-run against this environment's schema | yes | yes | yes |
| Smoke test after deploy | yes | yes | yes |
| Load / soak test | no | yes | no |

**Why re-scan before production:** new CVEs are published between the staging promotion and the
production promotion. The scan that matters is the one against the digest you are about to run,
at the moment you run it. Everything else about the artefact is unchanged, so this is the only
build-time check worth repeating.

**Why verify provenance at every gate:** a promotion is exactly the moment an attacker would
substitute an artefact. A gate that does not verify is decoration.

```bash
gh attestation verify "oci://<REGISTRY>/<IMAGE>@sha256:<DIGEST>" --repo <OWNER>/<REPO>
```

---

## Configuration is what changes between environments

The artefact is identical; the configuration is not. That configuration must be versioned and
reviewed like code, or you have simply moved the untested variable somewhere less visible.

- Config lives in git (values) plus a secret manager (secrets), never in an ad-hoc console field.
- Validate it against a schema at deploy time, before the rollout starts, so a typo fails the
  deploy rather than the pods.
- Under Kubernetes, hash the rendered config into the pod template annotation — otherwise a config
  change does not restart pods and `rollout undo` ships the old image against the new config, a
  combination nobody tested.

---

## Recording

Every promotion records, in the release notes and in the deployment annotation:

- the digest promoted;
- the **previous** digest (this is the rollback target — look it up now, not during an incident);
- who promoted it and when;
- the verification result.

```bash
kubectl -n <NS> annotate deploy/<NAME> --overwrite \
  foundry.release/version="<VERSION>" \
  foundry.release/digest="<DIGEST>" \
  foundry.release/previous-digest="<PREVIOUS-DIGEST>" \
  foundry.release/promoted-by="<WHO>"
```

---

## Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Rebuild per environment | Staging and production run different bytes; environment-specific bugs become unfalsifiable |
| Deploy by floating tag (`:latest`, `:staging`) | You cannot state what is running, and you cannot roll back to it |
| Overwrite a version tag | Anyone pinned to it silently gets different bytes |
| Promote a per-platform digest of a multi-arch image | Environments differ by architecture, silently |
| Delete the bad image from the registry | Breaks everything referencing it by digest; destroys the audit trail. Deprecate and block promotion instead |
| Skip the production re-scan | You ship a digest with a CVE disclosed since staging |
| Promote without verifying provenance | The gate protects nothing |
