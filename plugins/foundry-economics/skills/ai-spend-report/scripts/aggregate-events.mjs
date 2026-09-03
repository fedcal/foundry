#!/usr/bin/env node
/**
 * Foundry Economics — aggregate .foundry/metrics/events.jsonl into AI-spend facts.
 *
 * Zero dependencies, Node >= 20, cross-platform. Reads only; writes nothing.
 *
 * It reports what the metrics file actually contains and nothing more. In particular it
 * NEVER invents a token count and NEVER invents a price: money appears only when a
 * pricing.json is supplied and the relevant model entry is non-zero.
 *
 * Usage:
 *   node aggregate-events.mjs [--root <dir>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
 *                             [--pricing <path>] [--model <id>] [--format md|json]
 *
 * Exit codes: 0 ok · 2 no metrics file · 3 bad arguments
 */

import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const eventsFile = path.join(root, '.foundry', 'metrics', 'events.jsonl');

if (!fs.existsSync(eventsFile)) {
  process.stderr.write(
    `No metrics file at ${eventsFile}.\n` +
      'Foundry core writes it as sessions run. Nothing to report yet — this is not an error in the tooling.\n',
  );
  process.exit(2);
}

const since = args.since ? Date.parse(`${args.since}T00:00:00Z`) : -Infinity;
const until = args.until ? Date.parse(`${args.until}T23:59:59Z`) : Infinity;
if (Number.isNaN(since) || Number.isNaN(until)) {
  process.stderr.write('--since/--until must be YYYY-MM-DD\n');
  process.exit(3);
}

/* ------------------------------------------------------------------ parse */

const acc = {
  window: { since: args.since || null, until: args.until || null },
  linesRead: 0,
  linesMalformed: 0,
  linesInWindow: 0,
  firstTs: null,
  lastTs: null,
  byKind: {},
  agents: {},          // agent -> { runs, tokens[] }
  blackboardBytes: {}, // agent -> bytes
  sessions: new Set(),
  memorySearches: 0,
  memorySearchZeroHits: 0,
  memoryWrites: 0,
  gateBlocked: {},
  gateOverrides: 0,
  contractValid: 0,
  contractViolations: 0,
  worktrees: 0,
};

for (const line of readLines(eventsFile)) {
  acc.linesRead += 1;
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    acc.linesMalformed += 1;
    continue;
  }
  const t = Date.parse(e.ts);
  if (Number.isNaN(t) || t < since || t > until) continue;
  acc.linesInWindow += 1;
  if (acc.firstTs === null || t < acc.firstTs) acc.firstTs = t;
  if (acc.lastTs === null || t > acc.lastTs) acc.lastTs = t;
  acc.byKind[e.kind] = (acc.byKind[e.kind] || 0) + 1;

  switch (e.kind) {
    case 'subagent_return': {
      const a = e.agent || '(unnamed)';
      const rec = (acc.agents[a] ||= { runs: 0, tokens: [] });
      rec.runs += 1;
      if (Number.isFinite(e.tokens)) rec.tokens.push(e.tokens);
      break;
    }
    case 'blackboard_write': {
      const a = e.agent || '(unnamed)';
      acc.blackboardBytes[a] = (acc.blackboardBytes[a] || 0) + (Number(e.bytes) || 0);
      break;
    }
    case 'session_end':
      if (e.session) acc.sessions.add(e.session);
      break;
    case 'memory_search':
      acc.memorySearches += 1;
      if (Number(e.hits) === 0) acc.memorySearchZeroHits += 1;
      break;
    case 'memory_write':
      acc.memoryWrites += 1;
      break;
    case 'gate_blocked':
      acc.gateBlocked[e.gate || '(unnamed)'] = (acc.gateBlocked[e.gate || '(unnamed)'] || 0) + 1;
      break;
    case 'gate_override_used':
      acc.gateOverrides += 1;
      break;
    case 'contract_valid':
      acc.contractValid += 1;
      break;
    case 'contract_violation':
      acc.contractViolations += 1;
      break;
    case 'worktree_created':
      acc.worktrees += 1;
      break;
    default:
      break;
  }
}

/* -------------------------------------------------------------- derive */

const agents = Object.entries(acc.agents)
  .map(([name, r]) => ({
    agent: name,
    runs: r.runs,
    runsWithTokenCount: r.tokens.length,
    totalTokens: r.tokens.reduce((a, b) => a + b, 0),
    p50Tokens: percentile(r.tokens, 0.5),
    p80Tokens: percentile(r.tokens, 0.8),
    maxTokens: r.tokens.length ? Math.max(...r.tokens) : null,
  }))
  .sort((a, b) => b.totalTokens - a.totalTokens);

const totalReturnTokens = agents.reduce((n, a) => n + a.totalTokens, 0);
const sessions = acc.sessions.size;
const contractAttempts = acc.contractValid + acc.contractViolations;

const derived = {
  sessions,
  totalSubagentReturnTokens: totalReturnTokens,
  subagentReturnTokensPerSession: sessions ? round(totalReturnTokens / sessions) : null,
  memorySearchesPerSession: sessions ? round(acc.memorySearches / sessions) : null,
  memorySearchZeroHitRate: acc.memorySearches ? round(acc.memorySearchZeroHits / acc.memorySearches, 3) : null,
  contractViolationRate: contractAttempts ? round(acc.contractViolations / contractAttempts, 3) : null,
};

/* -------------------------------------------------------------- pricing */

const pricing = loadPricing(root, args.pricing);
let money = null;
if (pricing.ok && args.model) {
  const m = pricing.data.models?.[args.model];
  if (!m) {
    pricing.warnings.push(`Model "${args.model}" is not present in ${pricing.path}.`);
  } else if (!Number(m.outputPerMTok) && !Number(m.inputPerMTok)) {
    pricing.warnings.push(`Model "${args.model}" has only zero placeholder prices in ${pricing.path}.`);
  } else {
    // subagent_return tokens are returned context, i.e. output produced by the subagent
    // and then read as input by the parent. Both legs are shown; neither is a total spend.
    money = {
      currency: pricing.data.currency || null,
      model: args.model,
      asOf: pricing.data.asOf || null,
      subagentReturnAsOutput: round((totalReturnTokens * Number(m.outputPerMTok || 0)) / 1e6, 4),
      subagentReturnAsParentInput: round((totalReturnTokens * Number(m.inputPerMTok || 0)) / 1e6, 4),
      caveat:
        'Covers ONLY subagent return payloads. It is not total session spend: events.jsonl has no whole-session token ledger.',
    };
  }
} else if (args.model && !pricing.ok) {
  pricing.warnings.push('No pricing file found; monetary output suppressed.');
}

const report = {
  generatedFrom: eventsFile,
  window: {
    ...acc.window,
    firstEvent: acc.firstTs ? new Date(acc.firstTs).toISOString() : null,
    lastEvent: acc.lastTs ? new Date(acc.lastTs).toISOString() : null,
  },
  parsing: { linesRead: acc.linesRead, linesInWindow: acc.linesInWindow, linesMalformed: acc.linesMalformed },
  eventCounts: acc.byKind,
  agents,
  blackboardBytes: acc.blackboardBytes,
  memory: {
    searches: acc.memorySearches,
    zeroHitSearches: acc.memorySearchZeroHits,
    writes: acc.memoryWrites,
  },
  gates: { blocked: acc.gateBlocked, overridesUsed: acc.gateOverrides },
  contracts: { valid: acc.contractValid, violations: acc.contractViolations },
  derived,
  pricing: { found: pricing.ok, path: pricing.path, asOf: pricing.data?.asOf || null, warnings: pricing.warnings },
  money,
  limitations: [
    'events.jsonl is a gate-and-memory ledger, not a token ledger.',
    'subagent_return is the only token-bearing event; prompt, cache and output tokens for the main conversation are absent.',
    'Whole-session totals require a provider usage export or /cost output supplied by a human.',
    'Feature-level attribution is not available from this file alone; join on branch name and label it a heuristic.',
  ],
};

process.stdout.write(args.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderMarkdown(report));
process.exit(0);

/* -------------------------------------------------------------- helpers */

function parseArgs(argv) {
  const out = { format: 'md' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function* readLines(file) {
  // events.jsonl is append-only and small; a single read keeps this dependency-free.
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split('\n')) {
    if (line.trim()) yield line;
  }
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[idx];
}

function round(n, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function loadPricing(projectRoot, explicit) {
  const candidates = [
    explicit,
    path.join(projectRoot, '.foundry', 'economics', 'pricing.json'),
    path.join(projectRoot, 'pricing.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    const abs = path.isAbsolute(p) ? p : path.join(projectRoot, p);
    if (!fs.existsSync(abs)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
      const warnings = [];
      if (!data.asOf) warnings.push(`${abs} has no "asOf" date; staleness cannot be checked.`);
      if (!data.source) warnings.push(`${abs} has no "source"; the origin of these prices is unverifiable.`);
      return { ok: true, path: abs, data, warnings };
    } catch (err) {
      return { ok: false, path: abs, data: null, warnings: [`${abs} is not valid JSON: ${err.message}`] };
    }
  }
  return {
    ok: false,
    path: null,
    data: null,
    warnings: [
      'No pricing.json found (.foundry/economics/pricing.json or ./pricing.json). Token counts only; no monetary figures.',
    ],
  };
}

function renderMarkdown(r) {
  const L = [];
  L.push('# AI spend — measured from events.jsonl', '');
  if (!r.pricing.found) {
    L.push(
      '> **No `pricing.json` found in this project.** All figures below are token counts only;',
      '> monetary values are `<<UNPRICED>>`. Create `.foundry/economics/pricing.json` from',
      '> `references/pricing.template.json` and fill it from your provider\'s current published',
      '> pricing to get costs.',
      '',
    );
  }
  L.push(`- Source: \`${r.generatedFrom}\``);
  L.push(`- Window: ${r.window.since || 'start'} .. ${r.window.until || 'now'}`);
  L.push(`- Events in window: ${r.parsing.linesInWindow} of ${r.parsing.linesRead}${r.parsing.linesMalformed ? ` (${r.parsing.linesMalformed} malformed lines skipped)` : ''}`);
  L.push(`- Sessions observed (session_end events): ${r.derived.sessions}`, '');

  L.push('## Per-agent return tokens', '');
  if (!r.agents.length) {
    L.push('No `subagent_return` events in the window.', '');
  } else {
    L.push('| agent | runs | runs with token count | total tokens | p50 | p80 | max |');
    L.push('|---|---|---|---|---|---|---|');
    for (const a of r.agents) {
      L.push(`| ${a.agent} | ${a.runs} | ${a.runsWithTokenCount} | ${a.totalTokens} | ${a.p50Tokens ?? '—'} | ${a.p80Tokens ?? '—'} | ${a.maxTokens ?? '—'} |`);
    }
    L.push('', 'Use the **p80** when setting a token budget for an agent, not the mean.', '');
  }

  L.push('## Waste signals', '');
  L.push(`- Contract violations: ${r.contracts.violations} of ${r.contracts.valid + r.contracts.violations} artifact writes (rate ${r.derived.contractViolationRate ?? '—'}) — each one is a rejected artifact that had to be produced twice.`);
  L.push(`- Memory searches returning nothing: ${r.memory.zeroHitSearches} of ${r.memory.searches} (rate ${r.derived.memorySearchZeroHitRate ?? '—'}) — pure cost; usually means facts are badly titled.`);
  L.push(`- Gate overrides used: ${r.gates.overridesUsed}`);
  L.push('');

  L.push('## Money', '');
  if (r.money) {
    L.push(`- Model: \`${r.money.model}\` · prices as of ${r.money.asOf || 'UNKNOWN DATE'} · currency ${r.money.currency || 'UNSPECIFIED'}`);
    L.push(`- Subagent return payloads priced as output: ${r.money.subagentReturnAsOutput}`);
    L.push(`- Same payloads priced as parent input: ${r.money.subagentReturnAsParentInput}`);
    L.push(`- ${r.money.caveat}`);
  } else {
    L.push('`<<UNPRICED>>` — supply `--model <id>` and a populated `pricing.json`.');
  }
  L.push('');

  if (r.pricing.warnings.length) {
    L.push('## Pricing warnings', '', ...r.pricing.warnings.map((w) => `- ${w}`), '');
  }
  L.push('## Limitations of this data', '', ...r.limitations.map((l) => `- ${l}`), '');
  return L.join('\n');
}
