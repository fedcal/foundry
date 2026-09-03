#!/usr/bin/env node
/**
 * SessionStart — inject a compact project state instead of letting Claude
 * rediscover the project. Everything here is deliberately small: the whole
 * point is that this replaces, not adds to, an expensive exploration phase.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readHookInput, projectRoot, paths, config, buildIndex, listRunbooks, estimateTokens, addContext, noOpinion } from '../lib/foundry.mjs';

const input = await readHookInput();
const root = projectRoot(input.cwd);
const p = paths(root);
if (!fs.existsSync(p.base)) noOpinion();
const cfg = config(root);

const parts = ['# Foundry project state'];

if (!fs.existsSync(p.index)) buildIndex(root);
const index = fs.readFileSync(p.index, 'utf8').trim();
if (index) parts.push('', index);

const books = listRunbooks(root);
if (books.length) {
  parts.push('', '## Runbooks available', books.map((b) => `- \`${b.slug}\`${b.trigger ? ` — ${b.trigger}` : ''}`).join('\n'));
  parts.push('Before any recurring or error-prone task, call `runbook_list`/`runbook_get` on the `foundry` MCP server and follow the runbook rather than improvising.');
}

try {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean).length;
  const last = execFileSync('git', ['log', '-1', '--format=%h %s'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  parts.push('', `## Repository\nbranch \`${branch}\` · ${dirty} uncommitted file(s) · last commit ${last}`);
} catch { /* not a git repo, or git unavailable */ }

parts.push('', 'Retrieve full facts with the `foundry` MCP tool `memory_search`. Do not read `.foundry/memory/facts/` directly.');

const context = parts.join('\n');
// buildIndex fits the index inside cfg.indexTokenBudget; truncating at a hardcoded
// 1500 threw away more than half of what it had carefully kept, on every session.
const budget = Number(cfg.indexTokenBudget) > 0 ? Number(cfg.indexTokenBudget) : 4000;
if (estimateTokens(context) > budget) {
  addContext('SessionStart', context.slice(0, budget * 4) + '\n\n(truncated to protect the session token budget)');
}
addContext('SessionStart', context);
