export const meta = {
  name: 'foundry-audit-sweep',
  description: 'Sweep a codebase for defects across several lenses, then adversarially verify every finding before reporting it',
  whenToUse: 'Codebase audits where the item list is discovered at runtime and every finding must survive an attempt to refute it.',
  phases: [
    { title: 'Scope' },
    { title: 'Audit' },
    { title: 'Verify' },
    { title: 'Synthesise' },
  ],
}

// args: { paths?: string[], lenses?: string[], today?: string }
const LENSES = args?.lenses ?? ['correctness', 'security', 'performance', 'accessibility', 'maintainability']

phase('Scope')
const scope = await agent(
  `List the files worth auditing in this repository${args?.paths ? ` under ${args.paths.join(', ')}` : ''}. ` +
  `Exclude generated code, vendored dependencies, lockfiles and build output. ` +
  `Group them by subsystem. Return at most 60 files: if there are more, return the ones with the highest change frequency in git history, ` +
  `and set totalCandidates to how many files were auditable in total plus excluded to the names you left out. ` +
  `A cap that is not reported reads as full coverage.`,
  {
    label: 'scope',
    model: 'haiku',
    effort: 'low',
    schema: {
      type: 'object',
      required: ['subsystems', 'totalCandidates'],
      properties: {
        totalCandidates: { type: 'number', description: 'auditable files found before the 60-file cap' },
        excluded: { type: 'array', items: { type: 'string' }, description: 'files the cap left out' },
        subsystems: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'files'],
            properties: { name: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } },
          },
        },
      },
    },
  },
)

if (!scope || !scope.subsystems?.length) {
  log('Nothing in scope. Stopping rather than auditing an empty set.')
  return { findings: [], note: 'no files in scope' }
}

const scoped = scope.subsystems.reduce((n, s) => n + s.files.length, 0)
const excludedCount = Math.max(0, (scope.totalCandidates ?? scoped) - scoped)
log(`${scope.subsystems.length} subsystems, ${scoped} files, ${LENSES.length} lenses`)
// No silent caps: a truncated scope reported as a completed sweep is the failure this logs away.
if (excludedCount > 0) {
  log(`NOT AUDITED: ${excludedCount} of ${scope.totalCandidates} auditable files were dropped by the 60-file cap. This sweep does not cover them.`)
}

// A turn's token target is a hard ceiling: once it is reached agent() throws, and a sweep that
// dies part-way through still reports the subsystems it happened to reach as if they were the
// sweep. Deciding the depth up front, out loud, is the honest version of running out of budget.
// The allowance is deliberately coarse — one audit agent per pair plus two opus verifiers for
// each finding it returns — and applies only when the user set a target at all.
const BUDGET_PER_PAIR = 30_000
let lenses = LENSES
if (budget.total) {
  const affordable = Math.max(1, Math.floor(budget.remaining() / (scope.subsystems.length * BUDGET_PER_PAIR)))
  if (affordable < lenses.length) {
    log(`NOT AUDITED: the remaining token budget covers ${affordable} of ${lenses.length} lenses. Dropped: ${lenses.slice(affordable).join(', ')}. This sweep does not cover them.`)
    lenses = lenses.slice(0, affordable)
  }
}

// One pipeline item per (subsystem x lens): each audits and verifies independently,
// so a slow lens never blocks a fast one.
const work = scope.subsystems.flatMap((s) => lenses.map((lens) => ({ subsystem: s, lens })))

// The item shape is `finding.v1` minus the two fields blackboard_write supplies itself
// (`schema` and `producedBy`). Keeping the returned payload and the persisted artifact in the
// same shape is what lets the audit agent write every finding to the blackboard: finding.v1 sets
// additionalProperties:false and nests the location, so a top-level `file`/`line` — the shape this
// schema used to ask for — is rejected by the contract the plugin publishes.
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'severity', 'summary', 'failureScenario', 'confidence'],
        properties: {
          id: { type: 'string', maxLength: 60, description: 'lowercase slug, unique in this run, e.g. api-security-3' },
          title: { type: 'string', maxLength: 120 },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          category: { type: 'string' },
          summary: { type: 'string', maxLength: 600 },
          failureScenario: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          location: {
            type: 'object',
            required: ['file'],
            properties: { file: { type: 'string' }, line: { type: 'integer' }, component: { type: 'string' } },
          },
          standard: { type: 'string' },
          remediation: { type: 'string' },
        },
      },
    },
  },
}

// Mirrors sanitize() in mcp/server.mjs, which names the artifact file. Derived here rather than
// asked of the agent: a path the workflow computes cannot be misreported.
const slug = (s) => String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
const artifactOf = (f) => `.foundry/blackboard/audit/${slug(f.id)}.json`
const where = (f) => `${f.location?.file ?? 'unknown'}${f.location?.line ? `:${f.location.line}` : ''}`

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reasoning'],
  properties: {
    refuted: { type: 'boolean' },
    reasoning: { type: 'string' },
    correction: { type: 'string' },
  },
}

const audited = await pipeline(
  work,
  (item) =>
    agent(
      `Audit these files through the ${item.lens} lens: ${item.subsystem.files.join(', ')}.\n\n` +
      `Report only defects you can point at in the code. For each, give a concrete failure scenario: ` +
      `specific inputs or state that produce the wrong outcome. A finding without a failure scenario is speculation — omit it.\n` +
      `Cite the standard where one applies (CWE id, OWASP ASVS control, WCAG success criterion, RFC).\n` +
      `Return an empty list if the code is sound: finding nothing is a valid and useful result.\n\n` +
      `Give each finding an id of the form ${slug(item.subsystem.name)}-${item.lens}-<n>, unique within your batch.\n` +
      `Persist each one before you return: blackboard_write ` +
      `(mcp__plugin_foundry-core_foundry__blackboard_write) with wave "audit", agent set to the finding's id ` +
      `— one artifact per file, and the id is the file name, so reusing it overwrites the previous finding — ` +
      `schema "finding.v1", and data set to the finding plus an evidence array of {kind, ref} pointers ` +
      `(kind is one of file, command, url, standard, measurement — the contract rejects any other shape). ` +
      `The artifact is the full record; ` +
      `what you return here is the index over it.`,
      { label: `audit:${item.subsystem.name}/${item.lens}`, phase: 'Audit', model: 'sonnet', effort: 'medium', schema: FINDINGS_SCHEMA },
    ),

  (result, item) => {
    if (!result?.findings?.length) return []
    // Two independent refutation attempts per finding, with different burdens of proof.
    return parallel(
      result.findings.map((f) => () =>
        parallel([
          () => agent(
            `Try to REFUTE this finding. Read the code and prove it is wrong, already mitigated elsewhere, or unreachable.\n` +
            `Finding: ${f.title} at ${where(f)}\nScenario: ${f.failureScenario}\n` +
            `Full record: ${artifactOf(f)}\n\n` +
            `Default to refuted=true when the evidence is ambiguous. A false alarm costs more than a missed low-severity issue.`,
            { label: `refute:${f.id}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERDICT_SCHEMA },
          ),
          () => agent(
            `Check whether this finding is REACHABLE in practice: is the code path executed, is the input attacker- or user-controlled, ` +
            `does a guard upstream already prevent it?\nFinding: ${f.title} at ${where(f)}\nScenario: ${f.failureScenario}\n` +
            `Full record: ${artifactOf(f)}\n\n` +
            `Set refuted=true if the scenario cannot actually occur.`,
            { label: `reach:${f.id}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERDICT_SCHEMA },
          ),
        ]).then((verdicts) => {
          // A dead verifier is not a vote of confidence. agent() resolves to null when the user
          // skips it or the subagent dies after retries, so `refutedCount === 0` over the survivors
          // marked a finding CONFIRMED precisely when nobody had verified it — the guarantee this
          // workflow advertises, inverted. Survival now needs a positive quorum.
          const live = verdicts.filter(Boolean)
          const refutedCount = live.filter((v) => v.refuted).length
          const verified = live.length === 2
          return {
            ...f,
            lens: item.lens,
            subsystem: item.subsystem.name,
            survived: verified && refutedCount === 0,
            verdict: !verified ? 'unverified' : refutedCount === 0 ? 'confirmed' : 'refuted',
            verifiersLost: 2 - live.length,
            artifact: artifactOf(f),
            // Kept for the synthesiser, stripped before the workflow returns: the refutation
            // transcripts are the largest thing here and the caller did not ask for them.
            verdicts: live,
          }
        }),
      ),
    )
  },
)

const all = audited.flat(2).filter(Boolean)
const confirmed = all.filter((f) => f.verdict === 'confirmed')
const unverified = all.filter((f) => f.verdict === 'unverified')
const refuted = all.filter((f) => f.verdict === 'refuted')
log(`${all.length} candidate findings: ${confirmed.length} confirmed, ${refuted.length} refuted, ${unverified.length} UNVERIFIED (a verifier died — these are not cleared)`)

phase('Synthesise')
const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
confirmed.sort((a, b) => rank[a.severity] - rank[b.severity])

// Which (subsystem × lens) pairs produced no candidate at all. Computed, not asked of an agent:
// a pair that returned nothing is indistinguishable from a pair that was never run unless the
// workflow says which is which.
const produced = new Set(all.map((f) => `${f.subsystem} × ${f.lens}`))
const silent = work.map((w) => `${w.subsystem.name} × ${w.lens}`).filter((k) => !produced.has(k))

const SYNTHESIS_SCHEMA = {
  type: 'object',
  required: ['answer', 'themes'],
  properties: {
    answer: { type: 'string', maxLength: 2000, description: 'what this sweep found, as prose a reader can act on' },
    themes: {
      type: 'array',
      description: 'systemic causes, each naming the finding ids that share it',
      items: {
        type: 'object',
        required: ['cause', 'findingIds'],
        properties: {
          cause: { type: 'string' },
          findingIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    notCovered: { type: 'array', items: { type: 'string' }, description: 'questions this sweep cannot answer' },
  },
}

// Sorting is not synthesis. This phase used to be a comparator, so the workflow ended in a
// severity-ordered dump and the phase box was empty on screen.
const synthesis = all.length
  ? await agent(
      `Synthesise this audit. Confirmed findings (each survived two independent refutation attempts):\n` +
      `${JSON.stringify(confirmed.map((f) => ({ id: f.id, severity: f.severity, title: f.title, summary: f.summary, location: f.location, lens: f.lens, subsystem: f.subsystem })))}\n\n` +
      `Cluster them into systemic causes — one root cause that produced several findings is worth more to the reader ` +
      `than the findings listed separately. Name the cause, not the symptom.\n\n` +
      `Then act as a completeness critic and fill notCovered from what this run cannot speak to:\n` +
      `- ${unverified.length} finding(s) lost a verifier and are neither confirmed nor cleared;\n` +
      `- ${excludedCount} auditable file(s) were dropped by the 60-file scope cap${excludedCount > 0 ? ` (${(scope.excluded ?? []).slice(0, 20).join(', ')})` : ''};\n` +
      `- these subsystem × lens pairs returned nothing, which may mean clean code or a lens that did not look: ` +
      `${silent.length ? silent.join('; ') : 'none'}.\n\n` +
      `Do not invent findings that are not in the list above, and do not soften a severity.`,
      { label: 'synthesis', phase: 'Synthesise', model: 'opus', effort: 'high', schema: SYNTHESIS_SCHEMA },
    )
  : null

// Full records live in .foundry/blackboard/audit/. What returns here is the index over them:
// the refutation transcripts are the bulk of the payload and nobody asked for them in the
// caller's context.
const compact = (f) => ({
  id: f.id,
  title: f.title,
  severity: f.severity,
  confidence: f.confidence,
  summary: f.summary,
  location: f.location,
  failureScenario: f.failureScenario,
  standard: f.standard,
  remediation: f.remediation,
  lens: f.lens,
  subsystem: f.subsystem,
  artifact: f.artifact,
  verifiersLost: f.verifiersLost,
  corrections: f.verdicts.map((v) => v.correction).filter(Boolean),
})

return {
  scanned: scoped,
  filesExcluded: excludedCount,
  filesExcludedNames: scope.excluded ?? [],
  lenses,
  lensesRequested: LENSES,
  candidates: all.length,
  refuted: refuted.length,
  silentPairs: silent,
  blackboardWave: 'audit',
  synthesis,
  // Never folded into `findings`: an unverified finding is an open question, not a clean bill.
  unverified: unverified.map(compact),
  findings: confirmed.map(compact),
}
