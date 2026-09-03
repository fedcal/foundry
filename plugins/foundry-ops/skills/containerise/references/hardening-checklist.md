# Container hardening checklist

Every line has a reason and a command that verifies it. Cited controls:
**CIS Docker Benchmark** section 4 (container images) and 5 (runtime), and
**NIST SP 800-190** (Application Container Security Guide) section 3 risks / section 4
countermeasures. Where a control belongs to the orchestrator rather than the image, it says so.

---

## Build context

| # | Check | Why | Verify |
|---|---|---|---|
| 1 | `.dockerignore` exists and excludes `.git`, `node_modules`, `.env*`, build output | `COPY . .` otherwise bakes git history and credentials into a layer | `docker build --progress=plain . 2>&1 \| grep 'transferring context'` — target **< 10 MB** |
| 2 | No secret file is reachable from the context | A secret in a layer is public to everyone who can pull | `docker history --no-trunc <IMAGE>` and inspect the layers |

## Image composition

| # | Check | Why | Verify |
|---|---|---|---|
| 3 | Multi-stage build | Keeps compilers, headers and dev dependencies out of the shipped image | `grep -c '^FROM' Dockerfile` ≥ 2 |
| 4 | Final stage has no package manager and no compiler | Removes the attacker's toolchain after an RCE (NIST SP 800-190 §4.1) | `docker run --rm --entrypoint sh <IMAGE> -c 'command -v apt-get apk yum dnf npm pip gcc'` finds nothing, or the image has no shell at all |
| 5 | Base pinned by `sha256:` digest | A tag is mutable: what you tested and what you shipped can differ | `grep -E '^FROM .*@sha256:' Dockerfile` |
| 6 | A scheduled job refreshes those digests and opens a PR | Pinning without refreshing ships stale vulnerable layers forever | the workflow file exists and has run |
| 7 | Layer order: manifests → install → source | Otherwise every source edit reinstalls every dependency | inspect the Dockerfile; compare warm build times |
| 8 | Cleanup happens inside the same `RUN` that created the files | Deleting in a later layer does not shrink the image | `docker history <IMAGE>` — no layer with a large size followed by a "cleanup" layer |
| 9 | `apt-get update` and `install` in one `RUN`, with `--no-install-recommends` and `rm -rf /var/lib/apt/lists/*` | A separately cached index gives "package not found" only on a cold cache | read the Dockerfile |

## Identity and privileges

| # | Check | Why | Verify |
|---|---|---|---|
| 10 | `USER` set to a **numeric** UID:GID, non-zero (CIS 4.1) | `USER app` breaks Kubernetes `runAsNonRoot`: the kubelet cannot resolve names | `docker run --rm --entrypoint id <IMAGE>` shows `uid=<non-zero>` |
| 11 | Listens on a port ≥ 1024 | Avoids needing `CAP_NET_BIND_SERVICE` just to keep port 80 | `grep EXPOSE Dockerfile` |
| 12 | Runs with `--read-only` | An immutable root filesystem removes a whole class of persistence | `docker run --rm --read-only --tmpfs /tmp <IMAGE>` |
| 13 | Runs with `--cap-drop=ALL` | Default capability set is far wider than any application needs (CIS 5.3) | `docker run --rm --cap-drop=ALL <IMAGE>` |
| 14 | No `--privileged`, no docker socket mount anywhere in compose or manifests | Socket access is root on the host (NIST SP 800-190 §3.3) | `grep -rn 'privileged\|/var/run/docker.sock' compose*.y*ml k8s/` |
| 15 | `no-new-privileges` set by the orchestrator | Blocks setuid escalation inside the container (CIS 5.25) | orchestrator config, not the image |

## Process behaviour

| # | Check | Why | Verify |
|---|---|---|---|
| 16 | `ENTRYPOINT`/`CMD` in **exec form** (JSON array) | Shell form makes `/bin/sh` PID 1; `SIGTERM` never reaches the app and every redeploy drops in-flight requests | `docker inspect -f '{{json .Config.Entrypoint}}' <IMAGE>` is an array |
| 17 | The container stops well inside the grace period | Proves signal handling and graceful drain actually work | `docker run -d --name t <IMAGE> && time docker stop t` — under the 10 s default |
| 18 | An init process only if the app genuinely spawns children that need reaping | `--init`/`tini` adds a hop; adding it "just in case" hides the real problem | inspect the process tree: `docker top <CONTAINER>` |
| 19 | Logs go to stdout/stderr, unbuffered | Buffered logs vanish exactly when the process is killed | `docker logs <CONTAINER>` shows output during a run, not only at exit |

## Secrets

| # | Check | Why | Verify |
|---|---|---|---|
| 20 | No secret in `ARG` or `ENV` | Both are readable via `docker history` and `docker inspect` by anyone who can pull | `docker history --no-trunc <IMAGE> \| grep -iE 'token\|password\|secret\|key'` |
| 21 | Build-time credentials via `--mount=type=secret` | Never enters a layer | read the Dockerfile |
| 22 | Runtime secrets injected by the platform, not baked in | See `kubernetes-engineer` for workload identity and external secret stores | manifest review |

## Provenance and supply chain

| # | Check | Why | Verify |
|---|---|---|---|
| 23 | OCI labels `source`, `revision`, `licenses` | Ties a scanner finding back to a repository and a commit | `docker inspect -f '{{json .Config.Labels}}' <IMAGE>` |
| 24 | SBOM generated from the **final image** | The source tree does not know what actually got linked in | the SBOM artefact exists and lists OS packages |
| 25 | Provenance attestation attached and **verified** | An unverified attestation is decoration | `gh attestation verify oci://<REGISTRY>/<IMAGE>@sha256:<DIGEST> --repo <OWNER>/<REPO>` |
| 26 | Tags immutable; deployments reference digests | You cannot roll back to a tag that was overwritten | registry setting; `grep -r '@sha256:' k8s/` |

## Vulnerabilities

| # | Check | Why | Verify |
|---|---|---|---|
| 27 | Zero **fixable** CRITICAL and HIGH | Gating on unfixable CVEs trains the team to bypass the gate | `trivy image --severity HIGH,CRITICAL --ignore-unfixed <IMAGE>` |
| 28 | Every suppression has an owner, a reason and an **expiry date** | An ignore entry with no expiry is a permanent hole | inspect the ignore/VEX file |
| 29 | OS findings and application findings triaged separately | OS findings are fixed by rebasing; application findings by the dependency flow | scanner output grouped by type |
| 30 | Published images re-scanned on a schedule | A CVE disclosed after release still affects the running image | the scheduled workflow scans the **deployed digest** |

## Size and speed

| # | Check | Target | Verify |
|---|---|---|---|
| 31 | Final image size recorded and compared to the previous value | any regression explained | `docker image ls --format '{{.Size}}' <IMAGE>` |
| 32 | Warm build | **< 90 s** | time a rebuild after a one-line source change |
| 33 | Cold build | **< 5 min** | `docker builder prune -af` then time it |
| 34 | Multi-arch builds cross-compile rather than emulate | QEMU-emulated toolchains are routinely 5–10× slower | the build stage uses `$BUILDPLATFORM` / `TARGETARCH` |

---

## Not covered here

Runtime enforcement (seccomp and AppArmor profiles, admission control, Falco rules), signing-key
custody and trust-root policy, and cluster-level network policy. Those are platform decisions;
the image only has to be compatible with them.
