#!/usr/bin/env node
/**
 * PreCompact — the last chance to keep what the session learned.
 * Compaction summarises the transcript; anything not written down as a fact is
 * effectively forgotten. This hook does not block: it steers the summariser.
 *
 * CHANNEL. PreCompact has no `hookSpecificOutput` member — that field is a discriminated union
 * and PreCompact is not one of its variants, so a payload shaped that way fails the runtime's
 * schema validation, is marked `outcome: "error"`, and delivers nothing. The supported channel is
 * plain stdout: the PreCompact runner joins each successful hook's stdout into the custom
 * instructions handed to the compaction summariser. So this hook writes text, not JSON.
 *
 * That also changes who the audience is. This is not context injected into the agent; it is an
 * instruction to the summariser about what must survive the summary. The wording below is
 * addressed accordingly.
 */
import { readHookInput, projectRoot, paths, activeFacts, noOpinion } from '../lib/foundry.mjs';
import fs from 'node:fs';

const input = await readHookInput();
const root = projectRoot(input.cwd);
if (!fs.existsSync(paths(root).base)) noOpinion();

const count = activeFacts(root).length;
const text =
  `Foundry compaction instruction (${input.trigger || 'auto'} trigger; project memory holds ${count} facts).\n` +
  'Preserve verbatim in the summary, because they cannot be recovered from the code afterwards: ' +
  'every decision taken in this session and the reasoning behind it; every constraint or convention ' +
  'agreed; every risk identified; every approach that was tried and rejected, with why it failed. ' +
  'Preserve any commitment made to the user, including anything deferred to a stated time.\n' +
  'Then state, as the final line of the summary, which of those are not yet written to Foundry memory, ' +
  'so the next turn can persist them with `memory_write` on the `foundry` MCP server. ' +
  'Facts survive compaction; the transcript does not.';

// Plain text, synchronously, then exit: process.exit does not flush an async pipe.
try { fs.writeSync(1, text); } catch { process.stdout.write(text); }
process.exit(0);
