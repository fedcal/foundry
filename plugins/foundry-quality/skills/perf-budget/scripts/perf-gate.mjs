#!/usr/bin/env node
/**
 * perf-gate.mjs — blocking CI gate for performance budgets.
 *
 * Fails when a metric breaches its absolute budget, or when it regresses beyond the
 * tolerance against the MEDIAN OF THE LAST 7 RUNS. Median over a week, never the single
 * previous run: single-run comparison is noise-driven and teaches the team to re-run
 * instead of investigating.
 *
 * The tolerance is derived from the measured noise floor of the environment
 * (see SKILL.md Step 4): tolerance = max(10%, noiseFloorPercent x 1.5). A gate tighter
 * than the noise floor cries wolf and is removed within two sprints.
 *
 * Node.js >= 20, standard library only, deterministic (no clock).
 *
 * Usage:
 *   node perf-gate.mjs <budgets.json> <result.json> <history-dir/> [--json]
 *
 * budgets.json:
 *   { "noiseFloorPercent": 6.2,
 *     "budgets": [
 *       { "id": "orders-read-p99", "target": "GET /orders/{id}", "metric": "p99Ms",
 *         "budget": 250, "baseline": 180, "rationale": "...", "owner": "..." }
 *     ] }
 *
 * result.json / history/*.json: { "<target>": { "<metric>": <number>, ... }, ... }
 *
 * Exit codes: 0 pass, 1 gate failed, 2 usage/input error.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

function bail(msg) {
  process.stderr.write(`perf-gate: ${msg}\n`);
  process.exit(2);
}

const args = process.argv.slice(2).filter((a) => a !== '--json');
const asJson = process.argv.includes('--json');
const [budgetsPath, resultPath, historyDir] = args;
if (!budgetsPath || !resultPath || !historyDir) {
  bail('usage: node perf-gate.mjs <budgets.json> <result.json> <history-dir/>');
}

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    bail(`cannot read ${p}: ${err.message}`);
  }
};

const cfg = readJson(budgetsPath);
const result = readJson(resultPath);
if (!Array.isArray(cfg.budgets) || cfg.budgets.length === 0) bail('budgets.json has no "budgets" array');
if (typeof cfg.noiseFloorPercent !== 'number') {
  bail('budgets.json is missing "noiseFloorPercent" — measure it before gating (SKILL.md Step 4)');
}

const history = existsSync(historyDir) && statSync(historyDir).isDirectory()
  ? readdirSync(historyDir).filter((f) => f.endsWith('.json')).sort().slice(-7)
    .map((f) => readJson(path.join(historyDir, f)))
  : [];

const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const tol = Math.max(0.10, (cfg.noiseFloorPercent / 100) * 1.5);
const failures = [];
const rows = [];

if (cfg.noiseFloorPercent > 20) {
  failures.push(
    `environment noise floor is ${cfg.noiseFloorPercent}% — too noisy to gate on percentiles. ` +
    'Gate on error ratio and throughput only, and file the runner instability as a finding.v1.',
  );
}

for (const b of cfg.budgets) {
  if (!b.rationale) failures.push(`${b.id}: no rationale — a budget nobody can defend gets renegotiated away`);
  if (!b.owner) failures.push(`${b.id}: no owner`);

  const actual = result[b.target]?.[b.metric];
  if (actual == null) {
    failures.push(`${b.id}: metric ${b.metric} not reported for ${b.target} — a budget you cannot measure is not a budget`);
    rows.push({ id: b.id, status: 'missing' });
    continue;
  }

  const past = median(history.map((h) => h[b.target]?.[b.metric]).filter((v) => v != null));
  const regressionPct = past != null && past !== 0 ? Number(((actual / past - 1) * 100).toFixed(1)) : null;
  const overBudget = actual > b.budget;
  const regressed = past != null && actual > past * (1 + tol);

  if (overBudget) {
    failures.push(`${b.id}: ${b.metric}=${actual} exceeds budget ${b.budget} (baseline ${b.baseline ?? 'n/a'})`);
  }
  if (regressed) {
    failures.push(`${b.id}: ${b.metric}=${actual} is ${regressionPct}% above the 7-run median ${past} (tolerance ${(tol * 100).toFixed(1)}%)`);
  }
  rows.push({
    id: b.id, target: b.target, metric: b.metric, actual, budget: b.budget,
    median7: past, regressionPct, tolerancePct: Number((tol * 100).toFixed(1)),
    status: overBudget || regressed ? 'fail' : 'pass',
  });
}

if (asJson) {
  process.stdout.write(JSON.stringify({
    tolerancePct: Number((tol * 100).toFixed(1)), historyRuns: history.length, rows, failures,
  }, null, 2) + '\n');
} else if (failures.length) {
  process.stderr.write('PERF GATE FAILED\n' + failures.map((f) => `  - ${f}`).join('\n') + '\n');
  process.stderr.write(
    '\nDo not raise the budget to make this green. Attribute the regression to a named frame\n' +
    'or query first (performance-engineer), then fix it or record the accepted trade-off with\n' +
    'the product owner named.\n',
  );
} else {
  process.stdout.write(
    `perf gate OK: ${cfg.budgets.length} budgets, tolerance ${(tol * 100).toFixed(1)}%, ` +
    `compared against ${history.length} historical run(s)\n`,
  );
  if (history.length < 3) {
    process.stdout.write('note: fewer than 3 historical runs — regression detection is not yet meaningful\n');
  }
}

process.exit(failures.length ? 1 : 0);
