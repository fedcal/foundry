---
title: "Rollback: <SERVICE>"
trigger: "rollback <SERVICE>, <SERVICE> deploy failed, <SERVICE> error rate spike, bad release <SERVICE>"
owner: "<TEAM-OR-PERSON>"
last_rehearsed: "<YYYY-MM-DD>"
measured_duration: "<MINUTES> min"
strategy: "<rolling|blue-green|canary>"
---

# Rollback: <SERVICE>

> Copy to `.foundry/runbooks/rollback-<service>.md`. **Fill in every placeholder.**
> A runbook with an unfilled `<PLACEHOLDER>` is worse than no runbook: it is read
> during an incident, by someone tired, who will not stop to work out what you meant.
> Keep the `title` and `trigger` frontmatter — Foundry's prompt hook matches on `trigger`.

## 1. When to run this

| Signal | Threshold | Where to look |
|---|---|---|
| Error rate | above `<THRESHOLD>` for `<DURATION>` | `<DASHBOARD-URL>` |
| p95 latency | above `<THRESHOLD>` for `<DURATION>` | `<DASHBOARD-URL>` |
| `<BUSINESS-SIGNAL>` | below `<FLOOR>` | `<DASHBOARD-URL>` |
| Rollout status | not `Complete` after `<PROGRESS-DEADLINE>` | `kubectl -n <NS> rollout status deploy/<NAME>` |

**Decision rule.** If any threshold is breached, roll back **first** and diagnose afterwards.
Do not debug in front of users. Authority to trigger: `<ROLE>` — this does not need an
escalation, and waiting for one is itself a failure mode.

## 2. Is rollback possible for THIS release?

Check before starting. Answer recorded in the release notes for `<VERSION>`:

- [ ] No destructive migration in this release (no dropped column/table, no non-additive change).
- [ ] No irreversible external side effect (payments taken, emails sent, webhooks delivered).
- [ ] No one-way event consumed that the previous version cannot handle.
- [ ] The previous artefact digest is known and still present in the registry.

If any box is unticked, **this release is forward-only.** Skip to §6.

## 3. Pre-flight — 30 seconds, do not skip

```bash
# what is running now (this is your "back out of the back out" value)
kubectl -n <NS> get deploy/<NAME> -o jsonpath='{.spec.template.spec.containers[0].image}'; echo

# what you are going back to
kubectl -n <NS> rollout history deploy/<NAME>
kubectl -n <NS> rollout history deploy/<NAME> --revision=<TARGET-REVISION>
```

Record both values in the incident channel **before** touching anything.

## 4. Execute

### Strategy: rolling update

```bash
kubectl -n <NS> rollout undo deploy/<NAME> --to-revision=<TARGET-REVISION>
kubectl -n <NS> rollout status deploy/<NAME> --timeout=<SECONDS>s
```

### Strategy: blue-green

```bash
kubectl -n <NS> patch svc <NAME> \
  -p '{"spec":{"selector":{"app":"<NAME>","slot":"<PREVIOUS-SLOT>"}}}'
kubectl -n <NS> get svc <NAME> -o jsonpath='{.spec.selector}'; echo
```

### Strategy: canary

```bash
kubectl argo rollouts abort <NAME> -n <NS>
kubectl argo rollouts get rollout <NAME> -n <NS> -o json | jq '.status.canary'   # verify the weight
```

### Under GitOps — the above is temporary

The controller reverts imperative changes on the next sync. Use them only to buy minutes, then:

```bash
git revert <DEPLOY-COMMIT-SHA> && git push
# then force a sync instead of waiting for the interval
<SYNC-COMMAND>
```

Measured GitOps rollback duration: **`<MINUTES>` min** (sync interval `<INTERVAL>` + reconcile).

### Fastest option when the change is behind a flag

If the behaviour is behind a feature flag, **turn the flag off first**: seconds instead of
minutes, and it does not disturb anything else that shipped in the same release.

```bash
<FLAG-KILL-COMMAND>
```

## 5. Verify

```bash
kubectl -n <NS> get pods -l app=<NAME> -o wide
kubectl -n <NS> get deploy/<NAME> -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
curl -fsS <SMOKE-URL> && echo "smoke ok"
```

- [ ] Running digest equals the intended previous digest.
- [ ] Error rate back inside `<THRESHOLD>` — confirmed on `<DASHBOARD-URL>`, not assumed.
- [ ] p95 latency back inside `<THRESHOLD>`.
- [ ] `<BUSINESS-SIGNAL>` recovering.
- [ ] No pods in `CrashLoopBackOff`.

Watch for a further `<OBSERVATION-WINDOW>` before declaring it done.

## 6. What this rollback does NOT undo

| Not undone | Consequence | Action |
|---|---|---|
| Database migrations applied by `<VERSION>` | Old code runs against the new schema | Safe **only** if expand/contract was followed. If not: `<RESTORE-PROCEDURE>` |
| ConfigMap / Secret changes | Old image, new config — untested combination | `<CONFIG-REVERT-COMMAND>` |
| Consumed messages from `<QUEUE-OR-TOPIC>` | Already acknowledged | `<REPLAY-PROCEDURE>` |
| External side effects: `<LIST>` | Already left the system | `<COMPENSATION-PROCEDURE>` |
| CDN / cache content populated by `<VERSION>` | Users still served bad content | `<INVALIDATION-COMMAND>` |

**Forward-only releases.** If §2 said forward-only, there is no rollback. The path is:
disable via `<FLAG-KILL-COMMAND>`, then ship the fix-forward patch from `<BRANCH>`.
Expected time to a patched release: `<MINUTES>` min.

## 7. Communicate

- Incident channel: `<CHANNEL>` — post the rollback start, the target digest, and the outcome.
- Status page: `<URL>` — update if customer impact exceeded `<THRESHOLD>`.
- Downstream service owners: `<LIST>` — a rollback can break consumers that already adopted
  the new behaviour. **In a multi-service release, roll back consumers first, then providers.**

## 8. After

- [ ] Incident recorded at `<LOCATION>`.
- [ ] Root cause found — use `superpowers:systematic-debugging` if it is installed.
- [ ] The gate that should have caught this identified, and either fixed or documented as
      "deliberately not covered".
- [ ] This runbook updated: new trap, corrected command, revised duration.
- [ ] `last_rehearsed` and `measured_duration` in the frontmatter refreshed.

## 9. Rehearsal log

| Date | Environment | Measured duration | Notes |
|---|---|---|---|
| `<YYYY-MM-DD>` | `<ENV>` | `<MINUTES>` min | `<WHAT-SURPRISED-YOU>` |

Rehearse at least every `<INTERVAL>`. An untimed rollback procedure is a hope, not a plan, and
a procedure that has not been run since the cluster changed is out of date whether or not it
still looks correct.
