#!/usr/bin/env node
/**
 * flake-report.mjs — turn CI JUnit XML history into flake rates.
 *
 * Zero dependencies, Node.js >= 20. Cross-platform (no shell pipelines).
 *
 * Expected layout (see references/detection.md for how to produce it):
 *
 *   <root>/<run-id>/*.xml          JUnit XML from one CI run
 *   <root>/<run-id>/meta.json      optional: { "commit": "<sha>", "branch": "main" }
 *
 * A test is counted as FLAKY only when the same commit produced both a pass and a
 * failure. Without commit metadata the tool reports an "unstable" rate instead and
 * says so, because pass/fail across different commits is a regression, not a flake.
 *
 * Usage:
 *   node flake-report.mjs <root> [--runs 20] [--test <id>] [--require-clean] [--json]
 *
 * Exit codes:
 *   0  report produced (and, with --require-clean, the test was clean for every run)
 *   1  --require-clean was given and the test failed at least once, or too few runs
 *   2  usage or input error
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ args */

function parseArgs(argv) {
  const out = { root: null, runs: 20, test: null, requireClean: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--runs') out.runs = Number.parseInt(argv[++i], 10);
    else if (a === '--test') out.test = argv[++i];
    else if (a === '--require-clean') out.requireClean = true;
    else if (a === '--json') out.json = true;
    else if (a.startsWith('--')) fail(`unknown option: ${a}`);
    else if (out.root === null) out.root = a;
    else fail(`unexpected argument: ${a}`);
  }
  if (!out.root) fail('missing <root> directory of collected JUnit XML runs');
  if (!Number.isInteger(out.runs) || out.runs < 1) fail('--runs must be a positive integer');
  return out;
}

function fail(msg) {
  process.stderr.write(`flake-report: ${msg}\n`);
  process.exit(2);
}

/* ------------------------------------------------------- junit xml parsing */

const TESTCASE_RE = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase\s*>)/g;
const ATTR_RE = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;

function attrs(raw) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    if (m[1] !== undefined) out[m[1]] = decode(m[2]);
    else out[m[3]] = decode(m[4]);
  }
  return out;
}

function decode(s) {
  return s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** @returns {Array<{id:string, status:'pass'|'fail'|'skip', message:string}>} */
function parseJUnit(xml) {
  const cases = [];
  let m;
  TESTCASE_RE.lastIndex = 0;
  while ((m = TESTCASE_RE.exec(xml)) !== null) {
    const a = attrs(m[1]);
    const body = m[3] || '';
    const name = a.name || '(unnamed)';
    const suite = a.classname || a.class || '';
    const id = suite ? `${suite} :: ${name}` : name;
    let status = 'pass';
    let message = '';
    if (/<(failure|error)\b/.test(body)) {
      status = 'fail';
      const f = /<(?:failure|error)\b([^>]*)/.exec(body);
      message = f ? (attrs(f[1]).message || '(no message)') : '(no message)';
    } else if (/<skipped\b/.test(body)) {
      status = 'skip';
    }
    cases.push({ id, status, message: normaliseMessage(message) });
  }
  return cases;
}

/** Collapse volatile parts so identical failures group together. */
function normaliseMessage(msg) {
  return msg
    .replace(/0x[0-9a-f]+/gi, '0xHEX')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'UUID')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\S*/g, 'TIMESTAMP')
    .replace(/\b\d+(\.\d+)?(ms|s)\b/g, 'DURATION')
    .replace(/\b\d{3,}\b/g, 'N')
    .trim()
    .slice(0, 200);
}

/* ---------------------------------------------------------------- reading */

function listRuns(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    fail(`not a directory: ${root}`);
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name))
    .sort()
    .reverse(); // newest first when run ids sort lexicographically (use zero-padded ids)
}

function xmlFilesIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith('.xml')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function readRun(dir) {
  let commit = null;
  const metaPath = path.join(dir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      commit = JSON.parse(fs.readFileSync(metaPath, 'utf8')).commit ?? null;
    } catch {
      commit = null;
    }
  }
  const cases = [];
  for (const f of xmlFilesIn(dir)) {
    try {
      cases.push(...parseJUnit(fs.readFileSync(f, 'utf8')));
    } catch (err) {
      process.stderr.write(`flake-report: skipping unreadable ${f}: ${err.message}\n`);
    }
  }
  return { id: path.basename(dir), commit, cases };
}

/* -------------------------------------------------------------- analysis */

function analyse(runs) {
  /** id -> { runs, pass, fail, skip, byCommit: Map<sha, Set<status>>, messages: Map } */
  const tests = new Map();
  for (const run of runs) {
    for (const c of run.cases) {
      if (!tests.has(c.id)) {
        tests.set(c.id, { id: c.id, runs: 0, pass: 0, fail: 0, skip: 0, byCommit: new Map(), messages: new Map() });
      }
      const t = tests.get(c.id);
      t.runs += 1;
      t[c.status] += 1;
      if (run.commit) {
        if (!t.byCommit.has(run.commit)) t.byCommit.set(run.commit, new Set());
        t.byCommit.get(run.commit).add(c.status);
      }
      if (c.status === 'fail') {
        t.messages.set(c.message, (t.messages.get(c.message) ?? 0) + 1);
      }
    }
  }

  const haveCommits = runs.some((r) => r.commit);
  const rows = [...tests.values()].map((t) => {
    const conflictingCommits = [...t.byCommit.values()].filter(
      (s) => s.has('pass') && s.has('fail'),
    ).length;
    const flakeRate = haveCommits
      ? (t.byCommit.size ? conflictingCommits / t.byCommit.size : 0)
      : (t.runs ? Math.min(t.pass, t.fail) / t.runs : 0);
    return {
      id: t.id,
      runs: t.runs,
      pass: t.pass,
      fail: t.fail,
      skip: t.skip,
      conflictingCommits,
      flakeRatePct: Number((flakeRate * 100).toFixed(2)),
      metric: haveCommits ? 'flake-rate (same-commit pass+fail)' : 'instability (no commit metadata)',
      topMessages: [...t.messages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([message, count]) => ({ message, count })),
    };
  });
  rows.sort((a, b) => b.flakeRatePct - a.flakeRatePct || b.fail - a.fail);
  return { rows, haveCommits };
}

/* ----------------------------------------------------------------- main */

const opts = parseArgs(process.argv.slice(2));
const runDirs = listRuns(opts.root).slice(0, opts.runs);
if (runDirs.length === 0) fail(`no run directories under ${opts.root}`);
const runs = runDirs.map(readRun);
const { rows, haveCommits } = analyse(runs);

const selected = opts.test ? rows.filter((r) => r.id.includes(opts.test)) : rows;

if (opts.json) {
  process.stdout.write(JSON.stringify({
    root: opts.root, runsAnalysed: runs.length, commitMetadata: haveCommits, tests: selected,
  }, null, 2) + '\n');
} else {
  const flaky = selected.filter((r) => r.flakeRatePct > 5);
  process.stdout.write(`runs analysed: ${runs.length}\n`);
  process.stdout.write(`commit metadata: ${haveCommits ? 'yes' : 'NO — reporting instability, not true flakiness'}\n`);
  process.stdout.write(`tests seen: ${selected.length}   above 5% threshold: ${flaky.length}\n\n`);
  for (const r of selected.slice(0, opts.test ? selected.length : 25)) {
    if (r.fail === 0 && !opts.test) continue;
    process.stdout.write(
      `${r.flakeRatePct.toFixed(2).padStart(6)}%  ${String(r.fail).padStart(3)}F/${String(r.runs).padStart(3)}R  ${r.id}\n`,
    );
    for (const m of r.topMessages) process.stdout.write(`          x${m.count} ${m.message}\n`);
  }
}

if (opts.requireClean) {
  if (!opts.test) fail('--require-clean requires --test <id>');
  if (selected.length === 0) {
    process.stderr.write(`flake-report: no test matched "${opts.test}"\n`);
    process.exit(1);
  }
  const dirty = selected.filter((r) => r.fail > 0);
  const short = selected.filter((r) => r.runs < opts.runs);
  if (dirty.length > 0) {
    process.stderr.write(`NOT ELIGIBLE: ${dirty.length} matching test(s) failed within the window\n`);
    process.exit(1);
  }
  if (short.length > 0) {
    process.stderr.write(
      `NOT ELIGIBLE: only ${short[0].runs} clean runs recorded, ${opts.runs} required\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`ELIGIBLE: clean for ${opts.runs} consecutive runs\n`);
}
