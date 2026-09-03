---
title: foundry-oss
description: Open source governance — decision rights, the RFC process, issue triage, semantic versioning, release communication and coordinated disclosure.
sidebar:
  order: 9
---

`foundry-oss` covers the part of an open source project that is not code: who decides, how a
proposal becomes a decision, how an inbox of issues becomes a prioritised action list, how a
version number is derived from the real diff, and how a security report is handled without
improvising.

## Install

```bash
/plugin install foundry-oss@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- A project is going public and has no CONTRIBUTING, CODE_OF_CONDUCT, SECURITY or GOVERNANCE file.
- Nobody can say who decides, or when a change needs an RFC.
- Issues arrive faster than they are triaged and the backlog has stopped being informative.
- Versions are chosen by intent rather than by what actually changed.
- A security report arrives privately and there is no disclosure process.

## When not to use it

- On a closed-source internal project most of this is inapplicable. The `oss-library` profile
  exists for the case where it is not.
- It does not run releases in CI — that is `release-engineer` in `foundry-ops`. This plugin decides
  and communicates the version; ops ships it.
- `triage-inbox`, `version-bump` and `security-advisory` operate against GitHub through `gh`.
  Without an authenticated `gh` they describe the actions instead of applying them.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `governance-architect` | Decides who decides: BDFL versus maintainer council versus consensus, when a change requires an RFC, how maintainers are onboarded and removed, how conflicts are resolved. | `opus` | `high` |
| `community-manager` | Designs and repairs the contributor funnel: genuinely completable good-first-issues, publicly stated response-time expectations, review etiquette, recognition, Code of Conduct practice. | `sonnet` | `medium` |
| `issue-triager` | Triage as a repeatable protocol: reproducibility check, label taxonomy, severity separated from priority, duplicate detection, converting a vague report into something actionable. | `sonnet` | `medium` |
| `release-communicator` | Applies SemVer 2.0.0 to the real diff — including behavioural and performance regressions — writes a changelog for humans from Conventional Commits, and produces upgrade notes. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `bootstrap-oss` | Creating or repairing the governance file set of a repository, at a stated maturity band (`--band B0..B3`). |
| `rfc` | Running the RFC lifecycle for a change above the project's proposal threshold: `new`, `discuss`, `decide`, `record`. |
| `triage-inbox` | Working through open issues and pull requests against the project's own contribution rules, producing a prioritised action list and the exact `gh` commands. |
| `version-bump` | Deciding the next version from the real diff rather than the author's intent, generating a changelog from commit history, and writing migration notes for a breaking change. |
| `security-advisory` | Running coordinated disclosure end to end: `intake`, `score` (CVSS), `plan` (fix and backport), `publish` (GHSA, CVE request, reporter credit). |

`bootstrap-oss` and `triage-inbox` both take `--dry-run`; `triage-inbox` additionally requires an
explicit `--apply` before it changes anything on the repository.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `governance-architect` | `requirement.v1` | `adr.v1` — governance decisions recorded like any other expensive-to-reverse decision |
| `community-manager` | `finding.v1` | `plan.v1` |
| `issue-triager` | `handoff.v1` | `review.v1` |
| `release-communicator` | `review.v1` | `handoff.v1` |

## What it ships

Thirteen governance templates in `templates/`, used by `bootstrap-oss`:

| File | Purpose |
|---|---|
| `README.md` | project README skeleton |
| `CONTRIBUTING.md` | contribution workflow |
| `CODE_OF_CONDUCT.md` | conduct policy |
| `SECURITY.md` | reporting path and supported versions |
| `GOVERNANCE.md` | decision rights and maintainer lifecycle |
| `SUPPORT.md` | where to ask what |
| `MAINTAINERS.md` | who is responsible for what |
| `CODEOWNERS` | review routing |
| `FUNDING.yml` | funding metadata |
| `PULL_REQUEST_TEMPLATE.md` | PR checklist |
| `ISSUE_TEMPLATE/bug_report.yml` | structured bug intake |
| `ISSUE_TEMPLATE/feature_request.yml` | structured proposal intake |
| `ISSUE_TEMPLATE/config.yml` | issue chooser configuration |

`templates/labels.json` provides the label taxonomy that `triage-inbox` and the PMO `github-setup`
skill both apply, so the two plugins do not disagree about what a label means.

## Limits

- GitHub-specific. Issue templates, GHSA advisories, Projects v2 and rulesets have no GitLab or
  Codeberg equivalents here.
- CVSS scoring is a structured judgement, not a lookup. `security-advisory --score` produces a
  vector and a rationale you are expected to review before publication.
- Templates are starting points at a maturity band, not a compliance artefact. A project with
  regulatory obligations should also run `foundry-legal`.
