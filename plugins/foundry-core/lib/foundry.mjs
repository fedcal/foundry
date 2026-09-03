/**
 * Foundry core library — zero runtime dependencies, Node >= 20.
 *
 * Everything Foundry's hooks, MCP server and CLI need in one place:
 * project paths, the tiered memory store, the memory index, a compact
 * JSON Schema (2020-12 subset) validator, and token accounting.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

/* ------------------------------------------------------------------ paths */

/** Resolve the project root. Hook stdin `cwd` wins, because it follows worktrees. */
export function projectRoot(cwd) {
  const start = cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.foundry')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function paths(root) {
  const base = path.join(root, '.foundry');
  return {
    root,
    base,
    scratch: path.join(base, 'scratch'),
    memory: path.join(base, 'memory'),
    facts: path.join(base, 'memory', 'facts'),
    index: path.join(base, 'memory', 'INDEX.md'),
    runbooks: path.join(base, 'runbooks'),
    blackboard: path.join(base, 'blackboard'),
    metrics: path.join(base, 'metrics'),
    overrides: path.join(base, 'overrides.json'),
    config: path.join(base, 'config.json'),
    adr: path.join(root, 'docs', 'adr'),
  };
}

export function ensureDirs(root) {
  const p = paths(root);
  for (const d of [p.base, p.scratch, p.memory, p.facts, p.runbooks, p.blackboard, p.metrics]) {
    fs.mkdirSync(d, { recursive: true });
  }
  return p;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function configDefaults() {
  return {
    indexTokenBudget: 4000,
    handoffSummaryTokenBudget: 300,
    enforcement: 'gate', // 'gate' | 'warn' | 'off'
    protectedPaths: ['.github/workflows/**', '**/*.lock', 'package-lock.json', 'db/migrations/**'],
    secretScan: true,
    verifyOnStop: true,
    memoryRetrieval: { maxFacts: 8, minScore: 1 },
  };
}

const positiveNumber = { check: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0, expected: 'a positive number' };
const bool = { check: (v) => typeof v === 'boolean', expected: 'true or false' };

/**
 * Every setting a gate reads, with the shape it must have.
 *
 * `config()` used to spread whatever JSON it found straight into the defaults, so
 * `"protectedPaths": "**\/*.lock"` — the singular reading of the key, and a plausible
 * hand-edit — reached `guard-write.mjs` as a string and threw `protectedGlobs.find is not
 * a function`. A PreToolUse hook that throws exits non-zero, which Claude Code treats as a
 * non-blocking hook error: the write proceeds. A protected-path gate must never be
 * disarmed by a typo, so a value of the wrong type is refused here and the default is used
 * instead, and `configIssues()` reports it so `foundry doctor` can say so out loud.
 */
const CONFIG_RULES = {
  indexTokenBudget: positiveNumber,
  handoffSummaryTokenBudget: positiveNumber,
  enforcement: { check: (v) => ['gate', 'warn', 'off'].includes(v), expected: 'one of "gate", "warn", "off"' },
  protectedPaths: {
    check: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
    expected: 'an array of glob strings (note the plural: ["**/*.lock"], not "**/*.lock")',
  },
  secretScan: bool,
  verifyOnStop: bool,
  memoryRetrieval: { check: isPlainObject, expected: 'an object' },
};

const MEMORY_RETRIEVAL_RULES = {
  maxFacts: positiveNumber,
  minScore: { check: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0, expected: 'a number >= 0' },
};

/**
 * The effective configuration plus every reason it differs from the file on disk.
 * Unknown keys are kept — dropping them would lose data on the next `foundry profile`
 * write — but they are reported, because a misspelled `protectedPath` is a gate that
 * quietly does nothing.
 */
export function readConfig(root) {
  const defaults = configDefaults();
  const issues = [];
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(paths(root).config, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { config: defaults, issues };
    issues.push(err instanceof SyntaxError
      ? 'config.json is not valid JSON — every setting in it is being ignored'
      : `config.json cannot be read (${err.code}) — every setting in it is being ignored`);
    return { config: defaults, issues };
  }
  if (!isPlainObject(raw)) {
    issues.push(`config.json must contain a JSON object, not ${jsonType(raw)} — every setting in it is being ignored`);
    return { config: defaults, issues };
  }

  const merged = { ...defaults };
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('_')) { merged[key] = value; continue; } // by convention a comment, as in overrides.json
    if (key === 'memoryRetrieval') continue; // handled below, sub-key by sub-key
    const rule = CONFIG_RULES[key];
    if (!rule) {
      merged[key] = value;
      issues.push(`config.json: unknown setting "${key}" — Foundry reads none of it`);
      continue;
    }
    if (!rule.check(value)) {
      issues.push(`config.json: "${key}" must be ${rule.expected}, got ${JSON.stringify(value)} — using the built-in default instead`);
      continue;
    }
    merged[key] = value;
  }

  merged.memoryRetrieval = { ...defaults.memoryRetrieval };
  if ('memoryRetrieval' in raw) {
    if (!isPlainObject(raw.memoryRetrieval)) {
      issues.push(`config.json: "memoryRetrieval" must be an object, got ${JSON.stringify(raw.memoryRetrieval)} — using the built-in default instead`);
    } else {
      for (const [key, value] of Object.entries(raw.memoryRetrieval)) {
        const rule = MEMORY_RETRIEVAL_RULES[key];
        if (!rule) {
          merged.memoryRetrieval[key] = value;
          issues.push(`config.json: unknown setting "memoryRetrieval.${key}" — Foundry reads none of it`);
          continue;
        }
        if (!rule.check(value)) {
          issues.push(`config.json: "memoryRetrieval.${key}" must be ${rule.expected}, got ${JSON.stringify(value)} — using the built-in default instead`);
          continue;
        }
        merged.memoryRetrieval[key] = value;
      }
    }
  }

  return { config: merged, issues };
}

/** Foundry configuration with defaults. `.foundry/config.json` overrides, if it type-checks. */
export function config(root) {
  return readConfig(root).config;
}

/** Every setting in `.foundry/config.json` that is being ignored, and why. */
export function configIssues(root) {
  return readConfig(root).issues;
}

/**
 * "absent" | "ok" | "unreadable". config() falls back to defaults on both absent and
 * unreadable, which silently discarded a project's protectedPaths and secretScan while
 * doctor reported the file as healthy.
 */
export function configState(root) {
  const file = paths(root).config;
  if (!fs.existsSync(file)) return 'absent';
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return 'ok';
  } catch {
    return 'unreadable';
  }
}

/* ------------------------------------------------------------- permissions */

/**
 * Claude Code's permission modes, ordered by how much can happen without the user saying so.
 * The names and their meanings are the runtime's own: `plan` executes nothing, `dontAsk`
 * denies anything not pre-approved, `default` prompts, `auto` lets a classifier answer the
 * prompt, `acceptEdits` auto-accepts file edits, `bypassPermissions` checks nothing.
 *
 * One deliberate divergence from the runtime's own table (2.1.250 ranks `dontAsk` equal to
 * `default`): here `dontAsk` is stricter, because moving a project from "auto-deny anything
 * that would prompt" to "prompt" lets things happen that could not happen before. Erring
 * strict only ever means a profile is refused, which is the direction this guard exists for.
 * Do not "correct" it to the runtime's numbers without re-reading that sentence.
 */
const PERMISSION_MODE_RANK = { plan: 0, dontAsk: 1, default: 2, acceptEdits: 3, auto: 4, bypassPermissions: 5 };

/** `manual` is the runtime's accepted alias for `default` (settings schema, 2.1.250). */
const canonicalMode = (mode) => (mode === 'manual' ? 'default' : mode);

/**
 * Union a profile's permission rules into the ones a project already has.
 *
 * Returns `{ permissions, notices }` and prints nothing: this module is imported by every
 * hook, whose stdout is a JSON protocol, so a stray console.log here is a corrupted hook
 * response. The caller decides how to show the notices.
 *
 * `defaultMode` is never loosened. Applying a profile is a one-command convenience, and it
 * used to overwrite the mode outright in either direction: a project whose settings said
 * `plan` came out of `foundry profile startup-mvp` saying `acceptEdits`, with no prompt and
 * no printed diff. Tightening is safe and still applies; relaxing needs the user to say so.
 * A mode this version cannot rank — on either side — is left alone rather than guessed at,
 * so a mode added to Claude Code after this release is never silently adopted or replaced.
 */
export function mergePermissions(current, add) {
  const out = { ...current };
  const notices = [];
  for (const key of ['allow', 'ask', 'deny']) {
    if (!add[key]) continue;
    const before = current[key] || [];
    out[key] = [...new Set([...before, ...add[key]])];
    for (const rule of out[key]) if (!before.includes(rule)) notices.push(`+ ${key}: ${rule}`);
  }

  const to = canonicalMode(add.defaultMode);
  const from = canonicalMode(current.defaultMode);
  const shown = current.defaultMode; // report the value as the user wrote it, alias included
  if (to && to !== from) {
    const known = (mode) => mode in PERMISSION_MODE_RANK;
    if (from !== undefined && !(known(from) && known(to))) {
      notices.push(`keeping defaultMode "${shown}" — the profile suggests "${add.defaultMode}", and this version of Foundry cannot rank one of the two.`);
      notices.push('  change it yourself in .claude/settings.json if you want it.');
    } else if (from !== undefined && PERMISSION_MODE_RANK[to] > PERMISSION_MODE_RANK[from]) {
      notices.push(`keeping defaultMode "${shown}" — the profile suggests "${add.defaultMode}", which is more permissive.`);
      notices.push('  set it yourself in .claude/settings.json if you want it.');
    } else {
      // An unset mode is not a choice the user made, so a profile may set it — but never
      // without saying so.
      out.defaultMode = to;
      notices.push(`+ defaultMode: ${shown ?? '(unset)'} -> ${to}`);
    }
  }
  return { permissions: out, notices };
}

/* ----------------------------------------------------------------- tokens */

/**
 * Token estimate. Deliberately cheap and deterministic: ~4 chars per token for
 * prose, which is close enough to enforce budgets without a tokenizer dependency.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/* --------------------------------------------------------- frontmatter io */

export function parseFrontmatter(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!m) return { data: {}, body: source };
  const data = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const kv = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const raw = kv[2].trim();
      if (raw === '') data[key] = '';
      else data[key] = parseScalar(raw);
    } else if (key && /^\s*-\s+/.test(line)) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(parseScalar(line.replace(/^\s*-\s+/, '').trim()));
    }
  }
  return { data, body: m[2] };
}

function parseScalar(raw) {
  if (/^\[.*\]$/.test(raw)) {
    return raw.slice(1, -1).split(',').map((s) => parseScalar(s.trim())).filter((s) => s !== '');
  }
  if (/^(['"]).*\1$/.test(raw)) return raw.slice(1, -1);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

export function stringifyFrontmatter(data, body) {
  const lines = [];
  // parseFrontmatter is last-wins, so a newline inside any value forges further keys:
  // a crafted title could overwrite id, schema or expires, or close the block early.
  const scalar = (v) => {
    const raw = String(v);
    return /[\r\n]/.test(raw) ? JSON.stringify(raw.replace(/[\r\n]+/g, ' ')) : raw;
  };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(scalar).join(', ')}]`);
    else if (v === null) lines.push(`${k}: null`);
    else lines.push(`${k}: ${scalar(v)}`);
  }
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

/* ----------------------------------------------------------------- memory */

export function listFacts(root) {
  const p = paths(root);
  if (!fs.existsSync(p.facts)) return [];
  return fs
    .readdirSync(p.facts)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const source = fs.readFileSync(path.join(p.facts, f), 'utf8');
      const { data, body } = parseFrontmatter(source);
      return { file: path.join(p.facts, f), ...data, body: body.trim() };
    })
    .filter((f) => f.id);
}

export function activeFacts(root, today = null) {
  const now = today || new Date().toISOString().slice(0, 10);
  const all = listFacts(root);
  const superseded = new Set(all.map((f) => f.supersedes).filter(Boolean));
  return all.filter((f) => !superseded.has(f.id) && (!f.expires || f.expires >= now));
}

export function nextFactId(root) {
  const ids = listFacts(root)
    .map((f) => Number(String(f.id).replace('fact-', '')))
    .filter((n) => Number.isFinite(n));
  const next = (ids.length ? Math.max(...ids) : 0) + 1;
  return `fact-${String(next).padStart(4, '0')}`;
}

export function factFingerprint(title, body) {
  return crypto.createHash('sha256').update(`${normalize(title)}::${normalize(body)}`).digest('hex').slice(0, 16);
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Write a fact, deduplicating against what is already stored.
 * Returns { action: 'created'|'updated'|'unchanged', id, file }.
 */
/**
 * `writeFact` reads the whole fact set, decides create-or-update, then writes. Those three steps
 * are not atomic, and `memory_write` is the single entry point that concurrent subagents all use:
 * thirty simultaneous writes of the same title produced fifteen duplicate facts, because each
 * writer read the directory before any of the others had written. Duplicate titles then trip
 * Foundry's own `doctor` check and pollute the index.
 *
 * `mkdir` is atomic on every filesystem Node supports, so it is the lock. Held for the length of
 * one small write, so contention is microseconds; a lock older than STALE_MS belonged to a process
 * that died mid-write and is broken rather than waited on. Failing to acquire never blocks the
 * write — a serialised write is better than a lost one, but a lost one is better than a hang.
 */
const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 5_000;

function sleepSync(ms) {
  // No dependency, no busy spin: park the thread on a futex that is never woken.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withFactLock(p, fn) {
  const lock = path.join(p.memory, '.write.lock');
  const deadline = Date.now() + LOCK_WAIT_MS;
  let held = false;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lock);
      held = true;
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') break;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { recursive: true, force: true });
      } catch { /* another writer removed it first, which is the outcome we wanted */ }
      sleepSync(15);
    }
  }
  try {
    return fn();
  } finally {
    if (held) { try { fs.rmSync(lock, { recursive: true, force: true }); } catch { /* already gone */ } }
  }
}

export function writeFact(root, fact, today = null, schemaDir = null) {
  const p = ensureDirs(root);
  return withFactLock(p, () => writeFactLocked(root, fact, today, schemaDir, p));
}

function writeFactLocked(root, fact, today, schemaDir, p) {
  const created = today || new Date().toISOString().slice(0, 10);
  const existing = activeFacts(root);
  const fp = factFingerprint(fact.title, fact.body);

  const identical = existing.find((f) => factFingerprint(f.title, f.body) === fp);
  if (identical) return { action: 'unchanged', id: identical.id, file: identical.file };

  const sameTitle = existing.find((f) => normalize(f.title) === normalize(fact.title));
  const id = sameTitle ? nextFactId(root) : fact.id || nextFactId(root);

  const data = {
    // A fact must validate against fact.v1 like any other artifact. Omitting these two
    // fields made the memory tier the one place in Foundry exempt from its own contracts.
    schema: 'fact.v1',
    producedBy: fact.producedBy || 'foundry',
    id,
    type: fact.type || 'domain',
    scope: fact.scope || 'project',
    title: fact.title,
    tags: fact.tags || [],
    confidence: fact.confidence || 'medium',
    source: fact.source || 'conversation',
    created,
    expires: fact.expires ?? null,
    supersedes: sameTitle ? sameTitle.id : (fact.supersedes ?? null),
  };
  // The tier that sells "every artifact validates against its contract" was the one
  // place that never checked. Stamping schema: fact.v1 is not the same as honouring it.
  const loaded = loadSchema('fact.v1', schemaDir);
  if (loaded) {
    const errors = validate(loaded.schema, { ...data, body: fact.body }, { schemaDir: loaded.dir });
    if (errors.length) {
      const err = new Error(`fact does not satisfy fact.v1:\n${errors.map((e) => `- ${e}`).join('\n')}`);
      err.validationErrors = errors;
      throw err;
    }
  }

  // Concurrent writers read the same directory, pick the same next id and the second
  // silently overwrote the first. "wx" turns that collision into a retry.
  //
  // The update branch cannot use "wx" — it is meant to replace an existing file — but it must not
  // use a plain in-place write either: two subagents updating the same fact through memory_write
  // interleave inside one writeFileSync and leave a torn file that no longer parses, losing the
  // fact entirely rather than losing one of the two edits. Writing a temporary file and renaming
  // it is atomic on the same filesystem, so a reader sees the old fact or the new one, never half
  // of each. Last write still wins, which is the intended semantics for an update.
  let file = path.join(p.facts, `${data.id}.md`);
  if (sameTitle) {
    const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tmp, stringifyFrontmatter(data, fact.body));
      fs.renameSync(tmp, file);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* the temp file may never have been created */ }
      throw err;
    }
  } else {
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Serialise inside the loop: on a collision the id changes, and writing
        // content built from the previous id would store a file whose frontmatter
        // id no longer matches its own filename.
        fs.writeFileSync(file, stringifyFrontmatter(data, fact.body), { flag: 'wx' });
        break;
      } catch (err) {
        if (err.code !== 'EEXIST' || attempt >= 50) throw err;
        data.id = nextFactId(root);
        file = path.join(p.facts, `${data.id}.md`);
      }
    }
  }
  return { action: sameTitle ? 'updated' : 'created', id: data.id, file, supersedes: data.supersedes };
}

/** Keyword retrieval. No embeddings: deterministic, offline, and good enough on <2k facts. */
export function searchFacts(root, query, { limit = 8, type = null, minScore = 1 } = {}) {
  const terms = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ_.-]+/)
    .filter((t) => t.length > 2);
  if (!terms.length) return [];
  const weight = { high: 1.15, medium: 1, low: 0.8 };
  return activeFacts(root)
    .filter((f) => !type || f.type === type)
    .map((f) => {
      const title = String(f.title || '').toLowerCase();
      const tags = (Array.isArray(f.tags) ? f.tags : []).join(' ').toLowerCase();
      const body = String(f.body || '').toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 3;
        if (tags.includes(t)) score += 2;
        if (body.includes(t)) score += 1;
      }
      if (f.type === 'decision' || f.type === 'constraint') score *= 1.2;
      return { fact: f, score: score * (weight[f.confidence] ?? 1) };
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({ ...r.fact, score: Number(r.score.toFixed(2)) }));
}

/** Rebuild INDEX.md. Enforces the token budget by truncating lowest-value entries. */
function truncationFooter(dropped, max) {
  return `> ${dropped} entries omitted to stay inside the ${max}-token index budget. Consolidate or expire facts: \`foundry memory prune\`.`;
}

export function buildIndex(root, { budget } = {}) {
  const p = ensureDirs(root);
  const cfg = config(root);
  const max = budget ?? cfg.indexTokenBudget;
  const facts = activeFacts(root);
  const order = { decision: 0, constraint: 1, convention: 2, risk: 3, domain: 4, metric: 5, glossary: 6 };
  facts.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || String(a.id).localeCompare(String(b.id)));

  const header = [
    '# Foundry memory index',
    '',
    '<!-- Generated by foundry. Do not edit by hand: run `foundry memory index`. -->',
    'Retrieval: ask the `foundry` MCP server (`memory_search`) for the full text of any entry.',
    '',
  ];

  const all = facts.map((f) => {
    const tags = Array.isArray(f.tags) && f.tags.length ? ` \`${f.tags.slice(0, 4).join('` `')}\`` : '';
    return `- **${f.id}** · ${f.type} · ${f.title}${tags}`;
  });

  // The budget is a promise about the finished file, so it is measured on the finished file.
  // Estimating line costs and adding the truncation footer afterwards produced an index that
  // announced it had stayed inside a budget it had just exceeded.
  const assemble = (lines, dropped) => {
    const body = dropped ? [...lines, '', truncationFooter(dropped, max)] : lines;
    return `${header.join('\n')}${body.join('\n')}\n`;
  };

  let listed = all.length;
  let content = assemble(all, 0);
  while (listed > 0 && estimateTokens(content) > max) {
    listed -= 1;
    content = assemble(all.slice(0, listed), all.length - listed);
  }

  const dropped = all.length - listed;
  fs.writeFileSync(p.index, content);
  // The footer and `foundry doctor` both send the operator to `foundry memory prune`, which
  // knew only about expired, superseded and malformed facts — none of which shrink a healthy
  // index — so the remediation loop never closed. Naming the facts that fell outside the
  // budget is what makes the advice actionable.
  return {
    path: p.index,
    facts: facts.length,
    listed,
    dropped,
    tokens: estimateTokens(content),
    omitted: facts.slice(listed).map((f) => ({ id: f.id, type: f.type, title: f.title })),
  };
}

/* -------------------------------------------------------------- runbooks */

export function listRunbooks(root) {
  const p = paths(root);
  if (!fs.existsSync(p.runbooks)) return [];
  return fs
    .readdirSync(p.runbooks)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data } = parseFrontmatter(fs.readFileSync(path.join(p.runbooks, f), 'utf8'));
      return { slug: f.replace(/\.md$/, ''), title: data.title || f, trigger: data.trigger || '', file: path.join(p.runbooks, f) };
    });
}

/* ------------------------------------------------------------- telemetry */

/**
 * The event log is appended to on every blackboard write, every memory search, every gate
 * decision and every session end, and nothing ever removed a line: the one part of Foundry
 * with no budget. One generation is rolled aside at 5 MB, which is far beyond anything a
 * normal project reaches — this repository's own log is 36 lines and 5 KB after building the
 * whole stack — so the cap only bounds the pathological case, where `countEvents()` would
 * otherwise read an ever-growing file into one string on every token report.
 */
const METRICS_MAX_BYTES = 5 * 1024 * 1024;

/** The event log and the one rolled generation kept beside it, newest first. */
export function metricsFiles(root) {
  const p = paths(root);
  return [path.join(p.metrics, 'events.jsonl'), path.join(p.metrics, 'events.1.jsonl')]
    .filter((f) => fs.existsSync(f));
}

export function recordMetric(root, event) {
  try {
    const p = ensureDirs(root);
    const file = path.join(p.metrics, 'events.jsonl');
    try {
      if (fs.statSync(file).size >= METRICS_MAX_BYTES) fs.renameSync(file, path.join(p.metrics, 'events.1.jsonl'));
    } catch { /* no log yet, or another process rolled it first */ }
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    fs.appendFileSync(file, line + '\n');
  } catch {
    /* telemetry must never break a session */
  }
}

/* ------------------------------------------------------ schema validation */

const FORMATS = {
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)),
  'date-time': (v) => !Number.isNaN(Date.parse(v)),
  uri: (v) => /^[a-z][a-z0-9+.-]*:/i.test(v),
};

const SUPPORTED_KEYWORDS = [
  '$ref', 'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'format',
  'minimum', 'maximum',
];
const SUPPORTED = new Set(SUPPORTED_KEYWORDS);

/** Carries no assertion, so it costs nothing to ignore. */
const ANNOTATIONS = new Set([
  '$schema', '$id', '$anchor', '$comment', '$defs', 'title', 'description', 'default', 'examples',
  'deprecated', 'readOnly', 'writeOnly',
]);

/**
 * Refuse a schema this validator cannot evaluate.
 *
 * Ignoring an unimplemented keyword *is* silently passing something invalid: `oneOf`,
 * `allOf`, `not`, `uniqueItems` and friends returned no errors on data that violates them,
 * so the first contract to reach for one would validate everything, forever, while the
 * PostToolUse gate reported success. AUTHORING.md requires each breaking change to ship as
 * a new `*.vN+1` file, so that day is a matter of time. Failing here instead makes the
 * mistake unmissable the first time the author exercises the contract.
 */
function auditSchema(schema, pointer, audited) {
  if (!isPlainObject(schema)) return [`${pointer}: schema must be an object`];
  if (audited.has(schema)) return [];
  audited.add(schema);

  const problems = [];
  for (const key of Object.keys(schema)) {
    if (SUPPORTED.has(key) || ANNOTATIONS.has(key)) continue;
    problems.push(`${pointer}: unsupported schema keyword "${key}" — ignoring it would let this schema validate anything`);
  }
  if ('additionalProperties' in schema && schema.additionalProperties !== false) {
    problems.push(`${pointer}: only "additionalProperties": false is implemented, not a subschema`);
  }
  if (Array.isArray(schema.items)) {
    problems.push(`${pointer}: "items" must be a single schema — the tuple form is not implemented`);
  }
  if (isPlainObject(schema.properties)) {
    for (const [key, sub] of Object.entries(schema.properties)) {
      problems.push(...auditSchema(sub, `${pointer}/${key}`, audited));
    }
  }
  if (schema.items && !Array.isArray(schema.items)) {
    problems.push(...auditSchema(schema.items, `${pointer}/items`, audited));
  }
  return problems;
}

/**
 * Compact JSON Schema 2020-12 validator covering the keywords Foundry contracts use.
 * A schema that uses anything outside that subset is rejected outright, because ignoring
 * a keyword would report a document as valid against a rule that was never checked.
 * See `concepts/contracts.md` for the supported subset.
 */
export function validate(schema, data, { schemaDir = null, pointer = '#', seen = new Map(), resolving = new Set(), audited = null } = {}) {
  const errors = [];
  const fail = (msg) => errors.push(`${pointer}: ${msg}`);

  // A schema we cannot evaluate is reported as such, on its own: a cascade of data errors
  // underneath it would suggest the document is the thing that needs fixing.
  const audit = audited || new Set();
  const unusable = auditSchema(schema, pointer, audit);
  if (unusable.length) {
    return [...unusable, `${pointer}: this validator implements only ${SUPPORTED_KEYWORDS.join(', ')} — rewrite the contract inside that subset`];
  }

  if (schema.$ref) {
    // `seen` is a parse cache, not a cycle guard: on a repeat visit it hands back the same
    // schema object and validate() re-enters resolveRef with the same $ref. A self- or
    // mutually-referential contract recursed until the stack blew, and a RangeError out of
    // a PostToolUse hook is a crashed gate, not a validation result. The chain is tracked
    // separately from the cache, and only along a $ref chain: descending into a property
    // consumes data, so a schema that legitimately recurses over nested data terminates.
    if (resolving.has(schema.$ref)) return [`${pointer}: circular $ref ${schema.$ref}`];
    const resolved = resolveRef(schema.$ref, schemaDir, seen);
    if (!resolved) return [`${pointer}: cannot resolve $ref ${schema.$ref}`];
    return validate(resolved, data, { schemaDir, pointer, seen, resolving: new Set([...resolving, schema.$ref]), audited: audit });
  }

  if (schema.const !== undefined && !deepEqual(data, schema.const)) {
    fail(`must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((v) => deepEqual(v, data))) {
    fail(`must be one of ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type && !typeMatches(schema.type, data)) {
    fail(`expected ${Array.isArray(schema.type) ? schema.type.join('|') : schema.type}, got ${jsonType(data)}`);
    return errors;
  }

  if (typeof data === 'string') {
    if (schema.maxLength !== undefined && data.length > schema.maxLength) fail(`longer than ${schema.maxLength} characters`);
    if (schema.minLength !== undefined && data.length < schema.minLength) fail(`shorter than ${schema.minLength} characters`);
    if (schema.pattern && !safePattern(schema.pattern).test(data)) fail(`does not match ${schema.pattern}`);
    if (schema.format && FORMATS[schema.format] && !FORMATS[schema.format](data)) fail(`is not a valid ${schema.format}`);
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) fail(`below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) fail(`above maximum ${schema.maximum}`);
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) fail(`needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) fail(`allows at most ${schema.maxItems} items`);
    if (schema.items) {
      data.forEach((item, i) => errors.push(...validate(schema.items, item, { schemaDir, pointer: `${pointer}/${i}`, seen, audited: audit })));
    }
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const req of schema.required || []) {
      if (!(req in data)) fail(`missing required property "${req}"`);
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in data) errors.push(...validate(sub, data[key], { schemaDir, pointer: `${pointer}/${key}`, seen, audited: audit }));
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(data)) {
        if (!(key in schema.properties)) fail(`unexpected property "${key}"`);
      }
    }
  }

  return errors;
}

/**
 * The sibling contract file a `$ref` names, or null.
 *
 * Only a whole-document reference to another `<name>.vN.schema.json` in the same directory
 * resolves. A local pointer — `"#/$defs/evidenceItem"`, the idiomatic 2020-12 way to factor
 * out a repeated shape — has the pathname "/", whose basename is the empty string: the old
 * code joined that onto the schema directory, found the directory exists, and read it,
 * throwing EISDIR out of the validator and out of the PostToolUse hook that calls it. A ref
 * with a fragment is refused rather than quietly validated against the whole file it names.
 */
function refFileName(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  const hash = ref.indexOf('#');
  if (hash !== -1 && ref.slice(hash + 1) !== '') return null;
  let pathname;
  try {
    pathname = new URL(ref, 'https://x/').pathname;
  } catch {
    return null;
  }
  const name = path.basename(pathname);
  return /^[a-z][a-z0-9-]*\.v\d+\.schema\.json$/.test(name) ? name : null;
}

function resolveRef(ref, schemaDir, seen) {
  if (seen.has(ref)) return seen.get(ref);
  if (!schemaDir) return null;
  const name = refFileName(ref);
  if (!name) return null;
  const file = path.join(schemaDir, name);
  let parsed;
  try {
    if (!fs.statSync(file).isFile()) return null;
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Unreadable or unparseable: "cannot resolve $ref" is a validation error the caller can
    // report, where a raw ENOENT or SyntaxError would take the gate down with it.
    return null;
  }
  seen.set(ref, parsed);
  return parsed;
}

function jsonType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function typeMatches(type, v) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    if (t === 'integer') return Number.isInteger(v);
    if (t === 'number') return typeof v === 'number';
    if (t === 'array') return Array.isArray(v);
    if (t === 'null') return v === null;
    if (t === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
    return typeof v === t;
  });
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Load a Foundry contract schema by id, e.g. "finding.v1". */
/** An invalid `pattern` in a schema must fail that schema, not crash the validator. */
function safePattern(pattern) {
  try {
    return new RegExp(pattern);
  } catch {
    return { test: () => false };
  }
}

export function loadSchema(id, schemaDir) {
  // A contract id is a flat name like "finding.v1". Anything else — a separator,
  // a "..", an absolute path — would load an arbitrary *.schema.json from disk
  // and let a caller validate against a schema of their own choosing.
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*\.v\d+$/.test(id)) return null;
  const dir = schemaDir || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
  const file = path.join(dir, `${id}.schema.json`);
  if (!fs.existsSync(file)) return null;
  return { schema: JSON.parse(fs.readFileSync(file, 'utf8')), dir };
}

/* ------------------------------------------------------------ hook plumbing */

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function emit(payload) {
  // process.stdout to a pipe is asynchronous on macOS and process.exit() does not wait
  // for pending writes: a long permissionDecisionReason could be truncated or lost,
  // and a gate whose output never arrives fails open. writeSync cannot be cut short.
  const out = JSON.stringify(payload);
  try {
    fs.writeSync(1, out);
  } catch {
    process.stdout.write(out);
  }
  process.exit(0);
}

export function noOpinion() {
  process.exit(0);
}

/**
 * True once a project has opted in by running `foundry init`.
 * The blocking gates must stay silent before that: config() falls back to
 * enforcement "gate", which otherwise armed every gate on every project on the
 * machine the moment foundry-core was installed — with no overrides.json to
 * appeal to, since init is what creates it.
 */
export function foundryInitialised(root) {
  return fs.existsSync(paths(root).base);
}

/**
 * Emit a blocking decision on the channel the event actually accepts.
 * PreToolUse reads hookSpecificOutput.permissionDecision (allow|deny|ask|defer —
 * "escalate" is rejected by the schema and fails open). Stop and SubagentStop
 * read a top-level {decision:"block", reason}; sending them permissionDecision
 * produces output nothing interprets, so the gate silently never fires.
 */
const BLOCK_VIA_DECISION = new Set(['Stop', 'SubagentStop']);

export function decide(hookEventName, permissionDecision, permissionDecisionReason, extra = {}) {
  if (BLOCK_VIA_DECISION.has(hookEventName)) {
    if (permissionDecision === 'deny') {
      emit({ decision: 'block', reason: permissionDecisionReason, ...extra });
      return;
    }
    emit({ ...extra });
    return;
  }
  emit({ hookSpecificOutput: { hookEventName, permissionDecision, permissionDecisionReason, ...extra } });
}

export function addContext(hookEventName, additionalContext) {
  emit({ hookSpecificOutput: { hookEventName, additionalContext } });
}

/** Active, non-expired override for a given gate id. */
export function overrideStatus(root, gateId, today = null) {
  const now = today || new Date().toISOString().slice(0, 10);
  try {
    const all = JSON.parse(fs.readFileSync(paths(root).overrides, 'utf8'));
    const entry = (all.overrides || []).find((o) => o.gate === gateId);
    if (!entry) return { state: 'none', entry: null };
    // An override with no expiry never expired, which is exactly the case SECURITY.md
    // puts out of scope on the grounds that overrides are "explicit, recorded and expiring".
    if (!entry.expires) return { state: 'invalid', entry };
    if (entry.expires < now) return { state: 'expired', entry };
    return { state: 'active', entry };
  } catch {
    return { state: 'none', entry: null };
  }
}

/**
 * The override in force for a gate, or null.
 *
 * Returns null for an expired override. That is the whole point: an earlier version returned
 * the expired entry as a truthy object, and a caller that wrote `if (activeOverride(...))`
 * kept honouring an override that had lapsed. A gate that fails open is worse than no gate,
 * so the unsafe reading is no longer expressible. Use `overrideStatus` to tell "expired"
 * from "never existed".
 */
export function activeOverride(root, gateId, today = null) {
  const { state, entry } = overrideStatus(root, gateId, today);
  return state === 'active' ? entry : null;
}
