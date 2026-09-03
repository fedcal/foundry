# Terraform / OpenTofu layout

How to lay out infrastructure code so that a wrong apply is bounded, a plan is readable, and a new
environment is thirty lines rather than a copied directory.

---

## 1. Layers

One state per environment per layer. The split follows **change frequency and blast radius**, not
resource type:

| Layer | Contains | Changes | If a bad apply lands |
|---|---|---|---|
| `network/` | VPC/VNet, subnets, routing, NAT, DNS zones, peering | twice a year | everything breaks, nothing is lost |
| `data/` | databases, object storage, KMS keys, backups | rarely | **data loss** — the layer to be most careful with |
| `platform/` | cluster, registry, CI identity, secret containers, observability | monthly | deploys break, workloads keep running |
| `apps/` | per-service resources: queues, buckets, service identities | weekly | one service affected |

Why it matters beyond blast radius: **plan time**. A single state with 800 resources takes minutes
to refresh, so people stop reading the plan — and a plan nobody reads is not a control.
Target **< 3 minutes per layer**.

Dependencies point one way only: `apps` → `platform` → `data` → `network`. Never the reverse.

Cross-layer references:

```hcl
# preferred: look the resource up by a stable, deliberate identifier
data "<PROVIDER>_<RESOURCE>" "vpc" {
  tags = { Name = "<ENV>-main" }
}

# acceptable, but it couples the layers and requires read access to the other state
data "terraform_remote_state" "network" {
  backend = "<BACKEND>"
  config  = { <BACKEND-CONFIG> }
}
```

Use `terraform_remote_state` sparingly, and never in the direction of higher-churn →
lower-churn: `apps` reading `network` is acceptable; `network` reading `apps` is a design error.

---

## 2. Directory shape

```
infra/
  modules/
    <name>/
      main.tf
      variables.tf         # typed, described, no `any`
      outputs.tf           # this is your API
      versions.tf          # required_version + required_providers
      README.md            # inputs, outputs, one usage example
  envs/
    <env>/
      network/
        main.tf            # ~30 lines of module calls
        variables.tf
        versions.tf
        backend.tf
        <env>.backend.hcl
        terraform.tfvars
        .terraform.lock.hcl   # COMMITTED
      data/
      platform/
      apps/
```

A root module is thin by design: it wires pinned modules to this environment's inputs, and nothing
else. If a root module contains resource blocks, ask whether that resource belongs in a module.

---

## 3. Module boundaries

A module is a **unit of lifecycle and blast radius**, not a unit of tidiness.

**Wrap when the module encodes a decision.** "Our buckets are always versioned, encrypted with our
CMK, logging to the audit bucket, with public access blocked" is a decision worth a module.

**Do not wrap a single resource.** `module "s3_bucket"` rendering one bucket adds a version, a
variable-passing layer and an upgrade obligation in exchange for nothing.

Interface rules:

```hcl
variable "database" {
  description = "Database sizing and retention for this environment."
  type = object({
    instance_class        = string
    allocated_storage_gb  = number
    multi_az              = bool
    backup_retention_days = number
  })
  # No default for anything that must differ between environments: a default is
  # how staging's value silently becomes production's.
}
```

- Typed inputs (`object({...})`), never `any`. `any` moves every error from plan time to apply
  time, which is exactly the wrong direction.
- Every variable has a `description`. It is what the module README is generated from.
- Outputs are your API: adding one is cheap, removing one is a breaking change.
- **No `provider` blocks inside reusable modules.** A provider block makes the module impossible
  to use twice with different credentials, and blocks its removal from state. Configure providers
  in the root module and pass them with `providers = {}` when needed.
- Depth: root → shared module → primitive. Three levels maximum before plans become unreadable.

---

## 4. Versioning

A module referenced from a branch is not a dependency, it is a time bomb: a merge to that branch
changes every consumer's next plan.

```hcl
# git source - pin to an immutable tag
module "network" {
  source = "git::https://<HOST>/<ORG>/<REPO>.git//modules/network?ref=<TAG>"
}

# registry source - constrain so a major cannot arrive silently
module "database" {
  source  = "<NAMESPACE>/<NAME>/<PROVIDER>"
  version = "~> <MAJOR>.<MINOR>"
}
```

Resolve tags; never write a version from memory:

```bash
git ls-remote --tags <REPO-URL> | sed 's:.*/::' | sort -V | tail -5
```

Providers:

```hcl
terraform {
  required_version = ">= <MIN-VERSION>"      # read from `terraform version`
  required_providers {
    <NAME> = {
      source  = "<REGISTRY-NAMESPACE>/<NAME>"
      version = "~> <MAJOR>.<MINOR>"
    }
  }
}
```

Commit `.terraform.lock.hcl` and generate it for **every** platform anyone builds on, or CI and
laptops disagree:

```bash
terraform providers lock \
  -platform=linux_amd64 -platform=darwin_arm64 -platform=darwin_amd64
```

Audit for unpinned sources:

```bash
grep -rn 'source\s*=' --include='*.tf' . | grep -vE 'version|\?ref='
```

---

## 5. Environment separation — three patterns

### A. Root module per environment (recommended)

```
envs/prod/data/main.tf      # module "database" { source = "...?ref=<TAG>"  database = {...} }
envs/staging/data/main.tf   # same modules, staging's inputs
```

**Pros.** Explicit and greppable. Production may legitimately differ (multi-AZ, deletion
protection, longer retention) without conditionals. Each environment can adopt a new module
version independently — which is how you test an upgrade in staging first.
**Cons.** ~30 lines of duplication per layer per environment. Acceptable; that duplication is the
part you *want* to be able to read.

### B. Single root module, per-environment tfvars and backend config

```bash
terraform init  -backend-config=envs/<ENV>.backend.hcl -reconfigure
terraform plan  -var-file=envs/<ENV>.tfvars -out=tfplan
```

**Pros.** No duplication.
**Cons.** Every environment is forced into the same shape; "production only" resources need
`count = var.is_prod ? 1 : 0` conditionals that make plans hard to read; and `-reconfigure` against
the wrong backend config is a genuinely dangerous mistake with no guard rail.

### C. A wrapper tool generating A from a hierarchy of inputs

**Pros.** Removes the boilerplate of A.
**Cons.** A dependency, and an extra layer of indirection in every stack trace and every error
message.

### Not a pattern: CLI workspaces for prod vs non-prod

They share one backend, one credential set and one code path. The only thing between you and
production is which workspace happens to be selected in your shell, and `terraform workspace
select` does not prompt. Workspaces are fine for **ephemeral, identical** copies — per-PR review
environments — where a mistake is cheap and the lifetime is hours.

The strongest separation is not in Terraform at all: **separate cloud accounts / subscriptions /
projects**, so a misconfigured provider cannot reach production.

---

## 6. Copy-paste detector

```bash
diff envs/staging/<layer>/main.tf envs/prod/<layer>/main.tf
```

Every difference must be a deliberate policy difference: sizing, availability, retention,
deletion protection. Anything else means the module boundary is wrong — extract it.

Conversely, if the diff is **empty**, ask whether the environments differ enough to be a useful
test of each other. A staging environment identical to production in every way except data is
expensive; a staging environment that shares nothing with production tests nothing. Write down
which differences are intentional and why.

---

## 7. Lifecycle guards

```hcl
resource "<TYPE>" "<NAME>" {
  # ...
  lifecycle {
    # apply FAILS rather than deleting. Use on every stateful resource whose
    # loss would be an incident. Note: it also blocks a legitimate destroy, so
    # removing it is a reviewed, deliberate commit.
    prevent_destroy = true

    # attributes owned by something else: an autoscaler adjusting desired
    # capacity, a controller managing a load balancer. Always comment WHO owns it.
    ignore_changes = [<ATTRIBUTE>]   # owned by <CONTROLLER>

    # for resources with a name-uniqueness constraint. REQUIRES name_prefix or a
    # random suffix, otherwise the create half fails on a name conflict and you
    # get the worst of both orderings.
    create_before_destroy = true
  }
}
```

---

## 8. Naming and tagging

Consistent naming is what makes a console usable during an incident:
`<org>-<env>-<layer>-<resource>-<suffix>`.

Mandatory tags on everything that supports them — enforced by policy, not by hope:

```hcl
locals {
  common_tags = {
    environment         = var.environment
    owner               = var.owner_team          # who to wake up
    cost_center         = var.cost_center         # makes cost allocation possible
    data_classification = var.data_classification # drives encryption and access review
    managed_by          = "terraform"
    repository          = var.repository_url      # where the code is
  }
}
```

`managed_by` and `repository` are the two that save the most time later: they answer "may I delete
this?" and "where do I change it?" without archaeology.
