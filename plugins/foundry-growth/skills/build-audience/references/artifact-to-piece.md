# From engineering artifact to publishable piece

The rule this file exists to enforce: **a piece starts from something that already happened in
the repository.** Topic brainstorming produces plausible titles nobody can write; artifact mining
produces pieces whose hardest part — the work — is already done and already evidenced.

If an item on the backlog cannot name the commit, file, issue, ADR or runbook it came from, it is
not a backlog item. Delete it.

## The mapping

| Repository artifact | How to find it | Piece it becomes | Reader question it answers | Evidence that must ship with it |
|---|---|---|---|---|
| ADR under `docs/adr/NNNN-*.md` | `git log --diff-filter=A --date=short --pretty='%ad %h' -- docs/adr/` | Decision piece: X over Y, and the condition that would reverse it | "How do I choose between these two, and what would change my mind?" | Link to the ADR; the commit that implemented it |
| Reverted or hotfixed commit | `git log -i --grep='revert\|hotfix\|rollback' --date=short --pretty='%h %ad %s'` | Failure piece: what broke, what the wrong hypothesis was, what the fix was | "Will this bite me too, and how would I notice?" | The diff, the failing test, the detection signal |
| Postmortem under `docs/postmortems/` (`foundry-quality:postmortem`) | `ls docs/postmortems/` | Public incident write-up, redacted | "What class of system fails this way?" | Timeline with real timestamps; the remediation commit |
| Performance commit or benchmark harness | `git log -i --grep='perf\|latency\|throughput\|benchmark\|memory'`; `find . -iname '*bench*'` | Measurement piece | "Is this optimisation worth my afternoon?" | The benchmark command, the machine/config, before and after numbers, the raw output file |
| Schema or data migration | `ls db/migration* migrations/ 2>/dev/null`; `foundry-dev:write-migration` output | Procedure piece: how the change shipped without downtime | "How do I do this without an outage?" | The migration files, the rollback path, the deploy sequence |
| A hard bug with a regression test | `git log -i --grep='^fix' --name-only --pretty=format: \| sort \| uniq -c \| sort -rn \| head -20` | Debugging narrative, one hypothesis at a time | "How would I have found this?" | The test that now fails without the fix |
| Deletion: dependency dropped, build time cut, code removed | `git log --diff-filter=D --name-only --since='18 months ago'` | Subtraction piece | "What can I stop doing?" | Line counts, dependency count, timing before/after |
| Runbook under `.foundry/runbooks/` (retrieve with `runbook_list` / `runbook_get`) | MCP, never a raw directory read | How-to piece | "Give me the steps that actually work." | The commands, verbatim, with their gates |
| A published contract or API version bump | `git log --date=short --pretty='%ad %s' -- '**/openapi*' '**/schemas/*'` | Compatibility piece | "What breaks when I upgrade?" | The diff between versions, the deprecation window |
| Accessibility fix (`foundry-dev:audit-accessibility`) | `git log -i --grep='a11y\|accessib\|wcag'` | Remediation piece naming the WCAG 2.2 success criterion | "Which criterion did this violate and how do I test for it?" | Before/after against the named SC, with the tool used |
| A memory fact of type `decision` or `risk` (`memory_search`) | MCP `memory_search`, never `.foundry/memory/facts/` directly | Short note: the constraint and why it holds | "Why is this project shaped like this?" | The fact id and its source |

## Artifacts that do **not** become pieces

State these as excluded in the plan rather than leaving them to be rediscovered:

- **Roadmap items and unshipped work.** A piece about what you intend to build is a promise with
  a publish date attached. `foundry-pmo:roadmap` owns intent; this skill publishes what happened.
- **A security fix before its advisory is out.** Coordinate through `foundry-oss:security-advisory`
  and publish afterwards, never before.
- **Anything naming a customer, employer or third party** without written permission you can point
  to. Permission is an artifact; "they probably wouldn't mind" is not.
- **Work covered by an embargo, NDA or an unpublished paper.**
- **A benchmark you cannot rerun.** If the harness is gone, the machine is gone, or the numbers
  were read off a screenshot, the piece is cut. It is not rewritten with vaguer numbers.
- **Someone else's commit narrated as yours.** Co-authorship is checkable: `git log --format='%an %ae'`.

## The four ways this goes dishonest

1. **The rounded-up benchmark.** "3x faster" from a single unwarmed run on a laptop. Rule: publish
   the command, the environment and the run count, or publish no multiplier.
2. **The retro-fitted narrative.** The commit history says three false starts; the piece says a
   clean insight. Rule: the timeline in the piece must be reconstructable from `git log`.
3. **The borrowed audience signal.** "Used by teams at …", a logo wall, "hundreds of developers",
   a testimonial nobody said. Rule: a usage claim requires the artifact that counted it — download
   figures with their date and method, an issue thread, a written quote with a link. No artifact,
   no claim; the sentence is deleted, not softened.
4. **The invented urgency.** A deadline, a "closing soon", a scarcity that does not exist. Rule:
   every date in a piece must correspond to a real, externally verifiable event.

## Redaction pass, before anything leaves the repository

Run this against the draft, not against the artifact:

- Internal hostnames, bucket names, ticket URLs, staging credentials, customer identifiers,
  employee names, screenshots with real data in them.
- Anything from a private repository or a private channel.
- `git log -p` excerpts pasted without reading what else was on those lines.
- Personal data of any kind in a screenshot or a log excerpt → stop and route to
  `foundry-legal:privacy-review` before publishing.

## Sizing a piece honestly

Three cost classes, and the plan uses the measured median once three pieces exist:

- **Note** — the artifact plus two paragraphs of context and a link. No new work.
- **Piece** — the artifact plus a reconstruction of the reasoning, one diagram or code excerpt,
  and a rerun of whatever evidence it cites.
- **Deep piece** — requires producing new evidence (a fresh benchmark, a worked example repo, a
  reproduction). Costs multiples of a piece and must be scheduled as such or not scheduled.

Every backlog row carries its class, its source artifact, and the single question it answers. A
row that answers two questions is two rows or none.
