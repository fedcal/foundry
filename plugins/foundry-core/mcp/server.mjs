#!/usr/bin/env node
/**
 * Foundry MCP server — stdio, JSON-RPC 2.0, zero dependencies.
 *
 * Exists for one reason: reading project memory through a tool costs a fraction
 * of the tokens of loading memory files into the context window. Every tool here
 * returns the smallest useful payload, never a file dump.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  projectRoot, paths, ensureDirs, config,
  searchFacts, writeFact, buildIndex, activeFacts,
  listRunbooks, recordMetric, validate, loadSchema, estimateTokens,
} from '../lib/foundry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.join(HERE, '..', 'schemas');
const ROOT = projectRoot(process.env.FOUNDRY_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const P = paths(ROOT);
/** insideDir() returns real paths, so the path we print must be relative to a real root. */
const ROOT_REAL = realpath(ROOT);
const SERVER = { name: 'foundry', version: '0.1.0' };
const PROTOCOL = '2025-06-18';
/** Longest caller-supplied string echoed back into a reply or a metrics line. */
const ECHO_MAX = 120;

/* ------------------------------------------------------------------ tools */

/**
 * MCP tool annotations are not decoration. Claude Code derives BOTH `isReadOnly()` and
 * `isConcurrencySafe()` for an MCP tool solely from `annotations.readOnlyHint`, defaulting
 * to false, and then groups only consecutive concurrency-safe tool calls into a parallel
 * run. Without these, every read here is serialised and breaks up an otherwise parallel
 * batch of Read/Grep/Glob calls — which a fan-out stack pays on every wave.
 */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
const WRITES = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: 'memory_search',
    description:
      'Search Foundry project memory (decisions, constraints, conventions, domain facts, risks, metrics, glossary) and return only the matching facts. Use this instead of reading files under .foundry/memory/ — it is the token-cheap path. Call it before planning, before proposing an architecture, and whenever the user refers to a past decision.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 500, description: 'Keywords describing what you need to know.' },
        type: { type: 'string', enum: ['decision', 'constraint', 'convention', 'domain', 'risk', 'metric', 'glossary'], description: 'Restrict to one fact type.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Maximum facts to return (default 8).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_write',
    description:
      'Store one atomic durable fact in project memory. Deduplicates against existing facts, assigns the id and maintains supersedes chains — never write memory files by hand. Use for decisions taken, constraints discovered, conventions agreed, risks identified. Do not use for transient session state.',
    annotations: WRITES,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'States the fact itself, not the topic. Max 80 chars.' },
        body: { type: 'string', description: 'Max 120 words. For decision/risk include "Why:" and "How to apply:" lines.' },
        type: { type: 'string', enum: ['decision', 'constraint', 'convention', 'domain', 'risk', 'metric', 'glossary'] },
        scope: { type: 'string', description: 'project | module:<name> | vertical:<name>' },
        tags: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        source: { type: 'string', description: 'adr-0007 | conversation | code | external:<url>' },
        expires: { type: 'string', description: 'YYYY-MM-DD after which the fact stops being loaded.' },
      },
      required: ['title', 'body', 'type'],
    },
  },
  {
    name: 'memory_index',
    description: 'Rebuild .foundry/memory/INDEX.md and report how much of the token budget it uses. Run after writing facts.',
    annotations: WRITES,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'runbook_list',
    description: 'List available operational runbooks with their trigger conditions. Consult this BEFORE starting any recurring or error-prone task — a runbook that exists must be followed rather than improvised.',
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'runbook_get',
    description: 'Return the full text of one runbook by slug.',
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: { slug: { type: 'string', maxLength: 120 } }, required: ['slug'] },
  },
  {
    name: 'contract_validate',
    description:
      'Validate a JSON artifact against a Foundry contract schema (finding.v1, adr.v1, plan.v1, requirement.v1, risk.v1, estimate.v1, compliance-check.v1, review.v1, handoff.v1, fact.v1). Returns the list of violations. To dry-run the artifact you are about to hand to blackboard_write, pass `agent` as well: the envelope fields blackboard_write injects for you (`schema`, `producedBy`) are then injected here too, so the dry run and the real write agree.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        schema: { type: 'string', description: 'Contract id, e.g. "finding.v1".' },
        data: { type: ['object', 'array'], description: 'The artifact to validate. An array is a list artifact (see blackboard_write) and is validated one item at a time.' },
        agent: { type: 'string', maxLength: 120, description: 'Producing agent name. Supply it to validate `data` exactly as blackboard_write would, envelope included.' },
        path: { type: 'string', description: 'Alternatively, a path to a JSON file to validate. Validated verbatim: no envelope is injected, because the file on disk already carries one.' },
      },
      required: ['schema'],
    },
  },
  {
    name: 'blackboard_write',
    description:
      'Write a wave artifact to the shared blackboard and validate it against its contract in one step. This is how an agent hands work to the next wave. `data` may be one object, or an array when your output contract is a list of artifacts (e.g. "a JSON array of finding.v1 objects") — each item is validated separately and the file stays a top-level JSON array. Returns the artifact path plus a token-cost report so you can keep the handoff summary inside budget.',
    annotations: WRITES,
    inputSchema: {
      type: 'object',
      properties: {
        // Both are non-empty: an empty agent wrote a nameless ".json" whose `producedBy`
        // was the empty string, and an empty wave dropped the artifact above every wave.
        wave: { type: 'string', minLength: 1, maxLength: 120, description: 'Wave id, e.g. "analysis".' },
        agent: { type: 'string', minLength: 1, maxLength: 120, description: 'Producing agent name.' },
        schema: { type: 'string', description: 'Contract id every item conforms to.' },
        data: { type: ['object', 'array'], description: 'The artifact, or an array of artifacts when the output contract is a list.' },
      },
      required: ['wave', 'agent', 'schema', 'data'],
    },
  },
  {
    name: 'blackboard_read',
    description: 'Read blackboard artifacts for a wave. Returns metadata and summaries by default; pass full=true only when you genuinely need the whole artifact.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        wave: { type: 'string', maxLength: 120 },
        agent: { type: 'string', maxLength: 120 },
        full: { type: 'boolean' },
      },
      required: ['wave'],
    },
  },
  {
    name: 'token_report',
    description: 'Report Foundry token accounting for this project: index cost, memory size, blackboard size and recorded gate events. Use it to answer "what is this costing" and to prove the memory system is paying for itself.',
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: {} },
  },
];

/* -------------------------------------------------------------- handlers */

const handlers = {
  memory_search({ query, type, limit }) {
    const cfg = config(ROOT);
    const hits = searchFacts(ROOT, query, {
      limit: limit || cfg.memoryRetrieval.maxFacts,
      type: type || null,
      minScore: cfg.memoryRetrieval.minScore,
    });
    recordMetric(ROOT, { kind: 'memory_search', query: brief(query), hits: hits.length });
    if (!hits.length) return text(`No stored fact matches "${brief(query)}". Memory holds ${activeFacts(ROOT).length} active facts.`);
    const rendered = hits
      .map((f) => `### ${f.id} · ${f.type} · confidence ${f.confidence}\n**${f.title}**\n${f.body}\n_source: ${f.source} · scope: ${f.scope}_`)
      .join('\n\n');
    return text(rendered);
  },

  memory_write(args) {
    const res = writeFact(ROOT, {
      title: args.title,
      body: args.body,
      type: args.type,
      scope: args.scope || 'project',
      tags: args.tags || [],
      confidence: args.confidence || 'medium',
      source: args.source || 'conversation',
      expires: args.expires ?? null,
    });
    const idx = buildIndex(ROOT);
    recordMetric(ROOT, { kind: 'memory_write', action: res.action, id: res.id });
    return text(
      `${res.action}: ${res.id}${res.supersedes ? ` (supersedes ${res.supersedes})` : ''}\n` +
        `Index: ${idx.listed}/${idx.facts} facts listed, ~${idx.tokens} tokens${idx.dropped ? `, ${idx.dropped} omitted over budget` : ''}.`,
    );
  },

  memory_index() {
    const idx = buildIndex(ROOT);
    return text(`Rebuilt ${idx.path}\n${idx.listed}/${idx.facts} facts listed, ~${idx.tokens} tokens, ${idx.dropped} omitted.`);
  },

  runbook_list() {
    const books = runbooks();
    if (!books.length) return text('No runbooks yet. Create one with the `runbook-author` skill after any task worth repeating.');
    // A runbook with no `trigger:` still lists, so it used to look healthy while being
    // unmatchable to any task — the failure the whole "follow the runbook" flow rests on
    // was silent. Say so instead of printing an empty trigger.
    return text(
      books
        .map((b) => {
          const flaw = b.trigger ? `\n  trigger: ${b.trigger}` : '\n  INCOMPLETE: no `trigger:` in its frontmatter, so nothing can match it to a task. Fix the runbook before relying on it.';
          return `- **${b.slug}** — ${b.title}${flaw}`;
        })
        .join('\n'),
    );
  },

  runbook_get({ slug }) {
    const file = insideDir(P.runbooks, `${sanitize(slug)}.md`);
    if (!file) return text(`Invalid runbook slug "${brief(slug)}".`, true);
    if (!fs.existsSync(file)) return text(`No runbook "${brief(slug)}". Available: ${runbooks().map((b) => b.slug).join(', ') || 'none'}`, true);
    return text(fs.readFileSync(file, 'utf8'));
  },

  contract_validate({ schema, data, agent, path: filePath }) {
    const loaded = loadSchema(schema, SCHEMA_DIR);
    if (!loaded) return text(`Unknown contract "${brief(schema)}". Available: ${availableSchemas().join(', ')}`, true);
    let payload = data;
    let enveloped = false;
    if (!payload && filePath) {
      const abs = insideDir(ROOT, filePath);
      if (!abs) return text('Refused: `path` must stay inside the project.', true);
      if (!fs.existsSync(abs)) return text(`File not found: ${brief(filePath)}`, true);
      try {
        payload = JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch {
        // Never echo the parse error: Node embeds a slice of the file in it.
        return text(`File is not valid JSON: ${brief(filePath)}`, true);
      }
    } else if (payload && agent !== undefined) {
      // A dry run of blackboard_write must validate what blackboard_write will validate.
      // Without this the same payload was INVALID here (missing `schema`, `producedBy`)
      // and accepted there, because the write injects the envelope itself. Only in `data`
      // mode: a file loaded by `path` already carries its envelope and is checked as it is.
      payload = envelope(payload, schema, agent);
      enveloped = true;
    }
    if (!payload) return text('Provide either `data` or `path`.', true);
    const errors = validateArtifact(loaded, payload);
    const note = enveloped ? ` (with the envelope blackboard_write would inject for agent "${brief(agent)}")` : '';
    if (!errors.length) return text(`VALID against ${schema}${note}.`);
    const envelopeOnly = !enveloped && !filePath && errors.every((e) => /missing required property "(schema|producedBy)"$/.test(e));
    const hint = envelopeOnly
      ? '\nThese two fields are the envelope: blackboard_write injects them itself, so the artifact is fine as it stands. Pass `agent` here to validate exactly what the write would.'
      : '';
    return text(`INVALID against ${schema}${note}:\n${bullets(errors)}${hint}`);
  },

  blackboard_write({ wave, agent, schema, data }) {
    const loaded = loadSchema(schema, SCHEMA_DIR);
    if (!loaded) return text(`Unknown contract "${brief(schema)}". Available: ${availableSchemas().join(', ')}`, true);
    // Several agents' output contracts are a top-level JSON array ("a JSON array of
    // finding.v1 objects"). Rejecting those forced the raw Write tool, which bypasses the
    // contract check, the token report and the metric this tool exists to guarantee.
    if (Array.isArray(data)) {
      const bad = data.findIndex((item) => item === null || typeof item !== 'object' || Array.isArray(item));
      if (bad !== -1) return text(`Rejected: data[${bad}] is not an object. A list artifact must be an array of ${schema} objects.`, true);
    }
    // Authoritative fields last: a data.schema in the caller's payload otherwise
    // overwrote the id the artifact was actually validated against.
    const payload = envelope(data, schema, agent);
    const errors = validateArtifact(loaded, payload);
    if (errors.length) {
      return text(`Rejected: artifact does not satisfy ${schema}.\n${bullets(errors)}\nFix and call again.`, true);
    }
    ensureDirs(ROOT);
    const dir = insideDir(P.blackboard, sanitize(wave));
    if (!dir) return text(`Invalid wave "${brief(wave)}".`, true);
    fs.mkdirSync(dir, { recursive: true });
    const file = insideDir(dir, `${sanitize(agent)}.json`);
    if (!file) return text(`Invalid agent "${brief(agent)}".`, true);
    const body = JSON.stringify(payload, null, 2);
    fs.writeFileSync(file, body + '\n');
    const cfg = config(ROOT);
    const items = Array.isArray(payload) ? payload.length : 1;
    recordMetric(ROOT, { kind: 'blackboard_write', wave: brief(wave), agent: brief(agent), schema, items, bytes: body.length });
    return text(
      `Wrote ${path.relative(ROOT_REAL, file)} (${Array.isArray(payload) ? `${items} ${schema} items, ` : ''}${body.length} bytes, ~${estimateTokens(body)} tokens).\n` +
        `Return to your caller ONLY this path and a summary of at most ${cfg.handoffSummaryTokenBudget} tokens.`,
    );
  },

  blackboard_read({ wave, agent, full }) {
    const dir = insideDir(P.blackboard, sanitize(wave));
    if (!dir) return text(`Invalid wave "${brief(wave)}".`, true);
    if (!fs.existsSync(dir)) return text(`No artifacts for wave "${brief(wave)}".`, true);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && (!agent || f === `${sanitize(agent)}.json`));
    if (!files.length) return text(`No artifacts for wave "${brief(wave)}"${agent ? ` and agent "${brief(agent)}"` : ''}.`, true);
    const out = files.map((f) => {
      // Containing the wave directory is not enough: a symlink planted inside it pointed
      // at a file outside the project, and full=true then printed that file in its entirety.
      const target = insideDir(dir, f);
      if (!target) return `- **${f}** · skipped: it resolves outside the blackboard directory.`;
      let raw;
      try {
        raw = fs.readFileSync(target, 'utf8');
      } catch {
        // Guarding only JSON.parse left the same fail-hard open one step earlier: a
        // directory named "*.json", or a file the session cannot read, threw EISDIR/EACCES
        // out of the map and lost every other artifact in the wave with it. The error text
        // is not echoed — it carries the absolute path.
        return `- **${f}** · unreadable (not a readable file)`;
      }
      if (full) return `## ${f}\n\`\`\`json\n${raw}\`\`\``;
      return summarizeArtifact(f, raw);
    });
    return text(out.join('\n\n'));
  },

  token_report() {
    const idx = fs.existsSync(P.index) ? fs.readFileSync(P.index, 'utf8') : '';
    const facts = activeFacts(ROOT);
    const factBytes = facts.reduce((n, f) => n + estimateTokens(`${f.title}${f.body}`), 0);
    const bbBytes = dirTokens(P.blackboard);
    const events = countEvents();
    const cfg = config(ROOT);
    return text(
      [
        '# Foundry token report',
        '',
        `- Memory index: ~${estimateTokens(idx)} tokens of a ${cfg.indexTokenBudget} budget (always in context)`,
        `- Facts stored: ${facts.length}, ~${factBytes} tokens total (retrieved on demand only)`,
        `- Blackboard artifacts: ~${bbBytes} tokens (never enter context wholesale)`,
        `- Recorded events: ${Object.entries(events).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
        '',
        `Loading all memory eagerly would cost ~${factBytes + bbBytes} tokens per session; the index-first path costs ~${estimateTokens(idx)}.`,
      ].join('\n'),
    );
  },
};

/* ------------------------------------------------------------- resources */

function resourceList() {
  const res = [
    { uri: 'foundry://memory/index', name: 'Memory index', description: 'Compact index of every active project fact.', mimeType: 'text/markdown' },
    { uri: 'foundry://contracts', name: 'I/O contracts', description: 'Available Foundry contract schemas.', mimeType: 'text/markdown' },
  ];
  for (const b of runbooks()) {
    res.push({ uri: `foundry://runbooks/${b.slug}`, name: `Runbook: ${b.title}`, description: b.trigger || '', mimeType: 'text/markdown' });
  }
  return res;
}

function resourceRead(uri) {
  if (uri === 'foundry://memory/index') {
    if (!fs.existsSync(P.index)) buildIndex(ROOT);
    return fs.readFileSync(P.index, 'utf8');
  }
  if (uri === 'foundry://contracts') {
    return `# Foundry contracts\n\n${availableSchemas().map((s) => `- ${s}`).join('\n')}\n`;
  }
  const m = /^foundry:\/\/runbooks\/(.+)$/.exec(uri);
  if (m) {
    const file = insideDir(P.runbooks, `${sanitize(m[1])}.md`);
    if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  throw new Error(`Unknown resource: ${uri}`);
}

/* ---------------------------------------------------------------- helpers */

function text(value, isError = false) {
  return { content: [{ type: 'text', text: value }], ...(isError ? { isError: true } : {}) };
}
/**
 * Echo a caller-supplied string back into a message without letting it dominate the reply
 * — or the metrics file. Every tool here promises "the smallest useful payload"; reflecting
 * an unbounded argument verbatim broke that promise in the cheapest possible way.
 */
function brief(value, max = ECHO_MAX) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max)}... (${s.length} chars)` : s;
}
function bullets(errors, max = 20) {
  const shown = errors.slice(0, max).map((e) => `- ${e}`);
  if (errors.length > max) shown.push(`- ... and ${errors.length - max} more violations.`);
  return shown.join('\n');
}
/** The envelope blackboard_write owns. Applied per item when the artifact is a list. */
function envelope(data, schema, agent) {
  return Array.isArray(data)
    ? data.map((item) => ({ ...item, schema, producedBy: agent }))
    : { ...data, schema, producedBy: agent };
}
/** Validate one artifact, or each item of a list artifact with its index in the pointer. */
function validateArtifact(loaded, payload) {
  if (!Array.isArray(payload)) return validate(loaded.schema, payload, { schemaDir: loaded.dir });
  return payload.flatMap((item, i) =>
    validate(loaded.schema, item, { schemaDir: loaded.dir }).map((e) => e.replace(/^#/, `#/${i}`)));
}
/** One summary line for a blackboard file. Never throws, never echoes file bytes. */
function summarizeArtifact(file, raw) {
  const cost = `~${estimateTokens(raw)} tokens`;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Never echo the parse error: Node embeds a slice of the file in it. And one hand-written
    // artifact must not make the whole wave unreadable — skip it, report the rest.
    return `- **${file}** · unreadable (not valid JSON) · ${cost}`;
  }
  if (Array.isArray(parsed)) {
    const first = parsed.find((i) => i && typeof i === 'object') || {};
    const head = `- **${file}** · schema ${first.schema ?? 'unknown'} · by ${first.producedBy ?? 'unknown'} · ${parsed.length} items · ${cost}`;
    if (!parsed.length) return `${head}\n  (empty list)`;
    const titles = parsed
      .slice(0, 3)
      .map((i) => (i && typeof i === 'object' ? i.summary || i.title || i.id || '(untitled)' : String(i)))
      .map((s) => String(s).slice(0, 120));
    return `${head}\n  ${titles.join('\n  ')}${parsed.length > 3 ? `\n  ... and ${parsed.length - 3} more` : ''}`;
  }
  if (!parsed || typeof parsed !== 'object') return `- **${file}** · not a Foundry artifact (top-level ${parsed === null ? 'null' : typeof parsed}) · ${cost}`;
  const summary = parsed.summary || parsed.title || parsed.goal || '(no summary field)';
  return `- **${file}** · schema ${parsed.schema} · by ${parsed.producedBy} · ${cost}\n  ${String(summary).slice(0, 400)}`;
}
/**
 * The runbooks this server will actually serve. A listing that advertises an entry
 * `runbook_get` then refuses is worse than a shorter listing, so both sides agree here.
 */
function runbooks() {
  return listRunbooks(ROOT).filter((b) => insideDir(P.runbooks, `${b.slug}.md`));
}
/**
 * Real path of `p`, resolving every symlink it actually has. A path whose leaf (or whose
 * parent chain) does not exist yet resolves as far as the filesystem allows and keeps the
 * rest lexically, so this is safe to call before mkdir.
 */
function realpath(p) {
  let dir = path.resolve(p);
  const rest = [];
  for (;;) {
    try {
      return rest.length ? path.join(fs.realpathSync.native(dir), ...rest.reverse()) : fs.realpathSync.native(dir);
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return path.resolve(p);
      rest.push(path.basename(dir));
      dir = parent;
    }
  }
}
/**
 * Resolve `candidate` under `base` and return it only if it stays inside.
 * Returns null on escape, so every caller must handle refusal explicitly —
 * path.join alone lets "../" walk out of the project.
 *
 * Both sides are resolved through the filesystem, not just lexically: a purely lexical
 * check said yes to any in-project symlink pointing out of the project, so `path` could
 * name a file outside the root and contract_validate would read it while claiming
 * "must stay inside the project". Resolving the base too keeps a project that itself
 * lives behind a symlink (macOS /var → /private/var) from refusing everything.
 */
function insideDir(base, candidate) {
  const baseResolved = realpath(base);
  const target = realpath(path.resolve(path.resolve(base), String(candidate ?? '')));
  return target === baseResolved || target.startsWith(baseResolved + path.sep) ? target : null;
}
function sanitize(s) {
  const clean = String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  // "." is allowed in the class above, so ".." survived and walked one level up.
  return /^\.+$/.test(clean) ? '_' : clean;
}
function availableSchemas() {
  if (!fs.existsSync(SCHEMA_DIR)) return [];
  return fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.schema.json')).map((f) => f.replace('.schema.json', ''));
}
function dirTokens(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    // Symlinks are not followed (a link to a directory read as a file threw EISDIR and
    // took the whole report down), and one unreadable entry costs its own line, not the call.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) total += dirTokens(full);
    else if (entry.isFile()) {
      try {
        total += estimateTokens(fs.readFileSync(full, 'utf8'));
      } catch { /* an unreadable artifact is worth 0 tokens, not a failed report */ }
    }
  }
  return total;
}
function countEvents() {
  const file = path.join(P.metrics, 'events.jsonl');
  if (!fs.existsSync(file)) return {};
  const counts = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const { kind } = JSON.parse(line);
      counts[kind] = (counts[kind] || 0) + 1;
    } catch { /* skip malformed line */ }
  }
  return counts;
}

/* -------------------------------------------------------------- JSON-RPC */

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

function dispatch(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return respond(id, {
      // Answer with the one revision this server actually implements. Echoing the client's
      // proposal back unchecked declared support for whatever it asked for — Claude Code
      // proposes its newest ("2025-11-25") first, so the server was claiming a spec it has
      // never been written against, and would have echoed a non-string just as happily.
      // The client accepts any version on its own supported list, and 2025-06-18 is on it.
      protocolVersion: PROTOCOL,
      capabilities: { tools: {}, resources: {} },
      serverInfo: SERVER,
      instructions:
        'Foundry memory and contracts. Prefer memory_search over reading .foundry files. Consult runbook_list before recurring tasks. Hand work between agents with blackboard_write, returning only the artifact path and a short summary.',
    });
  }
  if (method === 'ping') return respond(id, {});
  if (method === 'tools/list') return respond(id, { tools: TOOLS });
  if (method === 'resources/list') return respond(id, { resources: resourceList() });
  if (method === 'resources/read') {
    try {
      return respond(id, { contents: [{ uri: params.uri, mimeType: 'text/markdown', text: resourceRead(params.uri) }] });
    } catch (err) {
      return respondError(id, -32602, err.message);
    }
  }
  if (method === 'tools/call') {
    // handlers[name] walks the prototype chain: "constructor" resolved to Object
    // (truthy and callable, returning {}), "__proto__" to Object.prototype.
    const name = params?.name;
    const handler = typeof name === 'string' && Object.hasOwn(handlers, name) ? handlers[name] : null;
    if (!handler) return respondError(id, -32601, `Unknown tool: ${name}`);
    try {
      // The declared inputSchema was advertised and never enforced: a missing required
      // field surfaced as the literal "undefined" inside a result message, or as an
      // internal TypeError, instead of an invalid-params error.
      const tool = TOOLS.find((t) => t.name === name);
      const args = params.arguments || {};
      if (tool?.inputSchema) {
        const problems = validate(tool.inputSchema, args);
        if (problems.length) {
          return respond(id, text(`Invalid arguments for ${name}:\n${problems.map((e) => `- ${e}`).join('\n')}`, true));
        }
      }
      return respond(id, handler(args));
    } catch (err) {
      return respond(id, text(`${params.name} failed: ${err.message}`, true));
    }
  }
  if (typeof id === 'undefined') return; // notification
  return respondError(id, -32601, `Unknown method: ${method}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      respondError(null, -32700, 'Parse error');
      continue;
    }
    // Valid JSON that is not a Request object is -32600, not a parse error, and must
    // not be silently dropped: destructuring a number or string yields id undefined,
    // which dispatch treated as a notification and answered with nothing at all.
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) {
      respondError(null, -32600, 'Invalid Request');
      continue;
    }
    try {
      dispatch(msg);
    } catch (err) {
      respondError(msg.id ?? null, -32603, `Internal error: ${err.message}`);
    }
  }
});
process.stdin.on('end', () => process.exit(0));
