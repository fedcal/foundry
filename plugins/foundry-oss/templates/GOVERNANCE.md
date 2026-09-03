# Governance

{{PROJECT}} is at governance band **{{BAND}}** ({{BAND_NAME}}), based on {{MAINTAINER_COUNT}}
people with write access and {{CONTRIBUTOR_COUNT}} contributors in the last 12 months.
This document grows when those numbers grow, and not before.

## Roles

| Role | Rights | How you get it | How you lose it |
|---|---|---|---|
| Contributor | Open issues and PRs | Participate | — |
| Triager | Label, close, assign | {{TRIAGER_CRITERIA}} | Inactivity {{INACTIVITY_MONTHS}} months, or Step *Removal* |
| Maintainer | Merge, release, vote | {{MAINTAINER_CRITERIA}} | Same |
<!-- BAND:B3 -->
| TSC member | Charter-level decisions | Election, {{TERM_MONTHS}}-month term | End of term, resignation, removal |
<!-- /BAND -->

Current holders: [MAINTAINERS.md](MAINTAINERS.md).

## Who decides what

| Decision | Rule |
|---|---|
| Merge a bugfix | {{RULE_BUGFIX}} |
| Public API change | {{RULE_API}} |
| New runtime dependency | {{RULE_DEPENDENCY}} |
| Drop a supported platform or version | {{RULE_DROP_SUPPORT}} |
| Cut a release | {{RULE_RELEASE}} |
| Add a maintainer | {{RULE_ADD_MAINTAINER}} |
| Remove a maintainer | {{RULE_REMOVE_MAINTAINER}} |
| Relicense | {{RULE_RELICENSE}} |
| Change this document | {{RULE_GOVERNANCE}} |
| Code of Conduct enforcement | Handled per [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md); not decided here |

<!-- BAND:B1+ -->
**Lazy consensus.** A proposal posted in {{CANONICAL_CHANNEL}} with no objection for
{{LAZY_CONSENSUS_HOURS}} hours is approved.

**Votes.** Quorum {{QUORUM}}. `+1` / `0` / `-1`. A `-1` is binding only with a written
technical reason **and** a proposed alternative; without one it counts as `0`. Voters recuse
themselves when they are the author, the subject, or have a direct commercial interest.

**Tie-break.** {{TIEBREAK}}.
<!-- /BAND -->

## RFCs

An RFC is **required** when the change: needs a major release under
[SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) §8; adds or removes a runtime dependency or
raises a minimum toolchain version; changes a persisted or wire format; changes security
behaviour or a default; changes this document, the licence, or the support policy; or exceeds
about {{RFC_EFFORT_DAYS}} days of work.

An RFC is **not** required for: bug fixes restoring documented behaviour, docs and tests,
dependency patch bumps, internal refactors with no observable change.

Process: open a PR adding `docs/rfc/NNNN-<slug>.md` → discussion for {{RFC_DISCUSSION_DAYS}}
days → final comment period of {{RFC_FCP_DAYS}} days announced in the thread → decision per the
table above → outcome recorded as an ADR in `docs/adr/`. Withdrawn and rejected RFCs stay in the
repository; the reasoning is the point.

## Conflict resolution

Technical disagreement only — conduct complaints follow the Code of Conduct instead.

1. Discuss in the thread. {{CONFLICT_STEP1_DAYS}} working days.
2. Escalate to a call, with a written summary posted back to the thread within 24 hours.
   Decisions made privately and not summarised publicly are void.
3. Escalate to the decision rule above. The vote and its reasoning are public.
4. Final: {{TIEBREAK}}. Recorded as an ADR and not reopened for {{REOPEN_MONTHS}} months without
   new information.

## Contribution licensing

Inbound contributions are licensed under **{{LICENSE}}**.
<!-- OPT:DCO -->
We use the [Developer Certificate of Origin 1.1](https://developercertificate.org/): every
commit carries `Signed-off-by`, enforced by CI. We chose the DCO over a CLA because it costs a
contributor one flag and we have no plan to relicense.
<!-- /OPT -->
<!-- OPT:CLA -->
Contributors sign a CLA before their first merge, because {{CLA_REASON}}. Individual and
corporate versions: {{CLA_URL}}. Contributions accepted before {{CLA_START_DATE}} remain under
their original terms.
<!-- /OPT -->

## Succession

- If {{LEAD_ROLE}} is unreachable for {{SUCCESSION_TRIGGER_DAYS}} days, {{SUCCESSOR}} assumes
  the role.
- Release signing key, package registry ownership and domain control are held by
  {{CREDENTIAL_HOLDERS}}. Recovery is tested on {{RECOVERY_DRILL_DATE}} and the date updated here.
- Registry namespaces have at least {{REGISTRY_OWNER_COUNT}} owners; verified
  {{REGISTRY_VERIFIED_DATE}}.
- If the project becomes unmaintained: a banner in the README, the repository archived, and the
  package deprecated with a pointer to any active fork. We will say so rather than fade out.
- Forking is permitted and expected; the licence and build are designed not to require our
  permission.

## What this does not cover

Governance does not create contributors, add maintainer hours, decide taste, prevent bad faith,
or provide legal protection. It defines who decides and when the argument stops.

Last reviewed: {{REVIEW_DATE}}. Next review: {{NEXT_REVIEW_DATE}}.
