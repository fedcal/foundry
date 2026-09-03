# Maintainers

Roles and rules: [GOVERNANCE.md](GOVERNANCE.md).

## Active

| Name | Handle | Areas (paths) | Affiliation | Since |
|---|---|---|---|---|
| {{M1_NAME}} | @{{M1_HANDLE}} | {{M1_AREAS}} | {{M1_AFFILIATION}} | {{M1_SINCE}} |

Affiliation is declared when the employer has a stake in the project; `independent` otherwise.

## Emeritus

| Name | Handle | Active | Return path |
|---|---|---|---|
| {{E1_NAME}} | @{{E1_HANDLE}} | {{E1_PERIOD}} | Ask any active maintainer; no re-nomination needed within 12 months |

Emeritus is the default after {{INACTIVITY_MONTHS}} months without reviews, merges or votes.
It is not a judgement.

## Credentials

| Asset | Holders | Recovery tested |
|---|---|---|
| Release signing key | {{KEY_HOLDERS}} | {{KEY_DRILL_DATE}} |
| {{REGISTRY}} package owners | {{REGISTRY_OWNERS}} | {{REGISTRY_VERIFIED_DATE}} |
| Domain / docs hosting | {{DOMAIN_HOLDERS}} | {{DOMAIN_DRILL_DATE}} |

## Offboarding checklist

- [ ] `gh api -X DELETE repos/{{REPO}}/collaborators/{{HANDLE}}`
- [ ] Remove from `.github/CODEOWNERS` and from the table above
- [ ] Remove from package registry owners
- [ ] Remove from security advisory collaborators
- [ ] Rotate any shared CI secret they could read
- [ ] Reassign owned paths to a named person
