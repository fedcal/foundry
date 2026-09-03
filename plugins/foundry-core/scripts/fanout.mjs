#!/usr/bin/env node
/**
 * Headless fan-out — run N independent Claude Code processes over a work list.
 *
 * For work larger than one session's context, or for CI: each item gets its own
 * process, its own context and a minimal tool allowlist. Results are collected
 * as JSON, never streamed back into a parent conversation.
 *
 *   node scripts/fanout.mjs --items files.json --prompt "Audit {{item}} for missing auth checks" \
 *                           --concurrency 4 --allowed-tools "Read,Grep,Glob" --out results.json
 *
 * Requires an authenticated `claude` CLI on PATH. Nothing here is Foundry-specific:
 * it is the mechanism the `orchestrate` skill reaches for when in-session fan-out
 * would not fit.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.prompt || !args.items) {
  console.log(`Usage: node scripts/fanout.mjs --items <file.json|-> --prompt "<template with {{item}}>" [options]

  --items         JSON file containing an array of strings or objects, or "-" to read stdin
  --prompt        Prompt template; {{item}} is replaced, {{index}} is the position
  --concurrency   Parallel processes (default 4)
  --allowed-tools Comma-separated tool allowlist passed to claude (default "Read,Grep,Glob")
  --mcp-config    Path to an MCP config file to pass through
  --model         Model to run each process on
  --out           Where to write the results JSON (default fanout-results.json)
  --dry-run       Print the commands without running them`);
  process.exit(args.help ? 0 : 1);
}

const items = JSON.parse(args.items === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args.items, 'utf8'));
if (!Array.isArray(items) || !items.length) {
  console.error('--items must contain a non-empty JSON array.');
  process.exit(1);
}

// Number('abc') -> NaN and Math.min(NaN, n) -> NaN spawned zero workers while still
// exiting 0 and reporting "N succeeded": a CI job would go green having audited nothing.
const requested = Number(args.concurrency ?? 4);
const concurrency = Number.isInteger(requested) && requested > 0 ? requested : 4;
if (args.concurrency !== undefined && concurrency !== requested) {
  console.error(`fanout: --concurrency "${args.concurrency}" is not a positive integer; using 4.`);
}
const allowedTools = args['allowed-tools'] || 'Read,Grep,Glob';
const outFile = args.out || 'fanout-results.json';

const results = new Array(items.length);
let cursor = 0;
let failures = 0;

console.error(`fanout: ${items.length} items, concurrency ${concurrency}, tools "${allowedTools}"`);

await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));

fs.writeFileSync(outFile, JSON.stringify({ items: items.length, failures, results }, null, 2) + '\n');
console.error(`fanout: wrote ${outFile} — ${items.length - failures} succeeded, ${failures} failed`);
process.exit(failures ? 1 : 0);

async function worker() {
  for (;;) {
    const index = cursor++;
    if (index >= items.length) return;
    const item = items[index];
    const label = typeof item === 'string' ? item : (item.id || item.name || `item-${index}`);
    const prompt = String(args.prompt)
      .replaceAll('{{item}}', typeof item === 'string' ? item : JSON.stringify(item))
      .replaceAll('{{index}}', String(index));

    const cliArgs = ['-p', prompt, '--output-format', 'json', '--allowedTools', allowedTools];
    if (args['mcp-config']) cliArgs.push('--mcp-config', args['mcp-config']);
    if (args.model) cliArgs.push('--model', args.model);

    if (args['dry-run']) {
      console.error(`[dry-run] claude ${cliArgs.map(quote).join(' ')}`);
      results[index] = { item: label, dryRun: true };
      continue;
    }

    try {
      const { code, stdout, stderr } = await run('claude', cliArgs);
      if (code !== 0) {
        failures += 1;
        results[index] = { item: label, ok: false, error: stderr.slice(0, 2000) || `exit ${code}` };
        console.error(`  ✗ ${label} (exit ${code})`);
        continue;
      }
      let payload;
      try { payload = JSON.parse(stdout); } catch { payload = { raw: stdout }; }
      results[index] = { item: label, ok: true, result: payload.result ?? payload };
      console.error(`  ✓ ${label}`);
    } catch (err) {
      failures += 1;
      results[index] = { item: label, ok: false, error: err.message };
      console.error(`  ✗ ${label} — ${err.message}`);
    }
  }
}

function run(cmd, cliArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cliArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => reject(new Error(err.code === 'ENOENT' ? 'the `claude` CLI was not found on PATH' : err.message)));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

function quote(s) {
  return /[\s"']/.test(s) ? JSON.stringify(s) : s;
}
