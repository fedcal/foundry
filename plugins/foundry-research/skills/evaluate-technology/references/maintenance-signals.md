# Maintenance signals — commands and interpretation

Measure, do not vibe. Every value carries the date it was measured, because all of them decay.
Prefer a local clone and the project's own release feed over any aggregator; aggregators cache,
mis-parse and go stale.

```bash
# One-time setup for all git-based signals
git clone --filter=blob:none <repo-url> /tmp/eval-<name> && cd /tmp/eval-<name>
```

`--filter=blob:none` keeps the clone small while preserving full history metadata.

## Release cadence

```bash
git tag --sort=-creatordate --format='%(creatordate:short)  %(refname:short)' | head -20
```

Compute the intervals between the last six releases. Read the **shape**, not a threshold:

- Regular intervals, any length → healthy. A stable C library releasing yearly is not sick.
- Monotonically widening gaps → the pre-abandonment pattern. This is the signal that matters.
- A long gap followed by a burst → often a maintainer change or a security scramble. Check
  which; they mean opposite things.

Never apply a universal "must release every N months" rule. Compare a project to its own past.

## Time since last commit and last release

```bash
git log -1 --format='last commit: %cs by %aN'
git tag --sort=-creatordate --format='%(creatordate:short) %(refname:short)' | head -1
```

A gap between last commit and last release tells you whether unreleased fixes are piling up —
which forces consumers onto `main`, a real operational cost.

## Bus factor

```bash
# authors of commits touching the core directory in the last 12 months
git log --since='12 months ago' --format='%aN' -- src/ \
  | sort | uniq -c | sort -rn | head -20
```

Count how many authors it takes to cover 50% of those commits. That number is the bus factor.
Record it **with the names**: "bus factor 1 (A. Maintainer)" is an actionable risk;
"bus factor 1" is a statistic.

Normalise duplicate identities before counting:

```bash
git log --since='12 months ago' --format='%aN <%aE>' -- src/ | sort -u
```

One human with three email addresses inflates the bus factor and hides the risk.

## Issue trend

With a forge CLI:

```bash
gh issue list --repo <owner>/<repo> --state all --limit 1000 \
  --json number,createdAt,closedAt,labels > /tmp/issues.json
```

Compute opened vs. closed per month over 12 months.

- A widening gap → maintainers are losing ground.
- A sudden collapse of the gap → check for mass stale-bot closure before celebrating. Look for
  a burst of closures on one day with no linked commits.

If `gh` (or the equivalent) is absent, record the signal as `unavailable` and say so. Do not
substitute a screenshot of an aggregator badge.

## Time to first maintainer response

From the same export, take the last 20 non-trivial issues and compute the median days from
`createdAt` to the first comment by a user with write access. This predicts your future support
experience better than any other single number, and it is the one nobody measures.

## Security responsiveness

Check, in this order:

1. `SECURITY.md` at the repository root — is there a disclosure route and a stated response
   window? Absence is itself a finding.
2. Published advisories for the project, and for each: time from report to fixed release.
3. Whether fixes are backported to supported branches, or only to `main` (which forces a major
   upgrade to get a security fix — a large hidden cost).

```bash
ls SECURITY.md .github/SECURITY.md 2>/dev/null
gh api "/repos/<owner>/<repo>/security-advisories" 2>/dev/null | head -c 2000
```

## Governance and funding

Record which of these applies, from the project's own `GOVERNANCE.md`, charter or foundation
page — not from inference:

| Model | Principal risk |
|---|---|
| Single individual | bus factor, burnout, sudden archive |
| Single company | relicensing, feature gating, strategy change |
| Foundation | slower change, but licence stability by charter |
| Consortium / standards-backed | slowest, most stable |

Funding: are maintainers employed to work on it, sponsored, or unpaid? Unpaid critical
infrastructure is a risk to plan around, not a moral failing to report.

## Supply-chain hygiene

If the project publishes an OpenSSF Scorecard, read the individual checks rather than the
aggregate: Maintained, Code-Review, Branch-Protection, Dangerous-Workflow, Token-Permissions,
Pinned-Dependencies, Signed-Releases, Vulnerabilities, Security-Policy.

The **absence** of a Scorecard is not a negative — most healthy projects do not publish one. A
published Scorecard with failing checks on Branch-Protection or Dangerous-Workflow is.

Also check: are releases signed or attested? Are release artifacts reproducible from the tag?

## Dependency depth

Your risk is the union of your dependencies' risks.

```bash
npm ls --all --omit=dev        # npm
mvn dependency:tree            # maven
./gradlew dependencies         # gradle
go mod graph                   # go
cargo tree                     # rust
pip install pipdeptree && pipdeptree   # python
```

Record: total transitive count, and how many of those are single-maintainer or last released
more than two years ago. A candidate with a small API and a hundred transitive dependencies is
not a small dependency.

## Forbidden signals

Never usable as evidence in the comparison:

- Star, fork, watcher or download counts.
- "Everyone uses it", "it is the standard", "it is the most popular X".
- Survey rankings and trend charts.
- The presence of a logo wall on the project's home page (unverifiable, undated).

Adoption is admissible **only** in this form:

> Organisation X, operating under constraint C at scale S, runs this in production, per
> <first-party source, published YYYY-MM-DD, retrieved YYYY-MM-DD>.

That is evidence about a constraint resembling yours. Everything else is evidence that a
package manager was invoked.

## Recording format

```
candidate      : <name>
measured       : YYYY-MM-DD
version        : <version> (read from <release feed URL>) | not verified
cadence        : <intervals between last 6 releases, in days>
last commit    : YYYY-MM-DD
bus factor     : N (<names>)
issue trend    : opened/closed per month over 12 months, gap direction
triage median  : N days (last 20 non-trivial issues) | unavailable
security       : SECURITY.md yes/no; median report-to-fix; backport policy
governance     : individual | company | foundation | consortium
funding        : employed | sponsored | unpaid | unknown
scorecard      : <failing checks> | not published
deps           : N transitive; M single-maintainer; K stale >24 months
```

Any line you could not measure reads `unavailable`, never a guess.
