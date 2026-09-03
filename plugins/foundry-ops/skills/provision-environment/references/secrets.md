# Secrets in infrastructure code

One fact drives everything here: **Terraform state stores every attribute in plaintext**,
including generated passwords, private keys and anything a resource returns. A secret that
Terraform knows is a secret that lives, unencrypted-at-the-value-level, in the state file, in
every state version, and in every local copy anyone ever pulled.

---

## The rules

### 1. No secret values in `.tf` or `.tfvars`. Ever.

They end up in git — permanently, because history is forever — and in state.

```bash
# sweep before you finish
grep -rniE 'password|secret|token|api_key|private_key|connection_string' \
  --include='*.tf' --include='*.tfvars' . | grep -v 'variable\|description\|#'

# and check history, which is where they actually hide
git log --all -p --pickaxe-regex -S'(password|secret|api_key)\s*=' -- '*.tf' '*.tfvars' | head -50
```

Anything found is **rotated at the provider first**, then removed from the code. Removing it from
git without rotating leaves the credential valid and merely harder to find.

### 2. Terraform creates the container, not the value.

```hcl
# Terraform owns the secret's existence, its access policy and its rotation
# configuration. It never owns the VALUE.
resource "<PROVIDER>_secret" "db_password" {
  name = "<ENV>/<SERVICE>/db-password"
  tags = local.common_tags

  lifecycle {
    # The value is set out of band. Without this, every plan shows a diff and
    # every apply overwrites the real password with an empty placeholder.
    ignore_changes = [<VALUE-ATTRIBUTE>]
  }
}
```

The value is placed by a human with a hardware-backed credential, or by a separate rotation
pipeline. Terraform never reads it back — a `data` source that reads a secret writes it into
state, which is exactly what you were avoiding.

### 3. Prefer provider-generated over Terraform-generated.

`random_password` writes the generated value into state in plaintext. Where the provider can
generate and manage a credential itself (managed database password rotation, managed identities,
service-linked credentials), use that: the value is never in your state at all.

When there is genuinely no alternative, treat the state as a secret store — which it already was —
and make sure §5 holds.

### 4. Applications read secrets at runtime, via workload identity.

Not through environment variables baked in at deploy time: those are visible in the pod spec to
anyone with `get pod`, in the task definition, in the container config, and frequently in crash
dumps and error reports.

- Kubernetes: External Secrets Operator or the Secrets Store CSI driver, pulling from the cloud
  secret manager with the workload's own identity.
- Serverless/PaaS: the platform's secret binding, again with the runtime's own identity.
- The application should tolerate the secret changing under it — see §6.

Kubernetes `Secret` objects are **base64, not encryption**. Anyone with `get secret` in the
namespace, and anyone who can read etcd, reads them. Minimum bar: encryption at rest enabled on
the API server, narrow RBAC, and no Secret manifests in git.

### 5. Protect the state as the secret store it is.

Covered in `backend-bootstrap.tf`: customer-managed encryption key, TLS enforced, versioning,
access restricted to the CI identity and a break-glass role, access logging, and a retention limit
on old versions — each old version is another copy of your secrets.

Never `terraform state pull` to a shared or synced directory. When you must, write to
`.foundry/scratch/<session>/` and delete it when finished.

### 6. Design rotation on day one.

Rotation retrofitted is rotation never done. Decide and write down:

- **Mechanism** — provider-managed rotation, a scheduled job, or manual with a checklist.
- **Cadence** — and what triggers an off-cycle rotation (someone leaves, a laptop is lost, a log
  leaked).
- **Blast radius during rotation** — this is the part teams miss. A database password rotated in
  one step breaks every connection that has not reconnected. Use two-secret rotation: the provider
  supports two valid credentials, you promote the new one, wait for all consumers to pick it up,
  then retire the old one.
- **How you verify** it worked, and how you roll back if it did not.

Rehearse it once in a lower environment. An unrehearsed rotation procedure is discovered to be
wrong at the worst possible moment.

---

## Where secrets are allowed to exist

| Location | Allowed | Notes |
|---|---|---|
| Cloud secret manager | Yes | The destination. Encrypted, audited, access-controlled, rotatable |
| Terraform state | Unavoidable for some resources | Which is why §5 is mandatory |
| CI secrets store | Only for values with no federated alternative | Everything else uses OIDC. Scope to an environment, never repository-wide |
| `.tf` / `.tfvars` | **No** | |
| Git, anywhere, including history | **No** | If it was ever there, it is compromised |
| Container image layers / `ARG` | **No** | Visible via `docker history` to anyone who can pull |
| Kubernetes Secret committed to git | **No** | Base64 is not encryption |
| Environment variables in a manifest | Discouraged | Visible to anyone with `get pod`; prefer a mounted, runtime-fetched secret |
| Terminal history, CI logs | **No** | Use `-input=false` and never echo a secret in a `run:` step |

---

## What to do when a secret leaks

Order matters. Doing these out of order wastes the only time that counts.

1. **Rotate at the provider.** Immediately. The old value must stop working. Nothing else reduces
   exposure.
2. **Revoke active sessions** issued with the old credential — rotation alone does not always
   invalidate them.
3. **Audit usage** of the old credential: when, from where, by whom. This is what tells you
   whether it was a near-miss or an incident.
4. **Remove it from the code**, and only then consider history. Rewriting git history is
   disruptive, requires coordination with every collaborator, and does **not** help if the
   repository was ever cloned or public — assume the value is public.
5. **Find the class, not just the instance.** Sweep for the same pattern everywhere:

```bash
grep -rniE '(password|secret|api_key|token)\s*[:=]' --include='*.tf' --include='*.tfvars' \
  --include='*.yaml' --include='*.yml' --include='*.env' . | head -50
```

6. **Add the detection** that would have caught it: a secret-scanning step in CI and a pre-commit
   hook. A leak that produces no new control will happen again.
7. **Record it** as a `risk.v1` with the mitigation and an owner, and update the runbook.

---

## Verification checklist

- [ ] No secret-shaped strings in `.tf` or `.tfvars`, and none in git history.
- [ ] Secret containers created by Terraform; values placed out of band with `ignore_changes`.
- [ ] No `data` source reading a secret value into state where it can be avoided.
- [ ] State backend encrypted with a customer-managed key, versioned, logged, access-restricted.
- [ ] Applications fetch secrets at runtime with their own workload identity.
- [ ] Zero long-lived cloud credentials in CI (`gh secret list` shows nothing key-shaped).
- [ ] Rotation mechanism, cadence and two-secret procedure documented and rehearsed once.
- [ ] Secret scanning runs in CI and blocks the merge.
