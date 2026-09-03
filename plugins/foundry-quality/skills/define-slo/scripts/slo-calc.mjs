#!/usr/bin/env node
/**
 * slo-calc.mjs — error budget, dependency ceiling and burn-rate alert arithmetic.
 *
 * Zero dependencies, Node.js >= 20, deterministic (no clock, no randomness).
 *
 * Usage:
 *   node slo-calc.mjs --target 99.9 [--window 28] [--rps 45]
 *                     [--deps 99.95,99.9,99.99] [--latency-threshold-ms 500]
 *                     [--min-events 100] [--json]
 *
 * Prints:
 *   - error budget as a ratio, as failed events (when --rps is given) and as
 *     downtime-equivalent minutes
 *   - the dependency ceiling and whether the target is achievable behind it
 *   - the multi-window multi-burn-rate alert table with expected detection times
 *   - the minimum-event viability check per alert window
 *
 * Exit codes: 0 ok, 1 target exceeds the dependency ceiling, 2 usage error.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

function fail(msg) {
  process.stderr.write(`slo-calc: ${msg}\n`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const opts = {
  target: null, windowDays: 28, rps: null, deps: [],
  latencyThresholdMs: null, minEvents: 100, json: false,
};
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--target') opts.target = Number(argv[++i]);
  else if (a === '--window') opts.windowDays = Number(argv[++i]);
  else if (a === '--rps') opts.rps = Number(argv[++i]);
  else if (a === '--deps') opts.deps = argv[++i].split(',').map(Number).filter((n) => !Number.isNaN(n));
  else if (a === '--latency-threshold-ms') opts.latencyThresholdMs = Number(argv[++i]);
  else if (a === '--min-events') opts.minEvents = Number(argv[++i]);
  else if (a === '--json') opts.json = true;
  else fail(`unknown argument: ${a}`);
}
if (opts.target === null || !(opts.target > 0 && opts.target < 100)) {
  fail('--target must be a percentage strictly between 0 and 100, e.g. 99.9');
}
if (!(opts.windowDays > 0)) fail('--window must be a positive number of days');

/* --------------------------------------------------------------- budget */

const windowMinutes = opts.windowDays * 24 * 60;
const budgetRatio = 1 - opts.target / 100;
const budgetMinutes = windowMinutes * budgetRatio;
const validEvents = opts.rps != null ? Math.round(opts.rps * windowMinutes * 60) : null;
const budgetEvents = validEvents != null ? Math.round(validEvents * budgetRatio) : null;

/* ---------------------------------------------------- dependency ceiling */

const ceiling = opts.deps.length
  ? opts.deps.reduce((acc, d) => acc * (d / 100), 1) * 100
  : null;
const ceilingBreached = ceiling != null && opts.target > ceiling + 1e-9;

/* ------------------------------------------------------------ burn rates */

const ALERTS = [
  { burnRate: 14.4, longHours: 1, shortMinutes: 5, action: 'page' },
  { burnRate: 6, longHours: 6, shortMinutes: 30, action: 'page' },
  { burnRate: 3, longHours: 24, shortMinutes: 120, action: 'ticket' },
  { burnRate: 1, longHours: 72, shortMinutes: 360, action: 'ticket' },
];

const windowHours = opts.windowDays * 24;
const alerts = ALERTS.map((a) => {
  // fraction of the total error budget consumed if the burn rate is sustained for the long window
  const budgetFraction = (a.burnRate * a.longHours) / windowHours;
  // error rate that triggers this alert
  const triggerErrorRate = budgetRatio * a.burnRate;
  // Detection time. With a step change to an actual burn rate B_actual at t=0, the rolling
  // average over a window W crosses the threshold B_thresh at t = W * B_thresh / B_actual.
  // Worst case (B_actual == B_thresh) is therefore the full long window; a 10x burn is
  // detected in a tenth of it.
  const detectionHoursWorst = a.longHours;
  const detectionHoursAt10x = a.longHours / 10;
  const longWindowEvents = opts.rps != null ? Math.round(opts.rps * a.longHours * 3600) : null;
  const shortWindowEvents = opts.rps != null ? Math.round(opts.rps * a.shortMinutes * 60) : null;
  return {
    burnRate: a.burnRate,
    longWindow: `${a.longHours}h`,
    shortWindow: a.shortMinutes >= 60 ? `${a.shortMinutes / 60}h` : `${a.shortMinutes}m`,
    action: a.action,
    budgetConsumedPct: Number((budgetFraction * 100).toFixed(2)),
    triggerErrorRatePct: Number((triggerErrorRate * 100).toFixed(4)),
    detectionHoursWorst,
    detectionHoursAt10x: Number(detectionHoursAt10x.toFixed(3)),
    detectionFormula: 'detection = longWindow * thresholdBurnRate / actualBurnRate',
    longWindowEvents,
    shortWindowEvents,
    viable: shortWindowEvents == null ? null : shortWindowEvents >= opts.minEvents,
  };
});

/* ---------------------------------------------------------------- output */

const result = {
  target: opts.target,
  windowDays: opts.windowDays,
  latencyThresholdMs: opts.latencyThresholdMs,
  errorBudget: {
    ratio: Number(budgetRatio.toFixed(6)),
    downtimeEquivalentMinutes: Number(budgetMinutes.toFixed(1)),
    validEvents,
    failedEventsAllowed: budgetEvents,
  },
  dependencyCeiling: ceiling != null ? Number(ceiling.toFixed(4)) : null,
  ceilingBreached,
  alerts,
  minEvents: opts.minEvents,
};

if (opts.json) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${m.toFixed(1)}m`);
  process.stdout.write(`SLO target            ${opts.target}% over a ${opts.windowDays}-day rolling window\n`);
  if (opts.latencyThresholdMs != null) {
    process.stdout.write(`Latency threshold     a request slower than ${opts.latencyThresholdMs} ms is a BAD event, not a slow good one\n`);
  }
  process.stdout.write(`Error budget          ${(budgetRatio * 100).toFixed(3)}% = ${fmtMin(budgetMinutes)} downtime-equivalent\n`);
  if (budgetEvents != null) {
    process.stdout.write(`                      ${budgetEvents.toLocaleString('en-GB')} failed events out of ${validEvents.toLocaleString('en-GB')} valid events at ${opts.rps} rps\n`);
    process.stdout.write(`                      quote the event count to stakeholders; minutes are meaningless for batch systems\n`);
  }
  if (ceiling != null) {
    process.stdout.write(`\nDependency ceiling    ${ceiling.toFixed(4)}% from deps [${opts.deps.join(', ')}]\n`);
    process.stdout.write(ceilingBreached
      ? `  BREACHED: a ${opts.target}% target is unachievable behind these dependencies. Remove one from the critical path or lower the target.\n`
      : `  OK: the target leaves ${(ceiling - opts.target).toFixed(4)} percentage points of headroom for your own failures.\n`);
  } else {
    process.stdout.write('\nDependency ceiling    not computed — pass --deps; an uncomputed ceiling is the most common reason a target turns out to be fiction\n');
  }

  process.stdout.write('\nBurn-rate alerts (fire only when BOTH windows exceed the threshold)\n');
  process.stdout.write('  rate   long   short   budget   trigger error rate   detect(worst)   action   short-window events\n');
  for (const a of alerts) {
    const ev = a.shortWindowEvents == null ? '        n/a'
      : `${String(a.shortWindowEvents).padStart(11)}${a.viable ? '' : '  TOO FEW'}`;
    process.stdout.write(
      `  ${String(a.burnRate).padStart(4)}   ${a.longWindow.padStart(4)}   ${a.shortWindow.padStart(5)}   ${String(a.budgetConsumedPct + '%').padStart(6)}   ${String(a.triggerErrorRatePct + '%').padStart(18)}   ${(a.detectionHoursWorst + 'h').padStart(13)}   ${a.action.padEnd(6)} ${ev}\n`,
    );
  }
  const nonViable = alerts.filter((a) => a.viable === false);
  if (nonViable.length > 0) {
    process.stdout.write(
      `\n  ${nonViable.length} alert window(s) see fewer than ${opts.minEvents} events and are statistically invalid.\n` +
      '  Remedies in order: aggregate journeys, lengthen the windows, add a minimum-event guard,\n' +
      '  or add synthetic traffic in a SEPARATE SLI. Do not ship an alert that pages on one failure.\n',
    );
  }
  process.stdout.write('\nDetection = longWindow x thresholdBurnRate / actualBurnRate. The column shows the worst case\n(actual burn exactly at the threshold); a 10x burn is caught in a tenth of that time.\n');
  process.stdout.write('\nEvery alert needs a runbook at .foundry/runbooks/<slug>.md. Delete the raw-threshold\nalerts for the same symptom in the same change, or the noise doubles.\n');
}

process.exit(ceilingBreached ? 1 : 0);
