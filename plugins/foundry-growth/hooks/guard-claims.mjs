#!/usr/bin/env node
/**
 * PreToolUse(Write|Edit) — advisory substantiation gate for outbound copy.
 *
 * foundry-growth produces the text strangers read first: landing pages, launch posts, decks,
 * press notes, profiles, outreach. The one failure that damages a user most is publishing a
 * claim they cannot back. This gate catches it at the moment of writing, while the evidence
 * (or its absence) is still in reach.
 *
 * Design constraints, all deliberate:
 *  - It NEVER denies. Every hit is `ask`, because "unsubstantiated" is a judgement the author
 *    can settle in one sentence and a hook cannot. A gate that blocks honest copy gets disabled,
 *    and a disabled gate catches nothing.
 *  - It only looks at outbound copy. Source, tests, fixtures and the Foundry authoring tree
 *    contain these exact words as data (this file included) and must never be flagged.
 *  - On anything it does not understand — unparseable stdin, an unexpected shape, a missing
 *    field — it exits 0 in silence. A hook that crashes on a payload is worse than no hook.
 *  - Node standard library only, and no import from foundry-core: a plugin may be installed
 *    without its siblings, so this file is entirely self-contained.
 *
 * Opt-in follows the kernel convention in plugins/foundry-core/hooks/guard-write.mjs:
 * silent until `.foundry/` exists (i.e. `foundry init` has run), off when
 * `.foundry/config.json` sets `enforcement: "off"` or `growth.claimGuard: false`, and
 * suppressed by an active, expiring override on gate `growth-claim-substantiation`.
 *
 * ---------------------------------------------------------------------------------------
 * WHEN NOT TO RELY ON THIS, and who owns what it excludes
 *
 * This is a lexical tripwire on five surface patterns, not a fact-checker. It cannot tell a
 * true "40% faster" from a false one; it can only notice that no source is standing next to
 * it. Treat a silent run as "nothing obvious", never as "substantiated".
 *
 *  - It does NOT judge whether a figure is arithmetically right. Financial projections, unit
 *    economics, break-even, NPV/IRR and TCO belong to foundry-economics (business-case-analyst,
 *    cost-engineer). Growth writes the argument; economics writes the numbers.
 *  - It does NOT give a legal opinion, and deliberately asserts no statute or article number.
 *    Marketing-consent, GDPR for a contact list, advertising-claims law, endorsement and
 *    sponsorship disclosure go to foundry-legal — flag and hand over, never improvise. The
 *    standard this file actually enforces is in-repository: AUTHORING.md §5 and the honesty
 *    rules stated in the foundry-growth skills (no unverifiable external assertion, no
 *    fabricated social proof, every claim cites an artifact).
 *  - It does NOT read README, the documentation site or technical writing (foundry-research),
 *    CONTRIBUTING, governance or ADRs (foundry-oss, foundry-pmo), or roadmap and delivery
 *    reporting (foundry-pmo): none of those paths satisfy `inScope`. The one honest exception
 *    is a release note filed under a `launch/` directory, which does match — the path says
 *    outbound even though the artifact belongs to foundry-oss:release-communicator. Approve it,
 *    or move the file out of `launch/`.
 *  - It does NOT scan source, tests or fixtures — those belong to foundry-dev, and a test
 *    asserting that "trusted by" is refused must not itself be flagged, so code extensions
 *    never match and the excluded-path list covers test, spec and fixture trees.
 *  - It does NOT audit an outreach list for consent, and cannot: it sees one file write, not
 *    a recipient set. Scraped personal data, unsolicited bulk mail and identical mass-automated
 *    messages are refused by the growth skills by name, not caught here.
 *  - It does NOT distinguish a claim from a quotation of one. A positioning document that
 *    quotes "trusted by 10,000 developers" as an example of what not to write will be flagged;
 *    that is the correct trade for a lexical gate with no parser. Approve it and move on.
 *
 * VERIFIABLE BEHAVIOUR CONTRACT — each line is checkable by piping a payload into this file:
 *  1. `permissionDecision` is `ask` or the hook is silent. It is never `deny`, and never any
 *     value outside the enum allow|deny|ask|defer verified in Claude Code 2.1.250.
 *  2. Exit code is 0 on every input, valid or not; stderr is always empty.
 *  3. Malformed, empty, non-object or unexpectedly shaped stdin produces zero bytes of stdout.
 *  4. An in-scope file with no substantiation risk produces zero bytes of stdout.
 *  5. An out-of-scope path produces zero bytes of stdout even when it contains every trigger
 *     phrase in this file.
 *  6. At most 5 fragments are quoted, each at most 96 characters, each with a named remedy,
 *     and no single rule takes all 5 slots while another rule has an unreported finding.
 *  7. A 12 MB payload completes well inside the 10 s hooks.json timeout: at most 200_000
 *     characters are ever pattern-matched.
 *  8. There is no minimum text length: a 17-character write ("Trusted by Google") still fires.
 *  9. Silent unless `.foundry/` exists; silent under enforcement "off", growth.claimGuard
 *     false, or an unexpired override; still firing under an expired or expiry-less override.
 *
 * DEGRADATION: there is nothing to degrade to. The hook has no dependency on foundry-core,
 * on an MCP server, on `gh`, on network access or on the superpowers plugin. Every failure
 * mode it has — unreadable config, unwritable metrics, an unparsable payload — resolves to
 * silence and exit 0, which is the same as not being installed.
 */

import fs from 'node:fs';
import path from 'node:path';

const GATE = 'growth-claim-substantiation';
const MAX_SCAN = 200_000;   // chars actually pattern-matched; bounds worst-case work
const MAX_FINDINGS = 5;     // the reason string stays readable, so it stays read
const FRAGMENT_CHARS = 96;  // per quoted fragment
const WINDOW = 140;         // chars either side of a number searched for its citation

/* ------------------------------------------------------------------ scoping */

/**
 * Outbound copy lives under one of these path segments, or carries one of these filename
 * markers. Everything else is out of scope by construction — this is the whole reason the
 * hook can afford aggressive patterns without becoming noise.
 */
const OUTBOUND_DIR = /(^|\/)(growth|marketing|launch|pitch|press|deck|decks|campaign|campaigns|outreach|landing|fundraising|brand)(\/|$)/;
const OUTBOUND_FILE = /(landing[-_.]?page|launch[-_.]?post|press[-_.]?release|pitch|one[-_.]?pager|announcement|testimonial|prospectus|sales[-_.]?copy|ad[-_.]?copy|positioning|personal[-_.]?brand|investor[-_.]?update)/i;

/** Code, tests, fixtures and Foundry's own authoring tree. Never scanned. */
const EXCLUDED_PATH = /(^|\/)(node_modules|\.git|\.foundry|plugins|scripts|site|dist|build|coverage|vendor|test|tests|__tests__|spec|fixtures|snapshots|examples)(\/|$)/;

/** Prose only. A .ts or .py file under growth/ is code about growth, not copy. */
const PROSE_EXT = new Set(['.md', '.mdx', '.markdown', '.txt', '.html', '.htm', '.rst', '.adoc', '.tex']);

function inScope(rel) {
  if (!rel || rel.startsWith('..')) return false;           // outside the project root
  if (EXCLUDED_PATH.test(rel)) return false;
  if (!PROSE_EXT.has(path.extname(rel).toLowerCase())) return false;
  return OUTBOUND_DIR.test(rel) || OUTBOUND_FILE.test(path.basename(rel));
}

/* ---------------------------------------------------------------- detectors */

/**
 * A quantitative claim is publishable when its source sits next to it. This is what
 * "next to it" is allowed to look like: an external URL, a source/measured/checked marker,
 * a footnote, a named benchmark, or a date that is explicitly the date of measurement.
 *
 * Two signals that look like citations were deliberately removed after they were shown to
 * silence the gate on exactly the file it exists for:
 *  - a bare `](` markdown link: a landing page's nav link `[Docs](/docs)` sitting near
 *    "10x faster" is not that number's source. An external link still qualifies, because
 *    `[text](https://…)` contains `https://` and matches on that.
 *  - a bare ISO date: `# Launch 2026-08-20` above "we are 10x faster" is a launch date, not
 *    a measurement date. A date now counts only when a verification verb introduces it.
 */
const CITED = /https?:\/\/|\bsources?\s*[:=]|\bcited\b|\bmeasured\b|\bchecked\s*[:=]|\bbenchmark|\bevidence\b|\baccording to\b|\[\^|\b(?:as of|measured on|counted on|checked on|verified on|sampled on)\s+\d{4}-\d{2}-\d{2}\b/i;

/**
 * Benign collocations that would otherwise trip the superlative rule, including the
 * negated forms: a positioning document that says "we are not the fastest" is doing
 * exactly what this vertical asks for and must not be punished for it.
 */
const BENIGN_SUPERLATIVE = /best[- ]effort|best practice|at best|best of|best[- ]case|guaranteed to fail|\bnot\s+(?:the\s+)?(?:best|fastest|cheapest|easiest|simplest|only)\b|\bno\s+(?:ranking|comparison)\b/i;

/** A forward-looking sentence is fine once it is labelled as one. */
const LABELLED_PROJECTION = /\bprojection|\bprojected\b|\bestimat|\bforecast|\bwe expect\b|\bassum|\btarget\b|\bhypothes|\bscenario\b/i;

/**
 * Every pattern is linear-time by construction: bounded repetition, no nested quantifiers,
 * no alternation inside a repeated group. `g` for enumeration, `i` where prose case varies.
 */
const RULES = [
  {
    id: 'unsourced-number',
    label: 'a quantitative claim with no source, artifact or date beside it',
    remedy:
      'Cite the artifact that produced the number — a benchmark script and the machine it ran on, ' +
      'a counted list, a command whose output you actually read — with the date it was measured, in the ' +
      'same sentence. If no such artifact exists in this repository, cut the number; do not soften it into ' +
      'a vaguer version of the same unverified claim. If the figure is a projection rather than a ' +
      'measurement, that is a different fix: link the model or assumption set it comes out of, and let ' +
      'foundry-economics (business-case-analyst) own the arithmetic.',
    patterns: [
      /\b\d{1,3}(?:\.\d{1,2})?\s?%/g,
      /\b\d{1,4}(?:\.\d{1,2})?x\b/gi,
      /[$€£]\s?\d[\d,.]{0,15}(?:\s?[kmb]\b)?/gi,
      /\b(?:over|more than|upwards of)?\s?\d[\d,.]{0,12}(?:\s?[km]\+?)?\s+(?:users?|customers?|downloads?|installs?|stars?|developers?|companies|teams?|subscribers?|sign-?ups?|readers?|clients?)\b/gi,
    ],
    // A number is only a finding when nothing around it says where it came from.
    accept: (text, at, len) => !CITED.test(text.slice(Math.max(0, at - WINDOW), at + len + WINDOW)),
  },
  {
    id: 'unqualified-superlative',
    label: 'a superlative or absolute with no comparison behind it',
    remedy:
      'Name the comparison set, name the measurement that ranks you first in it, and link the artifact ' +
      'holding the result. Hedging is not a fix: "one of the fastest" with no benchmark asserts the same ' +
      'ranking as "the fastest". With no comparison artifact, cut the claim and say what the thing does.',
    patterns: [
      /\b(?:the\s+)?(?:best|fastest|cheapest|easiest|simplest|most\s+(?:powerful|advanced|secure|reliable|complete))\b/gi,
      /\bthe\s+only\b/gi,
      /#1\b|\bnumber\s+one\b/gi,
      /\bworld[- ]?class\b|\bunbeatable\b|\bindustry[- ]leading\b|\bstate[- ]of[- ]the[- ]art\b/gi,
      /\bguaranteed\b|\bzero[- ]risk\b|\brisk[- ]free\b|\b100%\s+(?:safe|secure|reliable|accurate)\b/gi,
      /\bnever\s+fails\b|\balways\s+(?:works|wins|correct|safe|available|up)\b/gi,
    ],
    accept: (text, at, len) => !BENIGN_SUPERLATIVE.test(text.slice(Math.max(0, at - 24), at + len + 24)),
  },
  {
    id: 'borrowed-credibility',
    label: 'credibility borrowed from people or brands who may not have agreed to lend it',
    remedy:
      'Each named user, logo, quote or press mention needs written permission on file and a link to the ' +
      'real thing — the actual post, the actual customer, the actual article. Invented testimonials, logos ' +
      'of non-users and unearned "as seen in" lines are refused, not rewritten: unlike an overstatement ' +
      'there is no honest smaller version of them. Consent for the contact list, endorsement disclosure ' +
      'and advertising-claims law belong to foundry-legal (privacy-engineer); hand them over rather than ' +
      'reasoning about them here.',
    patterns: [
      /\btrusted by\b/gi,
      /\bused by\s+(?:\d|thousands|hundreds|millions|over\b|more than\b|top\b|leading\b|teams? at\b|engineers? at\b)/gi,
      /\bas seen (?:in|on)\b|\bfeatured (?:in|on)\b/gi,
      /\bbacked by\b|\bin partnership with\b|\bendorsed by\b/gi,
      /\blogo (?:wall|list|strip)\b|\bcustomer logos\b/gi,
      /[“”"][^“”"\n]{20,240}[“”"]\s*[—–-]{1,2}\s*[A-Z][a-zA-Z.]/g,
    ],
  },
  {
    id: 'manufactured-urgency',
    label: 'urgency or scarcity that has to be true to be printable',
    remedy:
      'A deadline is publishable only if you will enforce it, and a remaining count only if you counted. ' +
      'If the date will pass without consequence, or nobody counted what is left, delete the line. Where ' +
      'something genuinely is limited — your own review hours, one cohort, one venue — say which, and why ' +
      'it is limited. That smaller true version is the one to ship.',
    patterns: [
      /\blimited\s+(?:spots?|seats?|places?|availability|time)\b/gi,
      /\bonly\s+\d{1,5}\s+(?:left|remaining|spots?|seats?|places?)\b/gi,
      /\boffer ends\b|\bends (?:today|tonight|tomorrow|soon)\b|\bexpires (?:today|tonight|soon)\b/gi,
      /\bact now\b|\blast chance\b|\bhurry\b|\bdon'?t miss out\b|\bwhile supplies last\b/gi,
      /\bcountdown\b|\bspots? (?:are )?filling (?:up )?fast\b/gi,
    ],
  },
  {
    id: 'forward-looking-as-fact',
    label: 'a prediction written in the grammar of a fact',
    remedy:
      'Label it a projection in the sentence itself and state the assumptions it rests on, or move the ' +
      'figure to foundry-economics (business-case-analyst) and cite its artifact: growth writes the ' +
      'argument, economics writes the arithmetic. Written in the present tense this is not a forecast but ' +
      'a promise, and it will be read as one.',
    patterns: [
      /\bwill\s+(?:save|reduce|cut|double|triple|increase|eliminate|guarantee|earn you|make you|pay for itself)\b/gi,
      /\bis going to\s+(?:be|become|change|replace)\b/gi,
      /\byou will\s+(?:save|get|see|earn|gain)\b/gi,
      /\bby\s+20\d{2},?\s+(?:we|this|the market)\s+will\b/gi,
    ],
    accept: (text, at, len) => !LABELLED_PROJECTION.test(text.slice(Math.max(0, at - WINDOW), at + len + WINDOW)),
  },
];

/**
 * Collect at most MAX_FINDINGS hits PER RULE. The cap is deliberately per rule rather than
 * global: a landing page carrying thirty unsourced percentages would otherwise exhaust a
 * global budget on rule one and never reach the fabricated testimonial underneath it, which
 * is the more damaging of the two.
 */
function scan(text) {
  const findings = [];
  const seen = new Set();
  for (const rule of RULES) {
    let taken = 0;
    for (const re of rule.patterns) {
      if (taken >= MAX_FINDINGS) break;
      for (const m of text.matchAll(re)) {
        const raw = m[0];
        if (!raw || typeof m.index !== 'number') continue;
        if (rule.accept && !rule.accept(text, m.index, raw.length)) continue;
        const fragment = excerpt(text, m.index, raw.length);
        const key = `${rule.id}:${fragment.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ rule, fragment });
        taken += 1;
        if (taken >= MAX_FINDINGS) break;
      }
    }
  }
  return findings;
}

/** The match plus just enough sentence around it to be recognisable, on one line. */
function excerpt(text, at, len) {
  const from = Math.max(0, at - 24);
  const slice = text.slice(from, at + len + 48).replace(/\s+/g, ' ').trim();
  return slice.length > FRAGMENT_CHARS ? `${slice.slice(0, FRAGMENT_CHARS - 1)}…` : slice;
}

/* -------------------------------------------------------------- hook plumbing */

/**
 * Read stdin completely. readFileSync(0) is synchronous and reliable on POSIX pipes; the
 * async iterator is the Windows-safe fallback. Either way, failure yields '' rather than throwing.
 */
async function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    try {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      return Buffer.concat(chunks).toString('utf8');
    } catch {
      return '';
    }
  }
}

/**
 * process.exit does not flush an asynchronous stdout pipe, so a decision written with
 * process.stdout.write can be truncated or lost — and a lost decision makes this gate a
 * silent no-op.
 *
 * writeSync cannot be interrupted by process.exit, but it can still return a short count on
 * a pipe whose buffer is full, and a truncated JSON object is not a decision — Claude Code
 * reports it as unparseable hook output and continues. So the write is looped until the whole
 * buffer is gone, with EAGAIN retried a bounded number of times rather than spun on forever.
 */
function emit(payload) {
  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  let written = 0;
  let stalls = 0;
  while (written < buf.length && stalls < 1000) {
    try {
      const n = fs.writeSync(1, buf, written, buf.length - written);
      if (n > 0) { written += n; stalls = 0; } else stalls += 1;
    } catch (e) {
      if (e && (e.code === 'EAGAIN' || e.code === 'EINTR')) { stalls += 1; continue; }
      try { process.stdout.write(buf.subarray(written)); } catch { /* nothing else to try */ }
      break;
    }
  }
  process.exit(0);
}

function silent() {
  process.exit(0);
}

/** Same defaults and same file as the kernel: `.foundry/config.json`. */
function readConfig(root) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, '.foundry', 'config.json'), 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** An override applies only while it is unexpired; one with no expiry never applied at all. */
function overridden(root, gateId) {
  try {
    const all = JSON.parse(fs.readFileSync(path.join(root, '.foundry', 'overrides.json'), 'utf8'));
    const entry = (all.overrides || []).find((o) => o && o.gate === gateId);
    if (!entry || !entry.expires) return false;
    return entry.expires >= new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

/** Walk up for `.foundry` or `.git`, exactly as foundry-core's projectRoot does. */
function projectRoot(cwd) {
  const start = cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.foundry')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function recordMetric(root, event) {
  try {
    const dir = path.join(root, '.foundry', 'metrics');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'events.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
  } catch {
    /* telemetry must never break a session */
  }
}

/**
 * The text about to enter the file, per tool. Verified against the tool schemas in
 * Claude Code 2.1.250:
 *   Write — { file_path, content }
 *   Edit  — { file_path, old_string, new_string, replace_all }, and a batch form
 *           { file_path, edits: [{ old_string, new_string, replace_all }] }
 * For an Edit only the newly introduced lines count: an existing claim being re-indented is
 * not a new claim, and re-asking about it every time trains the user to click through.
 */
function newText(toolName, ti) {
  if (toolName === 'Write') return typeof ti.content === 'string' ? ti.content : '';
  if (toolName !== 'Edit') return '';
  const pairs = Array.isArray(ti.edits)
    ? ti.edits.filter((e) => e && typeof e === 'object')
    : [{ old_string: ti.old_string, new_string: ti.new_string }];
  const added = [];
  for (const e of pairs) {
    if (typeof e.new_string !== 'string') continue;
    const before = new Set(String(e.old_string ?? '').split('\n').map((l) => l.trim()));
    for (const line of e.new_string.split('\n')) {
      if (!before.has(line.trim())) added.push(line);
    }
  }
  return added.join('\n');
}

/* -------------------------------------------------------------------- main */

try {
  const raw = (await readStdin()).trim();
  if (!raw) silent();

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    silent();
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) silent();
  if (input.hook_event_name && input.hook_event_name !== 'PreToolUse') silent();

  const toolName = typeof input.tool_name === 'string' ? input.tool_name : '';
  if (toolName !== 'Write' && toolName !== 'Edit') silent();

  const ti = input.tool_input;
  if (!ti || typeof ti !== 'object' || Array.isArray(ti)) silent();
  const file = typeof ti.file_path === 'string' ? ti.file_path : '';
  if (!file) silent();

  const root = projectRoot(typeof input.cwd === 'string' ? input.cwd : '');

  // Opt-in, kernel convention: nothing happens until `foundry init` created `.foundry/`.
  if (!fs.existsSync(path.join(root, '.foundry'))) silent();
  const cfg = readConfig(root);
  if (cfg.enforcement === 'off') silent();
  if (cfg.growth && cfg.growth.claimGuard === false) silent();
  if (overridden(root, GATE)) silent();

  const rel = path.relative(root, path.resolve(root, file)).replace(/\\/g, '/');
  if (!inScope(rel)) silent();

  // No minimum length. An earlier draft skipped anything under 20 characters, which made the
  // hook silent on "Trusted by Google" (17 chars) — a fabricated endorsement, the single most
  // damaging thing this gate exists to catch, and the shortest.
  const text = newText(toolName, ti).slice(0, MAX_SCAN);
  if (!text) silent();

  const findings = scan(text);
  if (!findings.length) silent();

  // One finding per rule first, so five slots never all go to the same rule.
  const byRule = new Map();
  for (const f of findings) if (!byRule.has(f.rule.id)) byRule.set(f.rule.id, f);
  const chosen = [...byRule.values()];
  for (const f of findings) {
    if (chosen.length >= MAX_FINDINGS) break;
    if (!chosen.includes(f)) chosen.push(f);
  }
  const shown = chosen.slice(0, MAX_FINDINGS);

  recordMetric(root, { kind: 'gate_escalated', gate: GATE, file: rel, findings: shown.map((f) => f.rule.id) });

  const body = shown
    .map((f, i) => `${i + 1}. [${f.rule.id}] ${f.rule.label}\n   Found: "${f.fragment}"\n   Publishable when: ${f.rule.remedy}`)
    .join('\n\n');

  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `Foundry growth gate \`${GATE}\` — ${shown.length} substantiation risk${shown.length === 1 ? '' : 's'} ` +
        `in outbound copy at \`${rel}\`.\n` +
        'Advisory, not a block: approve if each one already cites evidence that exists in this repository.\n\n' +
        `${body}\n\n` +
        'Retracting a published claim costs more than cutting an unpublished one.\n' +
        `To suspend this gate with a recorded reason and an expiry, add to \`.foundry/overrides.json\`:\n` +
        `{"overrides":[{"gate":"${GATE}","reason":"<why>","expires":"<YYYY-MM-DD>"}]}\n` +
        `An entry with no \`expires\` is ignored, by the same kernel rule that governs every Foundry gate. ` +
        `To turn it off permanently instead, set \`{"growth":{"claimGuard":false}}\` in \`.foundry/config.json\`.`,
    },
  });
} catch {
  // Any unforeseen shape, encoding or filesystem error: no opinion, no noise, no crash.
  silent();
}
