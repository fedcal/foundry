export const meta = {
  name: 'foundry-compliance-sweep',
  description: 'Assess a project against selected jurisdiction packs, one control at a time, with evidence',
  whenToUse: 'Compliance gap analysis where each control must be assessed against real evidence in the codebase rather than assumed.',
  phases: [{ title: 'Profile' }, { title: 'Assess' }, { title: 'Report' }],
}

// args: { jurisdictions?: string[], packsDir?: string, today?: string }
const jurisdictions = args?.jurisdictions ?? ['global-baseline']
// The packs ship with foundry-legal, which installs somewhere the workflow cannot resolve — a
// script has no filesystem and no environment. Pass the directory when you know it; otherwise the
// scout is told how to find it and to report failure instead of inventing controls.
const packsDir = args?.packsDir
// `assessedOn` is required by compliance-check.v1 and the clock is unavailable inside a workflow.
const today = args?.today

const WAVE = 'compliance'

phase('Profile')
const profile = await agent(
  `Characterise this project for compliance scoping. Determine, from the code and configuration only: ` +
  `what categories of personal data are processed, whether there are external users, the sector if evident, ` +
  `deployment geography if evident, whether AI models are used, and whether the software is distributed or offered as a service.\n` +
  `Mark anything you cannot establish as "undetermined" — do not infer from the project name.`,
  {
    label: 'profile',
    model: 'opus',
    effort: 'high',
    schema: {
      type: 'object',
      required: ['characteristics'],
      properties: {
        characteristics: { type: 'object' },
        undetermined: { type: 'array', items: { type: 'string' } },
      },
    },
  },
)

if (!profile) return { error: 'Could not profile the project; compliance scoping cannot proceed on guesses.' }

const CONTROL_LIST_SCHEMA = {
  type: 'object',
  required: ['controls', 'totalInPack'],
  properties: {
    totalInPack: { type: 'integer', description: 'controls in the pack file, before appliesWhen filtering' },
    packPath: { type: 'string', description: 'the pack file you actually read' },
    controls: {
      type: 'array',
      description: 'only the controls whose appliesWhen matches the profile',
      items: {
        type: 'object',
        required: ['controlId', 'instrument', 'requirement'],
        properties: {
          controlId: { type: 'string' },
          instrument: { type: 'string' },
          requirement: { type: 'string' },
          evidenceHints: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    notApplicable: { type: 'integer', description: 'controls whose appliesWhen did not match' },
    note: { type: 'string', description: 'why the list is short or empty, if it is' },
  },
}

const CHECK_SCHEMA = {
  type: 'object',
  required: ['status', 'rationale'],
  properties: {
    status: { type: 'string', enum: ['compliant', 'partial', 'non-compliant', 'not-applicable', 'undetermined'] },
    rationale: { type: 'string', maxLength: 600 },
    gap: { type: 'string' },
    remediation: { type: 'string' },
    effortEstimate: { type: 'string' },
    evidenceCount: { type: 'integer', description: 'verifiable pointers recorded on the artifact' },
  },
}

const CHALLENGE_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reasoning'],
  properties: {
    refuted: { type: 'boolean' },
    reasoning: { type: 'string', maxLength: 600 },
    revisedStatus: { type: 'string', enum: ['partial', 'non-compliant', 'undetermined'] },
  },
}

// blackboard_write stores one file per (wave, agent) — mcp/server.mjs writes
// `<wave>/<agent>.json` — so every control needs its own agent key or the artifacts overwrite
// one another. Mirrors sanitize() in the server, which names the file.
const slug = (s) => String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
const keyOf = (pack, controlId) => slug(`${pack}-${controlId}`)

phase('Assess')
log(`Assessing ${jurisdictions.length} pack(s): ${jurisdictions.join(', ')}`)

const assessed = await pipeline(
  jurisdictions,

  // Scout: read the pack and return the control ids that apply. Extraction and filtering, so haiku.
  (pack) =>
    agent(
      `Read the jurisdiction pack "${pack}" from the foundry-legal plugin and list the controls that apply to this project.\n\n` +
      (packsDir
        ? `The pack file is ${packsDir}/${pack}.json.\n`
        : `Find the pack file first — it is named ${pack}.json inside the packs/ directory of the foundry-legal plugin. Try:\n` +
          `  find ~/.claude/plugins . -maxdepth 8 -path '*foundry-legal/packs/${pack}.json' 2>/dev/null | head -1\n` +
          `If you cannot find it, return an empty control list and say so in note. Never invent controls: ` +
          `a fabricated control produces a fabricated compliance verdict.\n`) +
      `\nProject profile:\n${JSON.stringify(profile.characteristics)}\n\n` +
      `A control applies when its appliesWhen matches this profile; appliesWhen.always is true for every project. ` +
      `Return the applicable controls verbatim from the pack — controlId, instrument, requirement, evidenceHints — ` +
      `plus totalInPack and how many you excluded as notApplicable. Do not assess anything here.`,
      { label: `scope:${pack}`, phase: 'Assess', model: 'haiku', effort: 'low', schema: CONTROL_LIST_SCHEMA },
    ),

  // One agent per control. The pack already carries the legal interpretation — instrument and
  // requirement text are authored, not inferred — so the per-control task is evidence retrieval
  // and a status judgement, which routes as review work (sonnet/medium), not as legal analysis.
  (scoped, pack) => {
    if (!scoped) {
      log(`${pack}: the pack could not be read. No control was assessed against it.`)
      return []
    }
    if (!scoped.controls?.length) {
      log(`${pack}: 0 of ${scoped.totalInPack ?? 0} controls apply${scoped.note ? ` — ${scoped.note}` : ''}.`)
      return []
    }
    log(`${pack}: assessing ${scoped.controls.length} of ${scoped.totalInPack} controls (${scoped.notApplicable ?? 0} not applicable)`)

    return parallel(
      scoped.controls.map((c) => () =>
        agent(
          `Assess ONE compliance control against evidence in this codebase.\n\n` +
          `Jurisdiction pack: ${pack}\nControl: ${c.controlId}\nInstrument: ${c.instrument}\n` +
          `Requirement: ${c.requirement}\n` +
          (c.evidenceHints?.length ? `Where to look: ${c.evidenceHints.join(' | ')}\n` : '') +
          `\nFind the evidence yourself and record where it is. Absence of evidence is never evidence of ` +
          `compliance — that is "undetermined", not "compliant".\n\n` +
          `Write the full artifact with blackboard_write (mcp__plugin_foundry-core_foundry__blackboard_write): ` +
          `wave "${WAVE}", agent "${keyOf(pack, c.controlId)}", schema "compliance-check.v1", and data carrying ` +
          `controlId "${c.controlId}", jurisdiction "${pack}", the instrument and requirement above, your status, ` +
          `rationale, gap, remediation, an evidence array of {kind, ref} pointers ` +
          `(kind is one of file, command, url, standard, measurement — the contract rejects any other shape), ` +
          `assessedOn ${today ? `"${today}"` : 'set to today in YYYY-MM-DD'}, and the disclaimer ` +
          `"Automated technical assessment. Not legal advice."\n` +
          `Then return only the short judgement — the artifact is the record.`,
          { label: `assess:${pack}/${c.controlId}`, phase: 'Assess', model: 'sonnet', effort: 'medium', schema: CHECK_SCHEMA },
        ).then((check) => {
          if (!check) return null
          const record = {
            pack,
            controlId: c.controlId,
            instrument: c.instrument,
            requirement: c.requirement,
            artifact: `.foundry/blackboard/${WAVE}/${keyOf(pack, c.controlId)}.json`,
            ...check,
          }
          // Only a "compliant" verdict is challenged. In compliance the expensive error is
          // one-directional: an unchallenged false "compliant" is what gets shipped and relied on,
          // while a false gap costs a review. Challenging every verdict would double the run for
          // no gain on the side that cannot hurt anyone.
          if (check.status !== 'compliant') return { ...record, challenged: false }
          return agent(
            `Try to REFUTE a claim of compliance. The assessor concluded this project is COMPLIANT with:\n` +
            `${c.instrument} — ${c.requirement}\nIts rationale: ${check.rationale}\n` +
            `Full artifact: ${record.artifact} (read it with blackboard_read, wave "${WAVE}", ` +
            `agent "${keyOf(pack, c.controlId)}", full true).\n\n` +
            `Check the evidence actually says what the rationale claims: that the control is implemented, not merely ` +
            `documented or intended; that it covers every path the requirement covers, not one example.\n` +
            `Set refuted=true when the evidence does not carry the claim, and revisedStatus to what it does support. ` +
            `If you refute it, rewrite the artifact with blackboard_write using the same wave and agent so the record ` +
            `and the report agree.`,
            { label: `challenge:${pack}/${c.controlId}`, phase: 'Assess', model: 'opus', effort: 'high', schema: CHALLENGE_SCHEMA },
          ).then((verdict) => {
            if (!verdict) return { ...record, challenged: false, unchallenged: 'the challenger did not report back' }
            if (!verdict.refuted) return { ...record, challenged: true }
            return { ...record, challenged: true, status: verdict.revisedStatus ?? 'undetermined', claimedStatus: 'compliant', refutation: verdict.reasoning }
          })
        }),
      ),
    )
  },
)

const checks = assessed.flat(2).filter(Boolean)
const by = (s) => checks.filter((c) => c.status === s).length
const downgraded = checks.filter((c) => c.claimedStatus === 'compliant').length
const unchallenged = checks.filter((c) => c.status === 'compliant' && !c.challenged).length
log(
  `${checks.length} controls assessed: ${by('non-compliant')} non-compliant, ${by('partial')} partial, ` +
  `${by('compliant')} compliant, ${by('undetermined')} undetermined, ${by('not-applicable')} not applicable`,
)
if (downgraded > 0) log(`${downgraded} claim(s) of compliance did not survive the challenge and were downgraded.`)
if (unchallenged > 0) log(`${unchallenged} claim(s) of compliance could not be challenged — treat them as undetermined.`)

if (!checks.length) {
  log('No control was assessed. Reporting nothing rather than reporting a clean sweep.')
  return { jurisdictions, assessed: 0, error: 'No control was assessed — the packs could not be read, or none applied to this profile. This is not a clean bill.' }
}

phase('Report')
const order = { 'non-compliant': 0, partial: 1, undetermined: 2, compliant: 3, 'not-applicable': 4 }
const ranked = checks.slice().sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))

const report = await agent(
  `Produce a compliance gap report from these assessments. Each one is backed by a compliance-check.v1 artifact ` +
  `on the blackboard; read any you need in full with blackboard_read ` +
  `(mcp__plugin_foundry-core_foundry__blackboard_read), wave "${WAVE}", agent = the artifact's key, full true. ` +
  `Do not read the blackboard by filesystem path.\n\n` +
  `${JSON.stringify(ranked.map((c) => ({ controlId: c.controlId, pack: c.pack, instrument: c.instrument, status: c.status, gap: c.gap, remediation: c.remediation, effortEstimate: c.effortEstimate, claimedStatus: c.claimedStatus, challenged: c.challenged, artifact: c.artifact })))}\n\n` +
  `Order by exposure: non-compliant first, then partial, then undetermined. For each gap give the remediation and ` +
  `a realistic effort estimate. Where claimedStatus is "compliant" the assessment was challenged and downgraded — ` +
  `say so, because that is where a reader would otherwise have relied on a claim that failed.\n` +
  `Where status is "compliant" and challenged is false, the claim was never tested: report it as unverified, ` +
  `not as a clean result.\n` +
  `State plainly at the top that this is an automated technical assessment, not legal advice, and that a qualified ` +
  `professional must confirm anything consequential.`,
  { label: 'gap-report', model: 'opus', effort: 'high' },
)

return {
  jurisdictions,
  blackboardWave: WAVE,
  assessed: checks.length,
  statuses: {
    'non-compliant': by('non-compliant'),
    partial: by('partial'),
    compliant: by('compliant'),
    undetermined: by('undetermined'),
    'not-applicable': by('not-applicable'),
  },
  downgradedAfterChallenge: downgraded,
  unchallengedCompliant: unchallenged,
  // `challenged` travels with the status: a compliant verdict nobody could challenge is an
  // untested claim, and the caller cannot tell it from a tested one without this flag.
  controls: ranked.map((c) => ({ controlId: c.controlId, pack: c.pack, status: c.status, claimedStatus: c.claimedStatus, challenged: !!c.challenged, artifact: c.artifact })),
  report,
}
