#!/usr/bin/env node
/**
 * SessionEnd — record one telemetry line. All SessionEnd hooks share a 1.5s
 * budget, so this does the minimum and never touches the network.
 */
import fs from 'node:fs';
import { readHookInput, projectRoot, paths, recordMetric } from '../lib/foundry.mjs';

const input = await readHookInput();
const root = projectRoot(input.cwd);
if (!fs.existsSync(paths(root).base)) process.exit(0);
// The SessionEnd payload field is `reason` (clear|resume|logout|prompt_input_exit|other).
// `end_reason` is not a field Claude Code has ever sent, so reading it recorded "other" on
// every session ever and threw the real value away. It is kept only as a second choice so
// the hook keeps working if a caller (or an older contract test) still sends the old name.
recordMetric(root, { kind: 'session_end', reason: input.reason || input.end_reason || 'other', session: input.session_id });
process.exit(0);
