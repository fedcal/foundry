# Policy as code and the auto-apply gate

Policy runs against the **plan**, in CI, as a required check, **before** apply. A policy that runs
after apply is a report, not a control.

---

## The pipeline

```bash
# 1. plan to a file - this artefact is what gets reviewed AND what gets applied
terraform plan -out=tfplan -lock-timeout=<DURATION> -input=false

# 2. machine-readable form
terraform show -json tfplan > tfplan.json

# 3. policy
conftest test tfplan.json --policy policy/          # your own rules
trivy config .                                      # known-bad baseline patterns

# 4. the auto-apply gate
DANGEROUS=$(jq '[.resource_changes[] | select(.change.actions | index("delete"))] | length' tfplan.json)
test "$DANGEROUS" -eq 0 || { echo "HUMAN REVIEW REQUIRED: $DANGEROUS destroy/replace"; exit 1; }

# 5. apply the SAVED plan
terraform apply tfplan
```

**Never re-plan at apply time.** Between plan and apply, someone else's merge or a drifted
resource changes the outcome, and the reviewed change becomes an unreviewed one. Carry `tfplan` as
a CI artefact from the plan job to the apply job and fail if it is stale.

Use a baseline scanner **and** hand-written policies. They cover different things: the scanner
knows common misconfigurations, your policies know your rules.

---

## Reading a plan

```bash
# everything being destroyed or replaced, with the action
jq -r '.resource_changes[] | select(.change.actions | index("delete"))
       | "\(.change.actions|join("+"))\t\(.address)"' tfplan.json

# WHY a resource is being replaced - the attribute that forces it
jq -r '.resource_changes[] | select(.change.replace_paths != null)
       | "\(.address)\treplaced by: \(.change.replace_paths|flatten|join(","))"' tfplan.json

# summary by action
jq -r '[.resource_changes[].change.actions|join("+")] | group_by(.)
       | map({action: .[0], count: length})' tfplan.json
```

If you cannot explain a replacement, do not apply it.

---

## Starter rule set

Write these on day one. Each is expressed against `tfplan.json`.

| Rule | Why | Severity |
|---|---|---|
| Deny `delete`/`replace` on resources tagged `lifecycle: protected` | Stateful loss is unrecoverable from code | block |
| Deny any security group / NSG / firewall rule with source `0.0.0.0/0` except on an explicit port allowlist | The most common route to a public incident | block |
| Deny unencrypted storage, or storage encrypted with a key other than the expected one | Data at rest, and provable key custody | block |
| Deny public object access, public snapshots, public machine images | Silent data exposure | block |
| Deny IAM statements with `Action: "*"` and `Resource: "*"` | Privilege escalation path | block |
| Deny a public IP on a resource in a private subnet/tier | Bypasses the network design entirely | block |
| Require the mandatory tag set (owner, environment, cost-centre, data-classification) | Without it, cost allocation and access review are impossible later | block |
| Deny unpinned module or provider sources | A branch reference changes every consumer's next plan | block |
| Deny disabling audit/flow logs | Removes the evidence you need during an incident | block |
| Warn on any resource without `prevent_destroy` in the `data/` layer | Prompts a deliberate decision | warn |
| Warn on a plan exceeding `<N>` changed resources | A very large plan is rarely reviewed properly | warn |

---

## Exception path

Every policy needs one, or the first time it blocks an incident fix, someone disables the whole
rule set and it never comes back.

```hcl
# policy-exception: <RULE-ID>
# reason:  <why this specific resource is exempt>
# owner:   <who>
# expires: <YYYY-MM-DD>
resource "<TYPE>" "<NAME>" { ... }
```

- Exceptions are reviewed like any other change.
- A separate CI check fails when an exception passes its `expires` date. Without expiry
  enforcement, exceptions accumulate silently and the policy becomes decorative.
- Track the count of live exceptions as a metric. A rising number means the policy no longer
  matches reality — fix one or the other, deliberately.

---

## Auto-apply: the only safe lane

Auto-apply is acceptable **only** when all of these hold:

- the plan's action set is exactly `create` and/or `update` — **zero `delete`, zero `replace`**;
- policy checks pass with no exception invoked;
- the layer is not `data/`;
- the change is on the default branch, applied through the environment-gated lane.

Everything else needs a human, a window, and a stated recovery plan. See the dangerous-operations
table in the `iac-engineer` agent.

---

## Drift detection

```bash
terraform plan -detailed-exitcode -lock-timeout=<DURATION> -input=false
# exit 0 = no changes, 1 = error, 2 = drift/changes present
```

Scheduled per layer, on the default branch. **Alert on exit code 2; never auto-apply.**
Auto-reverting drift can undo an emergency fix that is currently keeping production alive.

Triage by cause:

| Cause | Response |
|---|---|
| A human changed something in the console | Find out why. Either reconcile into code, or revert deliberately — after asking |
| A cloud-side default changed | Pin the value explicitly, or `ignore_changes` with a comment naming the reason |
| Another controller owns the attribute (autoscaler, load-balancer controller) | `ignore_changes` on that attribute is the correct permanent answer |

Track drift frequency as a metric. Rising drift means the pipeline is too slow or too restrictive
and people are routing around it. Fix that, not the symptom.
