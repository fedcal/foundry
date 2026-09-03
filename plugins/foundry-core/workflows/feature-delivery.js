export const meta = {
  name: 'foundry-feature-delivery',
  description: 'Deliver a feature in waves: analysis, implementation in isolated worktrees, then convergence review',
  whenToUse: 'A feature that spans architecture, frontend, backend and data, where the parts can be built in parallel once the contracts are agreed.',
  phases: [
    { title: 'Analysis' },
    { title: 'Implementation' },
    { title: 'Convergence' },
  ],
}

// args: { goal: string, areas?: string[] }
const goal = args?.goal
if (!goal) return { error: 'Pass the feature goal in args.goal.' }

const WAVE = 'analysis'

// agentType resolves against the same registry as the Agent tool, where a plugin agent is
// registered `<plugin>:<agent>`. An unknown type throws, so foundry-core would otherwise depend on
// foundry-pmo and foundry-dev being installed. Prefer the real specialist; fall back to a generic
// subagent carrying the same instructions, and say which one ran.
const specialist = async (agentType, prompt, opts) => {
  try {
    return await agent(prompt, { ...opts, agentType })
  } catch (e) {
    const message = String((e && e.message) || e)
    if (!message.includes('agentType') || !message.includes('not found')) throw e
    log(`${agentType} is not installed — running ${opts.label} as a generic agent with the same brief.`)
    return agent(`No ${agentType} agent is available in this session; apply that method yourself.\n\n${prompt}`, opts)
  }
}

// An agentType spawn inherits the agent definition's own `tools` allowlist. An allowlist that
// omits the Foundry MCP tools makes this handoff unreachable, and a silently skipped handoff
// leaves the Implementation wave reading an artifact that was never written — so say it out loud
// rather than let the next wave discover the gap.
const handoff = (name, schema) =>
  `Write the result with blackboard_write (mcp__plugin_foundry-core_foundry__blackboard_write): ` +
  `wave "${WAVE}", agent "${name}", schema "${schema}". Then return at most 300 tokens — the artifact is the record. ` +
  `blackboard_write stores one file per (wave, agent), so use a distinct agent name per artifact if you produce several.\n` +
  `If blackboard_write is not among your tools, say so as the first line of your reply and return the artifact inline ` +
  `instead — do not drop the handoff silently.`

phase('Analysis')
const analysis = await parallel([
  () => specialist(
    'foundry-pmo:requirements-analyst',
    `Establish the requirements for: ${goal}\n\nProduce requirement.v1 artifacts with Given/When/Then acceptance criteria. ` +
    `Quantify every non-functional word — "fast", "secure", "user-friendly" are not requirements until they carry a number or a standard. ` +
    `Search Foundry memory first with memory_search: a requirement that contradicts a recorded decision must say so explicitly.\n` +
    handoff('requirements', 'requirement.v1'),
    { label: 'requirements', phase: 'Analysis', model: 'opus', effort: 'high' },
  ),
  () => specialist(
    'foundry-dev:solution-architect',
    `Design the technical approach for: ${goal}\n\nProduce an adr.v1 with at least two genuinely different options, ` +
    `scored against the quality attributes that matter here, and state what the chosen option gives up.\n` +
    handoff('architecture', 'adr.v1'),
    { label: 'architecture', phase: 'Analysis', model: 'opus', effort: 'high' },
  ),
  () => specialist(
    'foundry-dev:security-architect',
    `Threat-model: ${goal}\n\nDecompose the feature, apply STRIDE per trust boundary, and produce risk.v1 artifacts. ` +
    `Every threat must map to a mitigation AND to a test that proves the mitigation exists. Defensive analysis only.\n` +
    handoff('threat-model', 'risk.v1'),
    { label: 'threat-model', phase: 'Analysis', model: 'opus', effort: 'high' },
  ),
])

const analysisOk = analysis.filter(Boolean)
if (analysisOk.length < 2) {
  return { status: 'blocked', phase: 'Analysis', reason: 'Fewer than two analysis agents produced a usable artifact.' }
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['worktreePath', 'branch', 'committed', 'summary'],
  properties: {
    worktreePath: { type: 'string', description: 'absolute path of the worktree you were given' },
    branch: { type: 'string', description: 'git rev-parse --abbrev-ref HEAD, run inside the worktree' },
    committed: { type: 'boolean', description: 'true only if your work is committed on that branch' },
    summary: { type: 'string', maxLength: 600 },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testCommand: { type: 'string' },
    testsPass: { type: 'boolean' },
    testOutput: { type: 'string', maxLength: 600, description: 'the real tail of the real run, not a paraphrase' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'reviewedAt'],
  properties: {
    verdict: { type: 'string', enum: ['ready', 'changes-needed', 'not-reviewable'] },
    reviewedAt: { type: 'string', description: 'the worktree path you actually read, or why you could not' },
    testsVerified: { type: 'boolean', description: 'true only if you ran the tests yourself' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what', 'where'],
        properties: { what: { type: 'string' }, where: { type: 'string' }, severity: { type: 'string', enum: ['blocking', 'major', 'minor'] } },
      },
    },
  },
}

phase('Implementation')
const areas = args?.areas ?? ['backend', 'frontend', 'data']
const built = await pipeline(
  areas,

  // isolation: 'worktree' gives this agent its own checkout under .claude/worktrees/. Nothing
  // merges it back — the runtime removes the worktree if it is unchanged and keeps it if it is not
  // — so the branch name is the only handle anyone downstream has on the code. An agent that does
  // not commit leaves work that the Convergence phase cannot land.
  (area) =>
    agent(
      `Implement the ${area} part of: ${goal}\n\n` +
      `Read the analysis artifacts first with blackboard_read (mcp__plugin_foundry-core_foundry__blackboard_read), ` +
      `wave "${WAVE}" — do not re-derive the design. The Foundry MCP server is rooted at the main checkout, so the ` +
      `blackboard reaches you here even though your worktree has its own copy of the repository.\n` +
      `Follow test-driven development: if the superpowers plugin is installed, invoke superpowers:test-driven-development and follow it.\n` +
      `Run the project's real test command and report its actual output.\n\n` +
      `You are working in an isolated git worktree and nothing merges it for you. Before you finish:\n` +
      `1. commit your work on the worktree's branch — uncommitted changes cannot be landed by anyone else;\n` +
      `2. report the worktree path and the branch name (git rev-parse --abbrev-ref HEAD, run inside the worktree).\n` +
      `Set committed=false rather than claiming a commit you did not make.`,
      { label: `build:${area}`, phase: 'Implementation', model: 'sonnet', effort: 'medium', isolation: 'worktree', schema: BUILD_SCHEMA },
    ),

  // The reviewer runs in the main checkout, where the implementation does not exist. Without the
  // worktree path it would review an unchanged tree and find nothing wrong with it.
  (result, area) => {
    if (!result) return null
    return agent(
      `Review the ${area} implementation of: ${goal}\n\n` +
      `It was built in a separate git worktree and is NOT in the main working directory. Read it there:\n` +
      `  worktree: ${result.worktreePath}\n  branch:   ${result.branch}\n` +
      `  changes:  git -C ${result.worktreePath} log --oneline -5 && git -C ${result.worktreePath} diff HEAD~1 --stat\n` +
      (result.committed ? '' : `  NOTE: the builder reported committed=false. Check for uncommitted work with git -C ${result.worktreePath} status.\n`) +
      `The builder reported: ${result.summary}\n` +
      `Tests: ${result.testCommand ?? 'not reported'} — ${result.testsPass === true ? 'reported passing' : result.testsPass === false ? 'reported FAILING' : 'result not reported'}.\n\n` +
      `Verify against the analysis artifacts (blackboard_read, wave "${WAVE}"): the acceptance criteria are met, the ` +
      `threat mitigations are present with the tests that prove them, and nothing was stubbed and forgotten. ` +
      `Run the tests yourself inside the worktree rather than trusting the report.\n` +
      `If you cannot read the worktree, return verdict "not-reviewable" and say why — do not review the main checkout ` +
      `and report it as this area's implementation.\n` +
      `Report honestly — a review that finds nothing on a first implementation is usually a review that did not look.`,
      { label: `review:${area}`, phase: 'Implementation', model: 'sonnet', effort: 'medium', schema: REVIEW_SCHEMA },
    ).then((review) => ({ area, build: result, review }))
  },
)

const delivered = built.filter(Boolean)
const landable = delivered.filter((d) => d.build.committed && d.build.branch)
log(`${delivered.length} of ${areas.length} areas built; ${landable.length} committed on a branch`)
for (const d of delivered) {
  if (!d.build.committed) log(`NOT LANDABLE: ${d.area} left its work uncommitted in ${d.build.worktreePath}. It is not in your tree.`)
  if (d.review?.verdict === 'not-reviewable') log(`UNREVIEWED: ${d.area} — ${d.review.reviewedAt}`)
}

phase('Convergence')
const landing = landable.length
  ? await agent(
      `Land the feature. Each area was built in its own git worktree on its own branch, and nothing has merged them:\n` +
      `${landable.map((d) => `  ${d.area}: branch ${d.build.branch} at ${d.build.worktreePath}`).join('\n')}\n\n` +
      `Merge each branch into the current branch of the main working directory, one at a time, in that order. ` +
      `A worktree branch is cut from the repository's default branch, not from your HEAD, unless this repository ` +
      `sets worktree.baseRef to "head" — run \`git log --oneline HEAD..<branch>\` first and say so if a branch ` +
      `carries commits that are not that area's work.\n` +
      `Resolve conflicts by keeping both intentions — the areas were built against one agreed design, so a conflict is ` +
      `usually two edits to a shared seam, not a disagreement.\n` +
      `Run the project's test command after the last merge and report its real output.\n` +
      `If a branch cannot be landed, leave it unmerged, name it, and say what conflicts: an unmerged branch can still be ` +
      `landed by hand, while a merge that quietly dropped half an area cannot be undone by someone who does not know it happened.`,
      {
        label: 'land',
        phase: 'Convergence',
        model: 'sonnet',
        effort: 'medium',
        schema: {
          type: 'object',
          required: ['merged', 'unmerged'],
          properties: {
            merged: { type: 'array', items: { type: 'string' }, description: 'branches now in the main working directory' },
            unmerged: {
              type: 'array',
              items: {
                type: 'object',
                required: ['branch', 'reason'],
                properties: { branch: { type: 'string' }, reason: { type: 'string' } },
              },
            },
            testsPass: { type: 'boolean' },
            testOutput: { type: 'string', maxLength: 600 },
          },
        },
      },
    )
  : null

if (!landing) log('Nothing was landed: no area produced a committed branch.')
else if (landing.unmerged?.length) log(`${landing.unmerged.length} branch(es) left unmerged: ${landing.unmerged.map((u) => u.branch).join(', ')}`)

const integration = await agent(
  `Cross-check the delivered feature: ${goal}\n\n` +
  (landing?.merged?.length
    ? `These branches were merged into the main working directory: ${landing.merged.join(', ')}. Read the merged code there.\n`
    : `Nothing was merged into the main working directory. The work is in these worktrees:\n` +
      `${delivered.map((d) => `  ${d.area}: ${d.build.worktreePath} (branch ${d.build.branch})`).join('\n')}\n`) +
  (landing?.unmerged?.length ? `Still unmerged: ${landing.unmerged.map((u) => `${u.branch} (${u.reason})`).join('; ')}\n` : '') +
  `\nThe agreed design is in the analysis artifacts — read them with blackboard_read, wave "${WAVE}".\n` +
  `Check the seams: do the parts agree on the contract, the error model, naming and versioning? Do the acceptance ` +
  `criteria hold end to end? Reviews already raised:\n` +
  `${JSON.stringify(delivered.map((d) => ({ area: d.area, verdict: d.review?.verdict ?? 'no review', issues: d.review?.issues ?? [] })))}\n\n` +
  `List what is genuinely done and what only looks done. Be specific about the difference, and count anything sitting ` +
  `on an unmerged branch as not done.`,
  { label: 'integration', phase: 'Convergence', model: 'opus', effort: 'high' },
)

return {
  goal,
  analysis: analysisOk.length,
  areas: delivered.length,
  // Where the code actually is. Without this the caller has orphan worktrees and no way to find them.
  worktrees: delivered.map((d) => ({
    area: d.area,
    path: d.build.worktreePath,
    branch: d.build.branch,
    committed: d.build.committed,
    testsPass: d.build.testsPass,
    merged: !!landing?.merged?.includes(d.build.branch),
  })),
  reviews: delivered.map((d) => ({ area: d.area, verdict: d.review?.verdict ?? 'no review', issues: d.review?.issues ?? [] })),
  landing,
  integration,
}
