---
name: security-advisory
description: Run coordinated disclosure end to end — private report intake, reproduction, CVSS scoring, fix and backport planning, embargo handling, GHSA publication, CVE request and reporter credit. Use when a vulnerability is reported privately, when one is found internally, or when a public issue turns out to contain an undisclosed flaw. Not for routine bug triage or for publishing a normal release.
user-invocable: true
disable-model-invocation: true
argument-hint: "<intake|score|plan|publish> [report-id]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: governance
  foundry.io: "private vulnerability report -> fix, GHSA advisory, credited disclosure"
license: Apache-2.0
---

# Coordinated disclosure

Two failure modes bracket this work: disclosing too early and leaving users exposed, or sitting
on a report until the reporter publishes out of frustration. The process below exists to avoid
both, and to make the timeline defensible afterwards.

**Rules that never bend.**

1. **Nothing security-relevant goes into a public channel before publication** — no issue, no PR
   title, no commit message, no test name, no branch name. The commit that fixes it is written
   as if it were a normal hardening change until the advisory is live.
2. **The reporter is a collaborator, not a nuisance.** Acknowledge fast, keep them informed,
   credit them exactly as they asked.
3. **Never publish an advisory before the fixed release is downloadable.**
4. **Never invent repository state.** If you cannot read the vulnerable code, say so.

This skill publishes a GHSA and requests a CVE, so it declares `disable-model-invocation: true`:
a human types `/security-advisory`, the model never starts a disclosure on its own judgement.
The `release-communicator` agent still preloads it — frontmatter preloading is a separate path
and is unaffected.

## Phase 1 — Intake

Sources: GitHub private vulnerability reporting
(`https://github.com/{owner}/{repo}/security/advisories/new`), the address in `SECURITY.md`, a
maintainer's own finding, or a public issue that should never have been public.

```bash
gh api repos/{owner}/{repo}/private-vulnerability-reporting --jq .enabled
gh api repos/{owner}/{repo}/security-advisories \
  --jq '.[] | [.ghsa_id, .state, .severity, .summary] | @tsv'
```

If it arrived **publicly**: treat as already disclosed. Stop the embargo clock, prioritise the
fix over the process, and ask the reporter to stop adding detail — do not add any yourself, and
do not delete their comment without a maintainer decision (deletion after indexing achieves
nothing and reads as suppression).

Within the window in `SECURITY.md`:

- Acknowledge, name a contact, restate the target dates.
- Ask, in the same message, for: affected versions, the environment, a minimal proof of concept,
  the impact they believe it has, whether anyone else knows, whether they have a planned
  disclosure date, and **how they want to be credited** (name, handle, employer, or anonymous).
- Open a private tracking record at `.foundry/scratch/<session>/advisory-<id>.md` from
  `templates/advisory.md`. Never in the public repository, never in the public issue tracker.

Start the timeline log now — every event with a UTC timestamp. It is the artifact that answers
"why did this take 40 days" later.

## Phase 2 — Reproduce and determine impact

Reproduce on a supported version, in an isolated environment, and record the exact command,
commit and output. Then answer, in the record:

- **Is it a vulnerability here, or upstream?** A flaw in a dependency with no reachable path
  through this project is an upstream report plus possibly a pin — say which, and tell the
  reporter where it went.
- **Who is exposed**: which versions, which configurations, whether the default configuration is
  affected. "Only with a non-default flag" changes the severity and must be stated.
- **Is it already exploited or public?** Search for prior disclosure. If it is public, the
  embargo is over regardless of the reporter's preference.
- **What is the blast radius**: what an attacker gets, and whether it crosses a trust boundary.

Out-of-scope determinations use the list in `SECURITY.md`. Rejecting a report is legitimate; do
it with the reasoning, not with silence, and thank them anyway.

If root-causing is hard, invoke `superpowers:systematic-debugging`; if absent, work from the
proof of concept inwards and record what was ruled out.

## Phase 3 — Score with CVSS

Use CVSS v4.0 where the project has adopted it, otherwise v3.1 — and **state which**. Publish
the vector, not just the band; a band alone cannot be checked or disputed.

Bands (both versions): 9.0–10.0 critical · 7.0–8.9 high · 4.0–6.9 medium · 0.1–3.9 low.

Base metrics and the mistakes that inflate scores are in `references/cvss.md`. The four that
matter most in practice:

- **Attack Vector**: `Network` only if reachable across a network by design. A parser in a CLI
  processing a local file is `Local`, even when the file arrived over the internet.
- **Privileges Required / User Interaction**: be honest. Most library flaws need the application
  to pass attacker-controlled input — that is usually `PR:N`, `UI:N` from the library's
  perspective, but say so explicitly.
- **Scope** (v3.1): changed only if the impact crosses a security authority boundary — sandbox
  escape, container escape, privilege boundary. Not "it is really bad".
- **Confidentiality/Integrity/Availability**: rate what the attacker actually gets, not the
  worst thing imaginable downstream.

Record the vector string, the version, the score, and one sentence of justification per metric
that is not `N`. Where the reporter's score differs, record both and explain the difference —
this is the single most common source of friction with reporters.

## Phase 4 — Fix and backport plan

- Fix on a **private branch** — GitHub's temporary private fork from the advisory is the right
  place (`gh api -X POST repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks`), because it
  keeps the work off the public repository entirely.
- Write a regression test that fails before the fix. A security fix without a test invites the
  variant to be reintroduced in six months.
- **Look for variants** before shipping: the same pattern elsewhere in the codebase
  (`grep -rn '<the unsafe call>' -- <src>`). Fixing one instance of three is the classic
  incomplete-fix advisory.
- **Backport** to every line in the supported-versions table of `SECURITY.md`. For each line,
  record the target version and whether the fix applies cleanly. If a line cannot be fixed, say
  so in the advisory and give a mitigation or an EOL statement.
- If the fix **must be breaking**, ship the break in the current major and a minimal mitigation
  in the maintenance lines. Do not force a major upgrade as the only remedy without saying so
  prominently.
- **Mitigation for those who cannot upgrade**: a config change, a WAF rule, a flag. If there is
  none, write "no mitigation available" — the absence is information.
- Coordinate downstream when the project is a widely used dependency: distribution maintainers,
  major consumers, and the relevant ecosystem security team, all under the same embargo.

## Phase 5 — Embargo

- Default disclosure target from `SECURITY.md`; 90 days from acknowledgement is a widely used
  industry norm and a defensible default.
- Set the publication date **with** the reporter. Their disclosure plans are theirs to make; the
  most you can do is ask, and you should ask early.
- Shorten the embargo immediately if there is evidence of exploitation, a public leak, or a
  third-party disclosure. Users first, process second.
- Extend only with the reporter's agreement, and only with a concrete reason and a new date.
  Open-ended extensions are how reporters end up publishing unilaterally.
- Keep the circle minimal and named in the record. Every additional person is disclosure risk;
  every additional day is exposure.
- Log every date change with who agreed to it.

## Phase 6 — Publish

Order matters: **release first, advisory second, within minutes, not days.**

```bash
# 1. Release the fixed versions (human, with credentials) — verify they are downloadable.

# 2. Draft/complete the advisory
gh api -X POST repos/{owner}/{repo}/security-advisories \
  -f summary='<one line, no exploit detail>' \
  -f description='<impact, affected configs, mitigation, credit>' \
  -f 'cvss_vector_string=CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N' \
  -F 'vulnerabilities[][package][ecosystem]=npm' \
  -F 'vulnerabilities[][package][name]=<pkg>' \
  -F 'vulnerabilities[][vulnerable_version_range]=>= 1.0.0, < 1.9.4' \
  -F 'vulnerabilities[][patched_versions]=1.9.4'

# 3. Request a CVE if downstream projects depend on this
gh api -X POST repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve

# 4. Verify what was published — read back the band GitHub derived, do not assume it
gh api repos/{owner}/{repo}/security-advisories/{ghsa_id} \
  --jq '{state,severity,cvss:.cvss.vector_string,
         cvss3:.cvss_severities.cvss_v3.vector_string,
         cvss4:.cvss_severities.cvss_v4.vector_string,
         cve:.cve_id,credits:[.credits[].login]}'
```

**`severity` and `cvss_vector_string` are mutually exclusive on this endpoint.** GitHub's own
schema for the create body says of each: "You must choose between setting this field or
`<the other>`." Send the vector alone — it is the more informative of the two and GitHub derives
the band from it — and read the derived band back in step 4. Sending both gets the request
rejected and creates no advisory.

The create body carries exactly **one** vector field, and the worked example above is a v3.1
vector. `cvss_severities.cvss_v3` / `.cvss_v4` exist only on the *response*; they are not
writable. So if Phase 3 scored with **CVSS v4.0**: put the v4.0 vector and score in the
`description` body, name the version there, and verify against the current API reference what
`cvss_vector_string` accepts before sending a `CVSS:4.0/...` string — record the date you checked
in the timeline log. Never assert an API behaviour you have not just confirmed.

Every maintained line must appear as its own `vulnerabilities[]` entry with an exact range —
scanners resolve ranges literally, and an omitted line leaves those users unwarned.

Then: changelog `Security` entry (GHSA id, band, patched versions, advisory link, no exploit
detail), a note in the release notes, and a message to the reporter telling them it is live and
they may now publish.

If `gh` is unavailable, write the advisory markdown plus the exact API calls to
`.foundry/blackboard/release/publish.sh` for a human. Never publish security content through an
unverified path.

## Phase 7 — Credit and close

- Credit **exactly** as consented, including anonymity, and including a change of mind.
  GHSA credit types: `finder`, `reporter`, `analyst`, `coordinator`, `remediation_developer`,
  `remediation_reviewer`, `remediation_verifier`, `tool`, `sponsor`, `other`.
- Thank them, and tell them the timeline. Reporters who are treated well report again; reporters
  who are ignored publish first next time.
- Write the post-incident notes in the record: how it got in, why the tests did not catch it,
  what class of bug it is, and whether a lint rule, fuzz target or type change prevents the
  class rather than the instance.
- Emit a `finding.v1` with the class-level lesson and, if a process change is warranted, an
  `adr.v1`. Record a `fact.v1` type `risk` through `mcp__plugin_foundry-core_foundry__memory_write`.
- If the timeline slipped, fix `SECURITY.md` to state numbers you can meet.

## Exit criteria

- [ ] Acknowledgement sent within the `SECURITY.md` window; timestamp in the timeline log.
- [ ] Reproduced with a recorded command, commit and output — or explicitly marked unreproduced
      with the reason.
- [ ] Affected versions and configurations enumerated; default-configuration exposure stated.
- [ ] CVSS version stated, vector published, and every non-`N` metric justified in one sentence.
- [ ] The create call sent `cvss_vector_string` **or** `severity`, never both; the band GitHub
      derived was read back from the API and matches the intended one.
- [ ] Regression test fails before the fix and passes after.
- [ ] Variant search performed, with the search command recorded.
- [ ] Every supported line either fixed, mitigated, or declared EOL in the advisory.
- [ ] Publication date agreed with the reporter and every change logged.
- [ ] Advisory published **after** the fixed release was downloadable; ranges cover every line.
- [ ] CVE requested where the project has downstream dependents, or a reason recorded.
- [ ] Credit matches recorded consent exactly.
- [ ] Nothing security-relevant appeared publicly before publication (branch names, commit
      messages and test names checked).
- [ ] Post-incident lesson recorded as `finding.v1` + `fact.v1`.

## What this skill deliberately does not cover

- **Writing the fix.** It plans and reviews; implementation belongs to the code agents.
- **Publishing the release itself** — credentials, signing and registries are human ops work.
- **Penetration testing or vulnerability research** on the project.
- **Legal exposure, breach-notification duties, regulator contact.** GDPR Art. 33 notification
  and equivalent duties are counsel's call; flag the question, never answer it.
- **Incident response for a compromised service or a leaked credential** — that is ops, not
  disclosure. Rotate first, then come back here.
- **Negotiating with a reporter demanding payment.** Escalate to a human; there is no bounty.
- **Judging whether a dependency's CVE is exploitable in your product** beyond reachability —
  that is a supply-chain analysis in the security vertical.
- **Deleting public comments or moderating the reporter.** Recommend; a human executes.

## References

- `templates/advisory.md` — private tracking record and the published advisory text.
- `references/cvss.md` — metric selection, worked vectors, and the common scoring mistakes.
