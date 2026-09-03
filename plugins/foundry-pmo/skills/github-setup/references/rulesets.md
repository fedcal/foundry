# Rulesets and branch protection

Two mechanisms exist. Rulesets are the current one: they compose, target by pattern, support
layered enforcement and bypass actors, and are readable as a single JSON document — which makes
them idempotent by construction, because you `PUT` the whole desired state.

Classic branch protection still works and is what `gh api repos/{o}/{r}/branches/{b}/protection`
manages. Prefer rulesets for new setups; keep classic where it is already in place and working,
and do not run both against the same branch without checking how they interact (the most
restrictive wins, which is rarely what someone expected).

## Baseline ruleset — `.github/rulesets/main.json`

```json
{
  "name": "default-branch-protection",
  "target": "branch",
  "enforcement": "evaluate",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash", "merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "build" },
          { "context": "test" },
          { "context": "lint" }
        ]
      }
    },
    { "type": "required_linear_history" }
  ]
}
```

Apply:

```bash
# list existing
gh api repos/{owner}/{repo}/rulesets --paginate --jq '.[] | {id,name,enforcement}'

# create
gh api repos/{owner}/{repo}/rulesets -X POST --input .github/rulesets/main.json

# update (declarative, therefore idempotent)
gh api repos/{owner}/{repo}/rulesets/<id> -X PUT --input .github/rulesets/main.json

# read back and diff
gh api repos/{owner}/{repo}/rulesets/<id> --jq '{enforcement, rules: [.rules[].type]}'
```

## What each rule buys

| Rule | Prevents |
|---|---|
| `deletion` | accidental deletion of the default branch |
| `non_fast_forward` | force-push rewriting shared history |
| `pull_request` | direct pushes bypassing review |
| `dismiss_stale_reviews_on_push` | approval carried over to code nobody reviewed |
| `require_last_push_approval` | the approver pushing a change and self-merging it |
| `required_review_thread_resolution` | merging with unresolved review conversations |
| `required_status_checks` | merging red |
| `strict_required_status_checks_policy` | merging a PR whose checks passed against a stale base |
| `required_linear_history` | merge-commit tangles that make bisect unreliable |

`required_linear_history` combined with `allowed_merge_methods: ["merge"]` is contradictory —
the merge will always be refused. Pick squash or rebase when linear history is required.

## Enforcement levels

| Level | Behaviour | Use |
|---|---|---|
| `disabled` | ruleset ignored | parked configuration |
| `evaluate` | violations recorded, nothing blocked | **always start here** on a repository with open PRs |
| `active` | violations blocked | after reviewing what `evaluate` would have blocked |

Review the evaluation results in the repository's ruleset insights before promoting. Going
straight to `active` on a busy repository strands every in-flight PR that predates the rule, and
the first reaction is invariably to add a bypass actor — which permanently weakens the control
for a temporary problem.

## Required checks: the trap

A required check name that no workflow produces blocks **every** PR forever, because the check
never reports and the PR waits indefinitely. Always verify names before requiring them:

```bash
DEFAULT=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
gh api repos/{owner}/{repo}/commits/$DEFAULT/check-runs --jq '.check_runs[].name' | sort -u
gh api repos/{owner}/{repo}/commits/$DEFAULT/status --jq '.statuses[].context' | sort -u
```

Names must match exactly, including case and any matrix suffix (`test (20.x)` is a different
context from `test`). When a workflow uses a matrix, either require each leaf context or add a
single aggregating job and require only that — the aggregating job is the more maintainable
choice because the matrix can change without touching the ruleset.

## Bypass actors

Every bypass actor is an audit finding. When one is genuinely required — a release automation
app, a migration window — record it:

```json
"bypass_actors": [
  { "actor_id": 12345, "actor_type": "Integration", "bypass_mode": "always" }
]
```

and write a `fact.v1` of type `decision` naming who approved it, why, and when it will be
reviewed. `bypass_mode: "pull_request"` (bypass only via PR) is weaker than it sounds; prefer
narrowing the actor over broadening the mode.

Never add an individual human as a permanent bypass actor. If a person needs it routinely, the
rule is wrong or the process is.

## Classic branch protection equivalent

```bash
gh api repos/{owner}/{repo}/branches/main/protection -X PUT --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["build", "test", "lint"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

`PUT` replaces the whole document, so it is idempotent in the same way. Note there is no
`evaluate` equivalent: classic protection is immediately enforcing. On a busy repository, apply
it during a quiet window and tell the team first.

Read back:

```bash
gh api repos/{owner}/{repo}/branches/main/protection --jq '{
  checks: .required_status_checks.contexts,
  reviews: .required_pull_request_reviews.required_approving_review_count,
  admins: .enforce_admins.enabled
}'
```

## Failure modes and what they mean

| Response | Meaning | Action |
|---|---|---|
| `403 Resource not accessible by integration` | token lacks repository `admin` | emit the file and the command for an admin; mark `partial` |
| `404` on `/rulesets` | wrong owner/repo, or the repository is not visible to this token | re-check `gh repo view` |
| `422 Upgrade to GitHub Team/Enterprise` | ruleset feature not available on this private repo's plan | fall back to classic protection, report the limitation |
| `422 Invalid rule` | rule type or parameter name wrong for the current API | read back an existing ruleset and mirror its exact shape |
| PRs stuck "Expected — Waiting for status" | a required context is never produced | remove or correct the context name immediately; this blocks everyone |

## CODEOWNERS

`require_code_owner_review: true` is only useful with a maintained `.github/CODEOWNERS`. Map it
to the `area:` label namespace so routing and review ownership agree:

```
# .github/CODEOWNERS
/src/api/        @org/backend
/src/web/        @org/frontend
/.github/        @org/platform
/docs/adr/       @org/architects
```

An unmaintained CODEOWNERS file that names departed people converts every PR into a blocked PR.
Check it whenever ownership changes, and treat a stale entry as a defect.
