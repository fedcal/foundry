# DORA's four keys — sources and misuses

Four metrics from the DORA research programme (published annually as the *State of DevOps* report,
and in *Accelerate*, Forsgren, Humble & Kim). Two describe speed, two describe stability. The
finding that made them interesting is that they move **together** in healthy organisations — the
speed/stability trade-off people assume is not observed.

## The four

| Key | Definition | Read from |
|---|---|---|
| Deployment frequency | how often code reaches production | deployment or release events |
| Lead time for changes | first commit on a branch → that commit serving production | VCS + deployment records |
| Change failure rate | deployments causing rollback, hotfix or incident ÷ all deployments | incident and rollback records |
| Failed deployment recovery time | incident start → service restored | incident timeline |

## Rules

**Report all four or state which are missing.** Reporting only deployment frequency and lead time
rewards shipping breakage — the two stability keys exist to make that impossible to hide.

**Never estimate a key.** If the data does not exist, mark it `unmeasured` and name what would
have to be instrumented. An estimated DORA number is worse than an absent one, because it enters
a comparison table and stays there.

**Lead time for changes is not lead time for work.** DORA's version starts at the first commit,
not at the request. It measures the delivery pipeline, not the queue in front of it. Reporting the
board's lead time as a DORA key is a category error that makes pipelines look far worse than they
are.

## Where the data actually comes from

| Key | Practical source |
|---|---|
| Deployment frequency | CD pipeline run history, GitHub deployment API, release tags |
| Lead time | commit timestamp joined to the deployment carrying it |
| Change failure rate | needs a convention: an incident, rollback or hotfix linked to a deployment id |
| Recovery time | incident tracker with honest start and resolve timestamps |

The third and fourth require the team to have decided, in advance, how a failure is recorded.
Without that convention the change failure rate is unmeasurable, and a team reporting 0% almost
always has no convention rather than no failures.

## Misuses

- **Comparing organisations.** The performance bands in the reports describe a survey population,
  not a target for a specific team. Use them to see direction, not to grade.
- **Setting a deployment frequency target.** Frequency is an outcome of batch size and pipeline
  confidence. Targeting it directly produces trivial deploys that raise the number and change
  nothing.
- **Attributing to individuals.** All four describe a delivery system.
- **Treating change failure rate as a quality score.** It measures deployment-time failures, not
  defects the users find later.

## Relationship to the flow metrics

Flow metrics measure the board — the work as tracked. DORA measures the pipeline — the change as
shipped. A team can have excellent cycle time and dreadful lead time for changes, which localises
the problem precisely: work finishes fast and then waits to be released.

Reporting them together is what makes that visible. Reporting either alone hides one half of the
system.
