# Lawful basis checks and DPIA triggers

> **Automated technical assessment. Not legal advice.** Whether a basis is legally valid is a
> determination for a qualified DPO or lawyer. This file describes what to check **in code** so that
> the determination rests on facts.

## The mapping table

Build it before any check. One row per purpose, not per feature — features share purposes and
purposes share data.

| Purpose | Data categories | Basis claimed | Where the basis is evidenced | Retention tied to the purpose |
|---|---|---|---|---|

A purpose that cannot be stated in one sentence without the word "and" is two purposes. Split it,
because each half may need a different basis.

## The six checks

### 1. Consent claimed but not recorded

A boolean column is not a consent record: you cannot reconstruct what the person saw.

Look for a record containing, at minimum: the scope consented to, the version or hash of the notice
shown, the timestamp, and the mechanism (banner, form, API). Then read one real row and try to
reconstruct the user's screen from it. If you cannot, the record is insufficient.

`undetermined` if you cannot find the store. `partial` if the store exists but lacks notice version
or scope.

### 2. Consent gating not enforced

Find where consent is **read**, then check what happens before that read.

```
1. Load the application with a clean profile.
2. Record every write to cookies/localStorage/sessionStorage/IndexedDB before any interaction.
3. Record every outbound request to a third-party host before any interaction.
4. Compare against the set that is strictly necessary for the requested service.
```

Anything in the difference is consent-gating failure, whatever the banner says. Common offenders that
initialise at import time: tag managers, analytics, session replay, feature-flag clients, chat
widgets, font and map providers, and A/B testing SDKs.

Record the command and the observed list as `command` evidence. Without it, this check is an opinion.

### 3. Withdrawal harder than granting

Count interactions: accept versus withdraw. Then check what withdrawal **does** — find the code path.
A flag flip that no processing code consults is not withdrawal. Verify that after withdrawal the
same clean-profile test in check 2 shows the tracking stopped.

### 4. Legitimate interests without an assessment

Where the basis is legitimate interests, a three-part assessment must exist: the interest pursued,
why the processing is necessary for it, and the balancing against the individual's rights and
reasonable expectations. Absent → `undetermined` with the question, never `compliant`.

Two situations warrant an explicit flag for human review: legitimate interests claimed for processing
of children's data, and legitimate interests claimed for anything the individual would be surprised
by. Report the fact pattern; do not adjudicate.

### 5. Basis laundering

Check the git history of the purpose-to-basis document and of the consent component. The pattern:
a purpose ran on consent, the opt-in rate disappointed someone, and the basis silently became
legitimate interests while the processing stayed identical.

```
git log --follow -p -- docs/privacy/ | grep -iE 'consent|legitimate interest'
```

Report the change with its commit and date. Changing basis is not automatically improper; doing it
without an assessment and without telling anyone is the finding.

### 6. Contract basis stretched

"Necessary for the performance of the contract" covers what the service requires to work. It does not
comfortably cover analytics, marketing, personalisation of unrelated content, or training a model on
customer content. Where you find it stretched, escalate — this is a legal call and a common one to
get wrong.

Search the codebase for the reverse signal too: features that are technically optional (an analytics
call in a checkout flow) being justified as contractual because they sit inside a contractual flow.

## Special-category data

Special categories need an Art. 9-style exception **in addition to** a basis. In code the risk is
rarely a labelled column; it is:

- **free text** — support tickets, notes, bios, prompts, where users volunteer health and belief data;
- **inference** — a segment, a score or a recommendation that reveals a special category from ordinary
  data (purchase history revealing pregnancy, app usage revealing religion);
- **incidental capture** — uploaded documents, images containing faces, voice recordings.

Where free text exists and no exception is documented, the honest verdict is `undetermined` with the
observation that the schema cannot bound what the field holds. Do not report `compliant` because the
column is named `notes`.

## Children's data

If `data.children` or `users.minors` is `true` or `"unknown"` and the product is plausibly attractive
to minors, check: age determination mechanism, what happens when a user self-declares as underage,
whether behavioural tracking and profiling are disabled for those accounts, whether third-party SDKs
are active in child-directed surfaces, and the verifiable parental consent method. Age thresholds
differ by jurisdiction — report the mechanism, not a threshold judgement.

## DPIA triggers

Flag every trigger you observe with evidence. Leave the DPIA control `undetermined` unless you find a
dated assessment that **predates** the launch of the processing.

| Trigger | What to look for in code |
|---|---|
| Systematic and extensive automated evaluation of people | scoring, ranking, segmentation, eligibility decisions |
| Automated decision-making with legal or similarly significant effect | a decision applied without a human step |
| Large-scale special category or criminal-offence data | health, biometrics, beliefs at scale; background checks |
| Systematic monitoring of a publicly accessible area | camera or sensor ingestion, location tracking in public space |
| Innovative technology | new AI features, biometrics, IoT, neurotech |
| Matching or combining datasets | joins across sources collected for different purposes; enrichment vendors |
| Data about vulnerable people | children, employees, patients, applicants |
| Processing preventing access to a service or contract | eligibility gates, fraud blocks, automated suspensions |
| Biometric or genetic data | face/voice/fingerprint templates |
| Tracking of location or behaviour | precise geolocation, cross-site or cross-app tracking |
| Large-scale invisible processing | data obtained from third parties without the person's involvement |

The trigger list is a prompt for human judgement. Whether a DPIA is required, and what it must cover,
is a legal determination — your job is to make sure nobody can say they did not know the trigger was
present.

## Recording the outcome

For each purpose, one `compliance-check.v1` against the relevant pack control, with:

- `rationale` decomposing the requirement into elements and stating which you verified;
- evidence pointers for the basis record, the gating code and the withdrawal path;
- `gap` naming the specific missing element;
- `remediation` naming the file and mechanism, plus the assertion that would evidence the fix.
