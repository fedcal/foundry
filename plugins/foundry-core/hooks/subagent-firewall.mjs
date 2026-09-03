#!/usr/bin/env node
/**
 * SubagentStop — enforce the context firewall.
 *
 * A subagent that returns a wall of text defeats the entire point of a separate
 * context window: the parent pays for everything the child read. This gate measures
 * the returned summary and sends the agent back to write an artifact instead.
 */
import { readHookInput, projectRoot, config, estimateTokens, decide, noOpinion, recordMetric, foundryInitialised } from '../lib/foundry.mjs';

const input = await readHookInput();
const message = String(input.last_assistant_message || '');
if (!message) noOpinion();

const root = projectRoot(input.cwd);
// SubagentStop carries no matcher, so without this guard installing foundry-core armed a hard
// token cap on every subagent return in every repository on the machine — and recordMetric below
// then created a .foundry/ tree in projects that never ran `foundry init`. Every other blocking
// gate opts in this way; this one did not.
if (!foundryInitialised(root)) noOpinion();
const cfg = config(root);
if (cfg.enforcement === 'off') noOpinion();

const HARD_LIMIT_MULTIPLIER = 3;
const tokens = estimateTokens(message);
// A null or non-numeric budget in config.json once turned the hard limit into NaN or 0,
// which denied every handoff — including a four-token one. That fix belongs in `config()`
// and now lives there: CONFIG_RULES refuses any `handoffSummaryTokenBudget` that is not a
// finite positive number and substitutes the default, so what arrives here is always
// usable. Re-checking it in this file produced a branch no input could reach — dead code
// that reads as a live guard, which is worse than no guard because it invites trust.
// The guarantee is pinned by the config-validation tests, where it is actually made.
const budget = cfg.handoffSummaryTokenBudget;
const hardLimit = budget * HARD_LIMIT_MULTIPLIER;

recordMetric(root, { kind: 'subagent_return', agent: input.agent_type, tokens });

if (tokens <= hardLimit) noOpinion();

decide('SubagentStop', 'deny',
  `Foundry context firewall: this subagent returned ~${tokens} tokens, over the ${hardLimit}-token hard limit ` +
  `(target: ${budget}).\n\nWrite the full output to the blackboard with the \`blackboard_write\` tool of the \`foundry\` MCP server, ` +
  `then reply with only:\n- the artifact path\n- a summary of at most ${budget} tokens\n- any blocking question\n\n` +
  `Do not paste file contents, diffs or long listings into your reply.`);
