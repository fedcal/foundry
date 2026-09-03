# Levers — what actually reduces AI spend, ranked, with the risk each buys

Ranked roughly by return per unit of effort in a Foundry-shaped project. Every lever names the
file to change and the risk you accept. Do not recommend a lever without both.

**Measure first.** A lever applied to something that is not a cost driver produces disruption
and no saving, and it burns credibility you will need for the lever that matters.

---

## 1. Eliminate retry waste (`contract_violation`)

**Effort: low. Saving: pure — the tokens bought literally nothing.**

Each violation means an agent produced an artifact, `validate-contract.mjs` rejected it, and
the agent produced it again. Root causes, in the order they occur:

- The agent's `## Output contract` section does not state the schema's real constraints. The
  `estimate.v1` traps are `additionalProperties: false`, `unit` restricted to
  `hours|days|eur`, and `assumptions` with `minItems: 1`. An agent that does not know these
  will fail validation, reliably.
- The agent writes the blackboard file directly instead of calling `blackboard_write`, so it
  discovers the violation only after the `PostToolUse` hook fires.
- Required fields are described in prose rather than enumerated.

**Change:** the agent's `## Output contract` section. **Risk accepted:** none. This is a
defect fix, not a trade-off. Do it before anything else.

## 2. Right-size `model:` and `effort:` per agent

**Effort: low. Saving: often the largest single line.**

Follow AUTHORING §2 routing. Check the actual frontmatter:

```
grep -rn "^model:\|^effort:" plugins/*/agents/*.md
```

Decision rule:

```
choose the cheapest model where
  price_delta < P(error | cheaper model) × cost_of_that_error
```

| Task shape | Model | Reasoning |
|---|---|---|
| Extraction, classification, formatting, index generation, lint triage | cheap | Errors are caught mechanically, so expected cost of error is low |
| Implementation, review, tests, docs | mid | Errors caught by tests and review; iteration cost is real |
| Architecture, threat modelling, economic modelling, final synthesis | expensive | An undetected wrong answer propagates for months |

Two corollaries:

- **A cheap model needing three attempts is not cheap.** Compare cost per *accepted* output.
- **An expensive model on mechanically-checked output is waste** — the check already provides
  the reliability you are paying for.

Treat `effort` as an independent price lever: raising effort on a smaller model is sometimes
cheaper than a tier upgrade for the same quality. Measure before asserting which holds here.

**Change:** `agents/<name>.md` frontmatter. **Risk accepted:** quality regression on that
agent's outputs — must be evaluated by whoever owns the workflow, not by this skill.

## 3. Enforce the context firewall

**Effort: low. Saving: compounds, because returned tokens are re-read on every subsequent turn.**

AUTHORING §2: a reading-heavy agent writes its full output to
`.foundry/blackboard/<wave>/<agent>.json` and returns **only the path plus ≤ 300 tokens**.
A raw file dump returned to the parent is a defect, and an expensive one: it enters the parent
context and is re-sent with every following request for the rest of the session.

Detect: high `subagent_return.tokens` p80 for an agent whose job is to produce an artifact.

**Change:** the agent body; `handoffSummaryTokenBudget` in `.foundry/config.json`; the
`subagent-firewall` hook. **Risk accepted:** the parent may need a second call to fetch detail
— cheap, and usually never needed.

## 4. Prompt-cache discipline

**Effort: medium. Saving: large on repetitive, fan-out workflows; zero on one-shot sessions.**

With `w = cacheWritePerMTok/inputPerMTok − 1` and `r = cacheReadPerMTok/inputPerMTok`
(both from `pricing.json`):

```
break-even reuses  N* = (1 + w − r) / (1 − r)
```

Derivation: no cache costs `N·T·p`; cached costs `T·p(1+w) + (N−1)·T·p·r`. Setting them equal
and solving for `N` gives the expression above.

What determines whether you reach `N*`:

- **Prefix stability.** Anything that changes invalidates everything after it. Order context
  deliberately: stable system prompt and tool definitions, then stable project context, then
  volatile conversation. **A timestamp near the top of the prompt destroys the cache for the
  whole session** — this is the most common own goal in prompt-cache economics.
- **TTL.** Reuses count only while the entry lives. Long human think-time gaps mean paying the
  write premium repeatedly and never reaching `N*`.
- **Fan-out.** Parallel subagents sharing a prefix reach `N*` immediately. A single linear
  session with a large rarely-reused preamble may never reach it.

**Change:** prompt/context assembly order; skill `context: fork` usage. **Risk accepted:**
some context freshness is traded for cacheability; a stale cached fact can mislead an agent.

## 5. Trim what is always in context

**Effort: low. Saving: linear in session length — it is paid on every single request.**

- `.foundry/memory/INDEX.md` is capped at `indexTokenBudget` (default 4000) and is the only
  memory file loaded by default. Check its real size with the `token_report` MCP tool.
- Fact titles must **state the fact, not the topic** (`fact.v1` requires it). A high
  `memory_search` zero-hit rate means titles are bad, which costs twice: the failed search,
  and the eager loading people do instead once they stop trusting search.
- Expire facts. `fact.v1` has an `expires` field. A stale fact costs tokens *and* misleads.
- Prune `disallowed-tools` and preloaded `skills:` on agents that do not need them — every
  tool definition is context on every request.

**Change:** `.foundry/config.json`, fact titles via `memory_write`, agent frontmatter.
**Risk accepted:** an over-aggressive index cap hides facts the agent needed; watch the
zero-hit rate after changing it.

## 6. Scope skills and agents with `paths:`

**Effort: low. Saving: moderate.**

A skill scoped with `paths: ["src/**"]` is not retrieved for unrelated work. Unretrieved
skills cost nothing. Same principle for narrowing an agent's `tools:`.

**Change:** skill frontmatter. **Risk accepted:** an over-narrow scope means the skill is not
found when it is genuinely needed — the failure is silent, so review the scope when someone
does the work manually that a skill should have covered.

## 7. Prefer `pipeline()` over `parallel()` in workflows

**Effort: medium. Saving: situational.**

AUTHORING §1.6: use a barrier only when a stage genuinely needs every prior result at once.
`parallel()` fans out work that a pipeline could have short-circuited — if stage 1 finds the
answer, stages 2–5 were paid for and discarded.

**Change:** `workflows/<name>.js`. **Risk accepted:** longer wall-clock time. This is a real
trade: sometimes latency is worth more than the tokens. Say which you are optimising for.

---

## Levers that are usually mistakes

| Tempting lever | Why it usually backfires |
|---|---|
| Turning off the memory system | The eager-loading alternative costs more; measure both before deciding |
| Removing gates to save the hook overhead | Hooks are cheap; the rework a gate prevents is not |
| Downgrading the *final synthesis* agent | The one place where an undetected error propagates furthest |
| Shortening prompts by removing examples | Examples often reduce total tokens by preventing retries |
| Aggressive context truncation mid-session | Produces confidently wrong output; the retry costs more than the truncation saved |
| Blanket per-user token quotas | Optimises for the appearance of thrift; people work around it and you lose the measurement |

## Reporting format for a lever

```
Lever:      <one line>
File:       <exact path to change>
Measured:   <current value> [measured: <source>]
Expected:   <delta> — <how the delta was derived>
Risk:       <what you accept>
Owner:      <who decides>
Verify:     <the metric that will show whether it worked, and when to re-measure>
```

A lever without `Verify` is a suggestion, not a control. Re-run this skill after applying one
and compare against the banked `metric` fact — that is the whole point of recording baselines.
