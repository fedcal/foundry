# Risk identification prompts

Open brainstorming finds the risks everyone already discusses. These prompts find the ones nobody
says out loud. Work them; do not skim them. A category with zero risks is a finding you state
deliberately, not a category you skipped.

## Technical

- Which component has never been run at the target load, data size or concurrency?
- Which decision is a one-way door — data model, public API shape, identity provider, cloud region?
- Where does the design depend on behaviour we assumed but never verified?
- What in the stack is end-of-life, unmaintained, or pinned to a version we cannot upgrade past?
- Which integration has no sandbox, so it is first exercised in production?
- What single component, if it fails, takes everything else with it?
- Which part of the system has no test that would catch a regression?
- What did we build fast during the last deadline and never revisit?
- Which library are we using outside its documented use case?
- What happens on the second run — is anything non-idempotent?

## Schedule

- Which task on the critical path has the widest estimate ratio (pessimistic ÷ optimistic ≥ 3)?
- Which milestone depends on something outside the team's control?
- Where has scope grown since the baseline, and by how much?
- What must happen "in parallel" that in fact needs the same person?
- Which date is externally fixed — regulation, contract, event, seasonality?
- What are we assuming will be approved quickly, and who actually approves it?
- Which environment or test data does not exist yet, and how long does it take to obtain?
- What did the last comparable project take, and how does our estimate compare to it?

## Cost

- Which cost scales with a variable we do not control — usage, data volume, FX, energy price?
- What licence, seat count or pricing tier threshold do we cross during the plan?
- What is the cost of the rollback we have not budgeted for?
- Which "free tier" are we relying on, and what does the next tier cost?
- What ongoing run cost does this project create that nobody has agreed to fund?
- Which contractor or agency rate is due for renegotiation inside the plan window?

## Security

- Where does untrusted input reach a privileged operation?
- Which secret exists in more than one place, and when was it last rotated?
- Which dependency has known CVEs above CVSS 7.0 with no patched version available?
- What would one compromised credential reach — the blast radius, in records?
- Which endpoint has no rate limit and no authentication?
- What personal data is in logs, backups, analytics, or a developer's laptop?
- Which third-party script runs on a page that handles payment or credentials?
- Who still has access who should not — departed staff, former contractors, stale tokens?
- What in CI can execute arbitrary code from a pull request?

## Compliance

- Which personal data is processed, on what lawful basis (GDPR Art. 6), and can we evidence it?
- What retention or erasure obligation has no implemented mechanism (Art. 17)?
- Can we actually produce a data export within 30 days (Art. 15, Art. 20)?
- Which accessibility conformance claim (WCAG 2.2 AA) is unverified by a real audit?
- What audit, certification or reporting window falls inside the plan horizon?
- Which processor or sub-processor has no data processing agreement in place?
- What data crosses a border, and under which transfer mechanism?
- Which sector-specific obligation applies that nobody on the team has read?

## Operational

- What fails silently — no alert, no dashboard, no log?
- What is the recovery path, and when was it last actually exercised rather than documented?
- Which runbook does not exist for a scenario we know can occur?
- What happens on the busiest day of the year for this system?
- Who is on call, and what can they actually fix without waking someone else?
- What manual step exists in a process we describe as automated?
- Which alert fires so often that it is now ignored?
- What is the restore time from backup, measured rather than assumed?
- What breaks when a certificate expires, and who is notified before it does?

## Vendor

- Which vendor is single-source, and what is the exit cost in days?
- What SLA do we rely on, and what does the contract actually pay if it is missed? (Usually a
  service credit worth far less than the outage.)
- Which vendor could change pricing or terms inside the plan horizon?
- What is the vendor's own dependency and financial situation?
- Which vendor holds our data, and can we get it back in a usable format?
- What notice period applies, in both directions?
- Who at the vendor answers when something breaks at 2am, and is that in writing?

## People

- Where is the bus factor 1 on the critical path?
- What planned absence — leave, notice period, holiday season — overlaps a milestone?
- What skill does the plan require that nobody currently has?
- Who is the single approver for something that cannot proceed without approval?
- Which key person is unhappy, overloaded, or interviewing?
- What knowledge exists only in one person's head and in no document?
- Who is doing two jobs because a role is unfilled?
- What does onboarding a new person actually cost the team, in their time?

## Bus factor, measured rather than guessed

```bash
# authorship concentration per directory over the last year
git log --since='1 year ago' --pretty=format:'%an' --name-only \
| awk 'NF && !/^[A-Z]/ {print dir "\t" author} /^[A-Z]/ {author=$0} {dir=$0}' 2>/dev/null | head -0

# simpler and usually sufficient: contributors per top-level directory
for d in $(ls -d */ 2>/dev/null); do
  n=$(git log --since='1 year ago' --pretty=format:'%an' -- "$d" | sort -u | wc -l)
  echo -e "$n\t$d"
done | sort -n | head
```

Any directory on the critical path with exactly one contributor in a year is a `people` risk with
a named owner, not an observation.

## Prompts that catch what the categories miss

- **Pre-mortem.** "It is six months from now and this failed badly. Write the incident report."
  Then convert each sentence into a risk. This reliably surfaces things people will not say
  prospectively but will say retrospectively.
- **Assumption inversion.** List the plan's assumptions and negate each one. Which negations are
  plausible? Those are risks.
- **What changed?** Since the last review: new dependency, new person, new integration, new
  regulation, new traffic pattern, new deadline. Change is where risk enters.
- **What are we not looking at?** Which category has had no new risk in three reviews? Either it
  is genuinely stable, or nobody is looking there. Say which.

If `superpowers` is installed, invoke `superpowers:brainstorming` for the pre-mortem — it is
better at divergent generation than a checklist. If it is not, run the pre-mortem manually and
note that ideation was unassisted.
