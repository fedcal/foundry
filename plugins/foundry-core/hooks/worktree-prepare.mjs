#!/usr/bin/env node
/**
 * WorktreeCreate — prepare an isolated checkout so a parallel agent is not
 * blocked by a missing environment. Any non-zero exit aborts worktree creation,
 * so this only fails on something that genuinely makes the worktree unusable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, projectRoot, recordMetric } from '../lib/foundry.mjs';

const input = await readHookInput();
const worktree = input.worktree_path;
if (!worktree || !fs.existsSync(worktree)) process.exit(0);

const root = projectRoot(input.cwd);
recordMetric(root, { kind: 'worktree_created', branch: input.branch });

// Foundry state is project-level, not worktree-level: link it so agents in the
// worktree read and write the same memory, runbooks and blackboard.
const source = path.join(root, '.foundry');
const target = path.join(worktree, '.foundry');
if (fs.existsSync(source) && !fs.existsSync(target)) {
  try {
    fs.symlinkSync(source, target, 'junction');
  } catch {
    process.stderr.write('Foundry: could not link .foundry into the worktree; agents there will start with empty memory.\n');
  }
}
process.exit(0);
