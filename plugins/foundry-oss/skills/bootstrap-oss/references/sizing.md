# Governance sizing bands

Same bands as the `governance-architect` agent. Assign the **highest band whose entry
conditions all hold**, measured over the last 12 months.

## Bands

| Band | Entry conditions | Decision model | Document weight |
|---|---|---|---|
| **B0 Solo** | 1 person with push access; < 25 contributors; single employer | Benevolent dictator | GOVERNANCE not needed; one paragraph in CONTRIBUTING |
| **B1 Small team** | 2–4 push access; 25–150 contributors; ≥ 1 recurring external contributor | Maintainer group, lazy consensus | GOVERNANCE ≈ 1 page |
| **B2 Multi-party** | ≥ 5 push access **or** ≥ 2 employers among maintainers; project is a dependency of other projects | Council with written voting rules | GOVERNANCE ≈ 2 pages + RFC process |
| **B3 Institutional** | Trademark to protect, ≥ 3 employers with commercial stake, or foundation donation in progress | Chartered body, elections | Charter, terms, neutral IP holder |

## Rules

1. **One band of headroom, maximum**, and only with a dated trigger written into the document
   ("adopt B2 when a second employer holds push access").
2. **Downgrade is legitimate.** A B2 charter on a project with one remaining maintainer is
   fiction; replace it with B1 plus a succession clause.
3. **Ceremony is a cost.** Every extra rule is something a newcomer must read and a maintainer
   must enforce. If nobody will enforce it, do not write it.
4. Band is recomputed at each review date, from the same commands.

## What each band ships

| File | B0 | B1 | B2 | B3 |
|---|:--:|:--:|:--:|:--:|
| `CONTRIBUTING.md` | yes | yes | yes | yes |
| `CODE_OF_CONDUCT.md` | yes | yes | yes | yes |
| `SECURITY.md` | yes | yes | yes | yes |
| `SUPPORT.md` | yes | yes | yes | yes |
| `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md` | yes | yes | yes | yes |
| `GOVERNANCE.md` | no | yes | yes | yes |
| `MAINTAINERS.md` | no | yes | yes | yes |
| `.github/CODEOWNERS` | no | yes | yes | yes |
| Voting rules, quorum, tie-break | no | minimal | yes | yes |
| RFC process | no | threshold only | full lifecycle | full lifecycle |
| Emeritus / offboarding policy | no | yes | yes | yes |
| Elections, terms, charter | no | no | no | yes |
| `FUNDING.yml` | only if funding actually exists | | | |

## Anti-patterns

- **Charter cosplay** — a solo project with a TSC. Nobody can contribute to a committee of one.
- **Governance as recruitment** — writing a council structure hoping maintainers appear. They
  do not; see `community-manager`.
- **Copy from a large project** — Kubernetes-shaped governance on a 400-line library imports
  every cost and none of the scale that justified it.
- **Unowned rules** — any rule with no named enforcer is decoration; delete it.
