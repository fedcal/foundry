---
title: foundry-ops
description: GitHub Actions pipelines, containers, Kubernetes, Terraform/OpenTofu, cloud and PaaS targets, release engineering.
sidebar:
  order: 5
---

`foundry-ops` covers everything between a merged commit and a running system: the pipeline, the
image, the cluster, the infrastructure code, the deployment target and the release train.

Three of its six agents declare `isolation: worktree`, because they write files while other agents
may also be writing files.

## Install

```bash
/plugin install foundry-ops@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- The repository has no CI, or PR feedback is slow enough that people stop reading it.
- The workflow uses long-lived cloud secrets or unpinned third-party actions.
- Images are large, slow to build, or a scanner reports vulnerabilities and nobody knows which
  ones matter.
- Pods are OOMKilled or CPU-throttled, or probes cause restart storms and 502s during deploys.
- Infrastructure code has grown by copy-paste across environments and drifts silently.

## When not to use it

- Do not install it to "get Kubernetes". `cloud-architect` exists partly to argue you out of
  Kubernetes when a PaaS target is sufficient; installing this plugin does not commit you to a
  cluster.
- It does not decide application architecture — that is `foundry-dev`.
- It does not set SLOs or design alerting. `sre-planner` and `observability-engineer` in
  `foundry-quality` do.

## Agents

| Agent | What it does | Model | Effort | Isolation |
|---|---|---|---|---|
| `pipeline-engineer` | Designs, hardens and speeds up GitHub Actions pipelines: caching, job graph, pinned actions, OIDC instead of long-lived secrets. | `sonnet` | `medium` | `worktree` |
| `container-engineer` | Writes and hardens container images: multi-stage builds, size and build time, scanner findings triaged by what is actually reachable. | `sonnet` | `medium` | `worktree` |
| `kubernetes-engineer` | Workload design and rollout strategy: sizing requests and limits, diagnosing OOMKills and CPU throttling, probes that do not cause restart storms. | `opus` | `high` | `worktree` |
| `iac-engineer` | Terraform and OpenTofu at scale: module boundaries, remote state and locking, environment separation without copy-paste, drift detection, plan review discipline. | `opus` | `high` | `worktree` |
| `cloud-architect` | Chooses the deployment target and its boundaries across AWS, Azure, GCP and PaaS (Vercel, Netlify, Fly.io, Render, Railway). | `opus` | `high` | — |
| `release-engineer` | Runs release trains: SemVer decisions, conventional-commit changelogs, tagging, promoting one artefact across environments by digest, feature flags to decouple deploy from release. | `sonnet` | `medium` | — |

## Skills

| Skill | When it fires |
|---|---|
| `scaffold-pipeline` | A repository needs a complete hardened GitHub Actions pipeline for the project type detected in it — Node/Angular, Maven or Gradle, or a containerised service. |
| `containerise` | A hardened multi-stage Dockerfile plus a compose file for local development, matched to the stack detected in the repository. |
| `deploy-strategy` | Choosing between rolling update, blue-green and canary, sizing its parameters from measurements, and writing the rollback procedure as a runbook. |
| `provision-environment` | Creating or extending Terraform/OpenTofu for a new environment, with remote state and locking, secrets handling and least-privilege identity for CI and workloads. |
| `release` | Running a release end to end — derive the version from the commit range and an API diff, generate the changelog, tag, publish and promote artefacts by digest, write release notes. |

All five accept `--dry-run`, `--plan-only` or an equivalent, so the generated output can be
inspected before anything is written or promoted.

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `pipeline-engineer` | `requirement.v1` | `plan.v1` |
| `container-engineer` | `requirement.v1` | `review.v1` |
| `kubernetes-engineer` | `plan.v1` | `adr.v1` |
| `iac-engineer` | `plan.v1` | `risk.v1` |
| `cloud-architect` | `requirement.v1` | `adr.v1` |
| `release-engineer` | `plan.v1` | `handoff.v1` |

`deploy-strategy` also writes a rollback runbook to `.foundry/runbooks/`, which means the next
incident starts from a procedure rather than from memory.

## Interaction with the guard hooks

`foundry-core` protects `.github/workflows/**` and `**/*.lock` by default: a write there triggers
a `PreToolUse` escalation asking you to confirm. That is intentional — `scaffold-pipeline` changing
your CI should be a decision, not a side effect. See [Hooks](/foundry/en/reference/hooks/) for how
to adjust `protectedPaths`.

## Limits

- Pipeline scaffolding targets **GitHub Actions**. Other CI systems are not generated.
- Infrastructure code targets Terraform and OpenTofu. CloudFormation, Pulumi and CDK are not.
- These agents write configuration; they do not hold your cloud credentials and do not apply
  anything. `terraform apply`, `kubectl apply` and `docker push` remain yours to run.
