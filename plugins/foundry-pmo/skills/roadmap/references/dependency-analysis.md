# Dependency analysis and critical path

## Classify every edge before you draw it

For each proposed `A → B`, answer literally: *what breaks if B starts before A finishes?*

| Type | Test | Keep in `dependsOn`? | How to break it |
|---|---|---|---|
| Technical | B cannot compile, run or deploy without A | yes | contract-first: agree the interface, stub A, build both in parallel |
| Data | B needs data only A produces | yes | seed fixtures or a synthetic dataset |
| Contractual | external party, licence, procurement, audit window | yes | cannot break — but start the clock earlier; procurement lead time is the real task |
| Resource | same person, same environment, same test device | **no** | it is capacity contention; handle in sequencing, not in the graph |
| Preference | "it feels wrong the other way" | **no** | delete |
| Compliance-order | approval must precede the change | yes | overlap the preparation, not the approval |

Resource dependencies in `dependsOn` are the most common cause of an invented critical path.
They make the graph longer without making the work longer, and they hide the fact that the real
constraint is one person.

## Compute the critical path

1. Build the DAG from surviving `dependsOn` edges. Detect cycles first — a cycle means two tasks
   were defined at the wrong granularity; merge or split them.
2. Weight each node with its PERT expected hours: `(o + 4m + p) / 6`.
3. Longest weighted path from any source to any sink = critical path.
4. Recompute twice more, once with all optimistic weights and once with all pessimistic weights.
   Report the pair as the range.

```
             ┌── T3 (16h) ──┐
T1 (8h) ── T2 (24h)         ├── T6 (12h) ── T7 (20h)
             └── T4 (40h) ──┘
                  T5 (6h, no dependents → not on any path to a sink: challenge it)

critical: T1 → T2 → T4 → T6 → T7 = 104 h expected  (optimistic 62 h, pessimistic 231 h)
```

The critical path can change when estimates change. Recompute at every revision; a stale
critical path is worse than none because it directs attention at the wrong task.

## Slack, and what to do with it

Slack (float) = latest start − earliest start for a task off the critical path. Two uses:

- **Absorb variance.** Tasks with slack can slip without moving the milestone. Do not report
  them as at risk when they slip within their slack — that is noise.
- **Relocate capacity.** A person idle on the critical path is a scheduling failure; a person
  working a high-slack task while the critical path is blocked is also a scheduling failure.

Near-critical paths matter: any path within **10%** of the critical path's expected length will
become critical after one bad week. Track the top two, not just the top one.

## Breaking a dependency is worth more than shortening a task

Ranked by effect on the milestone date:

1. Remove a false dependency — costs nothing, may remove days.
2. Split a critical-path task so part of it can run in parallel.
3. Start a contractual dependency earlier (procurement, access requests, audit booking).
4. Stub an interface so both sides proceed against an agreed contract.
5. Add capacity to a critical-path task — the weakest lever, and often negative in the short run
   (onboarding cost lands immediately, output lands later).

Never compress by removing the gate checks. That does not shorten the work; it moves it past the
milestone into an unbudgeted defect window.

## Fan-in and fan-out

- **Fan-in > 4** on one task: it is an integration point and a schedule risk. Give it its own
  buffer and its own detection signal.
- **Fan-out > 6** from one task: it is a keystone. If it slips, everything slips. Move it as
  early as possible and de-risk it with a spike even if it delays visible value.
- **Bus factor 1 on the critical path**: a `people`-category risk. Hand to `risk-manager`.

## Buffers

Put buffer where variance is, not where it is politically comfortable.

- **Project buffer** at the end, sized from the variance of the critical path, not as a flat
  percentage. A workable rule: half the difference between the pessimistic and expected sums.
- **Feeding buffers** where a non-critical chain joins the critical path, so its variance does
  not propagate.
- **Never per-task padding.** Padded tasks expand to fill their padding, and the padding becomes
  invisible so it cannot be managed.

State every buffer explicitly in the plan. A hidden buffer is spent by accident.

## Sanity checks before publishing the graph

- [ ] No cycles.
- [ ] No `dependsOn` edge of type resource or preference.
- [ ] Every task has at least one dependent, or is a gate criterion. Otherwise challenge it.
- [ ] Every external/contractual dependency has a named counterparty and a committed date.
- [ ] Critical path reported as a range; near-critical paths within 10% identified.
- [ ] Fan-in > 4 and fan-out > 6 nodes flagged.
- [ ] Buffers named, sized from variance, and visible.
