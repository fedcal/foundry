# Reproducibility and packaging, per ecosystem and target

## Seeding, per ecosystem

State the seed value in the pipeline's configuration, not buried inside a call. Every place
randomness can enter must be seeded independently checked, because seeding one and missing another
(e.g. seeding the model but not the train/validation split) leaves partial non-determinism:

- **Python**: the split function's seed, the model's own random-state parameter, and — if used —
  the global `random`/`numpy` seeds for any custom sampling code. Note that some algorithms remain
  non-deterministic across different counts of parallel workers even with a seed set; state
  explicitly if exact reproducibility could not be achieved and what tolerance was accepted
  instead.
- **Java**: `java.util.Random`/`ThreadLocalRandom` seeded explicitly wherever the data-mining code
  samples or shuffles; Weka's classifiers generally take a `setSeed(long)` — confirm the fold/split
  code and the classifier are both seeded, not just one.
- **R**: `set.seed()` at the top of the script, and confirmed to actually cover every stochastic
  step used (some modelling functions draw randomness through paths not affected by a single
  top-level `set.seed()` call — verify by rerunning and diffing output).

## Dependency pinning, per ecosystem

| Ecosystem | Mechanism | Verify by |
|---|---|---|
| Python | `pyproject.toml`/`requirements.txt` with exact versions (and hashes where the tool supports them), or a lockfile from the project's chosen tool | Fresh install in a clean virtual environment reproduces the exact resolved versions |
| Java (Maven) | Exact versions in `pom.xml` (no version ranges), a checked-in `dependency:tree` snapshot for the release | `mvn dependency:tree` on a clean checkout matches the checked-in snapshot |
| Java (Gradle) | Exact versions in `build.gradle`, a committed lockfile (`gradle.lockfile`) | `./gradlew dependencies --write-locks` produces no diff on a clean checkout |
| R | `renv.lock` | `renv::restore()` on a clean checkout resolves without manual intervention |

Do not assert that a specific version is "the latest" or "the standard" — read the actual resolved
version from the lockfile or dependency tree and record that.

## Packaging per deployment target

### Batch job

- Single entry point taking explicit parameters: input path/window, output path, run date. Never
  infer the run date from "now" inside the job — pass it in, so a backfill or a rerun of a past
  date behaves identically to the original run.
- Idempotent: rerunning the same parameters overwrites or upserts, never duplicates, output.
- Exit code and logging sufficient for the scheduler to distinguish "ran and succeeded", "ran and
  found nothing to do" and "failed" — collapsing these into one exit code hides real failures.

### Service endpoint

- Input validation at the boundary, before the request reaches feature engineering or the model —
  a malformed request should produce a clear 4xx-style error, not an unhandled exception from deep
  inside the pipeline.
- A documented request/response contract (a schema, not just example payloads).
- The feature-pipeline and model version logged or returned per response, so any specific
  prediction can be traced back to exactly the code and artifact that produced it.
- A load/latency smoke test before the first real deployment — state the expected request volume
  and confirm the packaged service meets it, rather than discovering the limit in production.

### Scheduled pipeline step

- Declared upstream dependencies (what must have completed successfully first) and downstream
  consumers (what breaks if this step is late or fails).
- An explicit, chosen behaviour on partial or missing upstream data: skip and alert, halt the whole
  pipeline, or proceed with a documented degraded mode — pick one and write it down, rather than
  letting the default behaviour of whatever orchestrator is in use decide by accident.

### JVM artifact (`.jar`)

- Dependencies either shaded into the jar or explicitly declared as required at runtime — an
  unshaded jar with unstated dependencies fails only when someone else tries to use it.
- The model artifact's version embedded and readable at runtime (a manifest entry or a bundled
  resource file), so a consuming application can log which model version actually produced a given
  result.
- A build-time smoke test: load the packaged jar and score one known input, asserting the expected
  output — this is the jar-packaging equivalent of the reproducibility test and belongs in the same
  build that produces the release artifact, not as a separate manual step.
