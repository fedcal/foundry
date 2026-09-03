# Agent failure taxonomy

Each entry: what it looks like in the trace, and the runtime control that stops it. Prompt
wording is never listed as a control, because it is not one.

## 1. Oscillation loop
**Trace.** The same two tools alternating with near-identical arguments.
**Control.** Hash the last N (tool, args) pairs; abort on repetition. Return the loop reason to
the caller as a typed outcome, not as a generic timeout.

## 2. Retry storm
**Trace.** One tool, one error code, dozens of calls.
**Control.** Per-tool retry budget, exponential backoff, circuit breaker, global call cap, and
errors that say `do not retry` explicitly.

## 3. Silent partial success
**Trace.** A batch call returns `ok: true`; per-item outcomes were never inspected.
**Control.** Per-item outcomes in every batch result; a verification read-back before the agent
reports completion.

## 4. Tool-call hallucination
**Trace.** A call to a tool that does not exist, or with fields not in the schema.
**Control.** Validate before execution; return a structured error listing the valid tools and the
offending fields. Count invalid-call rate as an eval metric per tool.

## 5. Context poisoning
**Trace.** Behaviour changes immediately after one retrieved document or one fetched page enters
the context, and never recovers.
**Control.** Provenance on every injected item; the ability to drop a source and continue;
instructions pinned in a region that is never summarised away; untrusted content delimited as
data by the runtime rather than by the prompt author.

## 6. Objective drift
**Trace.** Late steps address a sub-problem the user never asked about.
**Control.** Restate the original request in the loop state (never summarised); verify the final
output against the original request before returning; measure it as an eval criterion.

## 7. Unbounded consumption
**Trace.** A run costing many times the median, usually with a long tail of cheap steps.
**Control.** Hard token, cost and wall-clock budgets enforced by the orchestrator, with the run
terminated and reported rather than silently truncated, plus an operator kill switch.

## 8. Stale resume
**Trace.** After a restore, the agent acts on observations made before the crash.
**Control.** Revalidate preconditions after restore; never trust cached observations across a
resume; version the state schema so old runs are detected rather than misread.

## 9. Duplicate side effect on resume
**Trace.** Two identical mutations, one before the crash and one after.
**Control.** Idempotency keys derived from run + step + arguments, enforced by the tool backend,
plus a resume test that asserts single application.

## 10. Human-gate deadlock
**Trace.** The run's last step is a confirmation request, hours old.
**Control.** Timeout with a defined default (deny), a notified owner, and a run state that is
resumable rather than lost.

## 11. Excessive agency
**Trace.** An irreversible tool called in a run whose task never required it.
**Control.** Least tool per task; effect classes enforced in the runtime; per-run cap on
irreversible calls; the withheld-capability list published in the design doc.

## 12. Tool selection degradation
**Trace.** Wrong-but-plausible tool chosen; accuracy falls as tools are added.
**Control.** Fewer, non-overlapping tools with "when not to use" in every description; a router
topology past the point where selection degrades; per-tool selection accuracy in the eval suite.

## 13. Lost update between parallel workers
**Trace.** Two workers write the same state field; one write disappears.
**Control.** Per-field reducers (append/merge/max) instead of overwrite; worktree or equivalent
isolation for file-writing workers (AUTHORING.md §8); a merge step that is explicit code.

## 14. Supervisor context blowup
**Trace.** Supervisor prompt grows with every worker report; cost per step rises across the run.
**Control.** Workers return artefact references plus a bounded summary; the supervisor reads a
full artefact only when it must act on the detail.

## Reading a trace

The minimum per-step record that makes any of this diagnosable: run id, step index, tool name,
arguments, outcome code, result size, tokens in/out, cost, latency, state version, prompt
version, model id. If your traces lack these fields, every incident review is speculation, and
adding the fields is the highest-value change available.
