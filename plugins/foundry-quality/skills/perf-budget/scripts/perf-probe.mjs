#!/usr/bin/env node
/**
 * perf-probe.mjs — zero-dependency open-model latency probe.
 *
 * Fires at a FIXED ARRIVAL RATE instead of waiting for each response, so it does not
 * under-report the tail. A closed-model generator slows down when the system slows down,
 * which removes exactly the requests that would have queued — the error is largest when
 * the system is worst. See references/measurement-pitfalls.md §1 (coordinated omission).
 *
 * Node.js >= 20, standard library only. Emits one JSON line on stdout so runs can be piped
 * and aggregated.
 *
 * Usage:
 *   node perf-probe.mjs <url> <rps> <seconds> [--warmup 10] [--label "GET /orders/{id}"]
 *
 * Output (one line):
 *   {"label":"...","url":"...","targetRps":200,"achievedRps":198.4,"sent":17856,
 *    "completed":17840,"errors":3,"errorRatio":0.00017,
 *    "p50Ms":21.4,"p95Ms":88.1,"p99Ms":142.7,"maxMs":410.2,"warmupSeconds":10}
 *
 * Exit codes: 0 measured, 1 the generator itself could not keep up (result unusable), 2 usage.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'node:http';
import https from 'node:https';

function usage(msg) {
  process.stderr.write(`perf-probe: ${msg}\nusage: node perf-probe.mjs <url> <rps> <seconds> [--warmup 10] [--label "<name>"]\n`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const url = argv[0];
const rps = Number(argv[1]);
const seconds = Number(argv[2]);
let warmup = 10;
let label = null;
for (let i = 3; i < argv.length; i += 1) {
  if (argv[i] === '--warmup') warmup = Number(argv[++i]);
  else if (argv[i] === '--label') label = argv[++i];
  else usage(`unknown argument: ${argv[i]}`);
}
if (!url || !(rps > 0) || !(seconds > 0)) usage('url, rps and seconds are required');
if (!(warmup >= 0) || warmup >= seconds) usage('--warmup must be >= 0 and shorter than the run');

let target;
try {
  target = new URL(url);
} catch {
  usage(`not a valid URL: ${url}`);
}
const client = target.protocol === 'https:' ? https : http;
const agent = new client.Agent({ keepAlive: true, maxSockets: Infinity });

const latencies = [];       // steady-state only; warm-up samples are discarded
let sent = 0;
let completed = 0;
let errors = 0;
let inFlight = 0;
let maxInFlight = 0;
const startedAt = process.hrtime.bigint();
const warmupEndsNs = BigInt(Math.round(warmup * 1e9));

function fire() {
  sent += 1;
  inFlight += 1;
  if (inFlight > maxInFlight) maxInFlight = inFlight;
  const t0 = process.hrtime.bigint();
  const req = client.request(
    { protocol: target.protocol, hostname: target.hostname, port: target.port || undefined, path: target.pathname + target.search, method: 'GET', agent },
    (res) => {
      res.resume(); // discard the body: we are measuring the server, not our own parser
      res.on('end', () => {
        inFlight -= 1;
        completed += 1;
        const elapsedSinceStart = t0 - startedAt;
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (elapsedSinceStart >= warmupEndsNs) latencies.push(ms);
        if (res.statusCode >= 500) errors += 1;   // 5xx is ours; 4xx is the caller's
      });
    },
  );
  req.on('error', () => { inFlight -= 1; errors += 1; });
  req.end();
}

const intervalMs = 1000 / rps;
const timer = setInterval(fire, intervalMs);

setTimeout(() => {
  clearInterval(timer);
  // let outstanding requests land, then report
  setTimeout(() => {
    const sorted = latencies.sort((a, b) => a - b);
    const pct = (p) => (sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(2)) : null);
    // measured over the FIRING window only; the drain period would deflate the rate
    const achievedRps = Number((sent / seconds).toFixed(2));
    const out = {
      label: label ?? `${target.pathname}`,
      url,
      targetRps: rps,
      achievedRps,
      sent,
      completed,
      errors,
      errorRatio: completed ? Number((errors / completed).toFixed(6)) : null,
      p50Ms: pct(50),
      p95Ms: pct(95),
      p99Ms: pct(99),
      maxMs: sorted.length ? Number(sorted[sorted.length - 1].toFixed(2)) : null,
      steadyStateSamples: sorted.length,
      warmupSeconds: warmup,
      maxInFlight,
    };
    agent.destroy();
    process.stdout.write(JSON.stringify(out) + '\n');
    // The generator must actually deliver the load, or the numbers describe the probe.
    if (achievedRps < rps * 0.95) {
      process.stderr.write(
        `perf-probe: achieved ${achievedRps} rps against a target of ${rps}. The generator, not the\n` +
        `system under test, was the bottleneck — the result is unusable. Lower the rate or run\n` +
        `several probes in parallel.\n`,
      );
      process.exit(1);
    }
    process.exit(0);
  }, 5000);
}, seconds * 1000);
