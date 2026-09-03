#!/usr/bin/env node
/**
 * foundry — Foundry command line.
 *
 * Available on PATH when foundry-core is installed (plugins expose bin/).
 * Zero dependencies; every subcommand is safe to re-run.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  projectRoot, paths, ensureDirs, config, configIssues,
  activeFacts, listFacts, searchFacts, buildIndex, listRunbooks,
  estimateTokens, validate, loadSchema, mergePermissions,
  configState,
} from '../lib/foundry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.join(HERE, '..', 'schemas');

// `projectRoot()` never treats its argument as an answer: it walks up from it to the first
// `.foundry` or `.git`, which is right for a hook (it follows worktrees) and wrong for an
// operator who named a directory. `foundry init` inside a package of a monorepo initialised
// the whole checkout instead. FOUNDRY_PROJECT_DIR is Foundry's own explicit override, so it
// pins the root rather than seeding a search; CLAUDE_PROJECT_DIR keeps the walk-up, because
// the runtime sets it on every session and the hooks resolve it the same way.
const ROOT = process.env.FOUNDRY_PROJECT_DIR
  ? path.resolve(process.env.FOUNDRY_PROJECT_DIR)
  : projectRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const P = paths(ROOT);

const [, , cmd = 'help', ...rest] = process.argv;

const commands = {
  init,
  doctor,
  memory,
  tokens,
  runbooks,
  validateCmd,
  profile,
  help,
};

const alias = { validate: 'validateCmd', runbook: 'runbooks', help: 'help', '--help': 'help', '-h': 'help' };
const fn = commands[alias[cmd] || cmd];
if (!fn) {
  console.error(`Unknown command "${cmd}".\n`);
  help();
  process.exit(1);
}
await fn(rest);

/* ---------------------------------------------------------------- commands */

function init() {
  const created = !fs.existsSync(P.base);
  ensureDirs(ROOT);

  if (!fs.existsSync(P.config)) {
    fs.writeFileSync(P.config, JSON.stringify({
      enforcement: 'gate',
      indexTokenBudget: 4000,
      handoffSummaryTokenBudget: 300,
      secretScan: true,
      verifyOnStop: true,
      protectedPaths: ['.github/workflows/**', '**/*.lock', 'package-lock.json', 'db/migrations/**'],
    }, null, 2) + '\n');
  }

  if (!fs.existsSync(P.overrides)) {
    fs.writeFileSync(P.overrides, JSON.stringify({
      _comment: 'Each override must state why it exists and when it expires. Expired overrides stop applying.',
      overrides: [],
    }, null, 2) + '\n');
  }

  const gitignore = path.join(ROOT, '.gitignore');
  // Wave artefacts hold intermediate output — code excerpts, security findings —
  // and were committed by default.
  const entries = ['.foundry/scratch/', '.foundry/metrics/', '.foundry/blackboard/'];
  const current = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  const missing = entries.filter((e) => !current.includes(e));
  if (missing.length) {
    fs.appendFileSync(gitignore, `${current.endsWith('\n') || !current ? '' : '\n'}\n# Foundry (session-local state)\n${missing.join('\n')}\n`);
  }

  buildIndex(ROOT);
  console.log(`${created ? 'Initialised' : 'Repaired'} Foundry state in ${path.relative(process.cwd(), P.base) || '.foundry'}`);
  console.log('Next: seed memory with the `foundry-init` skill, then run `foundry doctor`.');
}

function doctor() {
  const checks = [];
  const add = (ok, label, detail = '') => checks.push({ ok, label, detail });

  add(fs.existsSync(P.base), '.foundry state directory exists', P.base);
  // Three states, not two. "absent" used to take the else branch, so doctor printed
  // "ok config.json present" for a file that does not exist — the same class of lie the
  // check was written to stop. Absent means every setting is a default, which is exactly
  // what a user debugging ignored protectedPaths needs to be told.
  const cfgState = configState(ROOT);
  if (cfgState === 'unreadable') add(false, 'config.json is not valid JSON — every setting in it is being ignored', P.config);
  else if (cfgState === 'absent') add(false, 'config.json missing — running on built-in defaults; run `foundry init`', P.config);
  else add(true, 'config.json present and parses as JSON');

  // A wrong type is not a parse error: `"protectedPaths": "**/*.lock"` parses, and used to
  // reach the write gate as a string and crash it. Rejected settings are named here rather
  // than left to be discovered as a broken gate.
  if (cfgState === 'ok') {
    const issues = configIssues(ROOT);
    add(issues.length === 0, 'every setting in config.json has the right type', issues.join('\n         '));
  }

  const cfg = config(ROOT);
  add(['gate', 'warn', 'off'].includes(cfg.enforcement), `enforcement level is valid ("${cfg.enforcement}")`);

  const facts = activeFacts(ROOT);
  const all = listFacts(ROOT);
  add(true, `${facts.length} active facts (${all.length - facts.length} expired or superseded)`);

  // A diagnostic must not create the state it is diagnosing: buildIndex calls ensureDirs.
  if (fs.existsSync(P.base)) {
    const idx = buildIndex(ROOT);
    // The old detail said "consolidate them" and named nothing, while the command it sent
    // the operator to knew nothing about the budget. `foundry memory prune` now lists the
    // facts that fell outside it. Truncation also follows a fixed type priority, so past a
    // few hundred facts a whole type can vanish from the always-loaded index: say which.
    const omittedIds = new Set(idx.omitted.map((f) => f.id));
    const listedTypes = new Set(facts.filter((f) => !omittedIds.has(f.id)).map((f) => f.type));
    const lostTypes = [...new Set(idx.omitted.map((f) => f.type))].filter((t) => !listedTypes.has(t));
    add(idx.dropped === 0, `index within budget (~${idx.tokens}/${cfg.indexTokenBudget} tokens)`,
      idx.dropped
        ? `${idx.dropped} facts omitted — run \`foundry memory prune\` for the list${lostTypes.length ? `\n         no ${lostTypes.join(', ')} fact reaches the index at all` : ''}`
        : '');
  } else {
    add(false, 'index not built — run `foundry init` first');
  }

  const dupes = duplicateTitles(facts);
  add(dupes.length === 0, 'no duplicate fact titles', dupes.join(', '));

  const missingWhy = facts.filter((f) => ['decision', 'risk'].includes(f.type) && !/\*\*Why:\*\*/.test(f.body || ''));
  add(missingWhy.length === 0, 'every decision and risk records its reasoning',
    missingWhy.map((f) => f.id).join(', '));

  const books = listRunbooks(ROOT);
  const noRollback = books.filter((b) => {
    const text = fs.readFileSync(b.file, 'utf8');
    return /deploy|migrat|release|delete|drop/i.test(text) && !/##\s*Rollback/i.test(text);
  });
  add(noRollback.length === 0, `${books.length} runbooks, all mutating ones document rollback`,
    noRollback.map((b) => b.slug).join(', '));

  const overrides = readJson(P.overrides)?.overrides || [];
  const today = new Date().toISOString().slice(0, 10);
  const expired = overrides.filter((o) => o.expires && o.expires < today);
  add(expired.length === 0, 'no expired gate overrides still in the file', expired.map((o) => o.gate).join(', '));

  const bad = invalidArtifacts();
  add(bad.length === 0, 'every blackboard artifact validates against its contract', bad.join('; '));

  let failures = 0;
  for (const c of checks) {
    if (!c.ok) failures += 1;
    console.log(`${c.ok ? '  ok  ' : ' FAIL '} ${c.label}${c.detail ? `\n         ${c.detail}` : ''}`);
  }
  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exitCode = failures ? 1 : 0;
}

function memory([sub = 'index', ...args]) {
  if (sub === 'index') {
    const r = buildIndex(ROOT);
    console.log(`${r.listed}/${r.facts} facts listed, ~${r.tokens} tokens, ${r.dropped} omitted.`);
    return;
  }
  if (sub === 'search') {
    const hits = searchFacts(ROOT, args.join(' '), { limit: 10 });
    if (!hits.length) return console.log('No match.');
    for (const h of hits) console.log(`${h.id}  [${h.type}/${h.confidence}]  ${h.title}`);
    return;
  }
  if (sub === 'prune') {
    const today = new Date().toISOString().slice(0, 10);
    const all = listFacts(ROOT);
    const superseded = new Set(all.map((f) => f.supersedes).filter(Boolean));
    const expired = all.filter((f) => f.expires && f.expires < today);
    const dead = all.filter((f) => superseded.has(f.id));
    const noWhy = all.filter((f) => ['decision', 'risk'].includes(f.type) && !/\*\*Why:\*\*/.test(f.body || ''));
    const dupes = duplicateTitles(all);

    // The truncation footer and doctor's failing budget check both send the operator here,
    // and prune knew only about expired, superseded and malformed facts — none of which
    // shrink a healthy index. On a project with 400 valid facts it had nothing to say while
    // doctor reported 248 omitted. The facts outside the budget are the candidates.
    const idx = fs.existsSync(P.base) ? buildIndex(ROOT) : { dropped: 0, omitted: [], tokens: 0 };
    const cfg = config(ROOT);

    console.log('Prune candidates (nothing is deleted automatically):\n');
    report('expired', expired.map((f) => `${f.id} — expired ${f.expires}`));
    report('superseded', dead.map((f) => `${f.id} — superseded by a newer fact`));
    report('missing reasoning', noWhy.map((f) => `${f.id} — add a **Why:** line`));
    report('duplicate titles', dupes);
    if (idx.dropped) {
      report(`outside the ~${cfg.indexTokenBudget}-token index budget (${idx.dropped} facts, lowest priority first)`,
        idx.omitted.slice(0, 40).map((f) => `${f.id} · ${f.type} · ${f.title}`));
      if (idx.omitted.length > 40) console.log(`    ... and ${idx.omitted.length - 40} more`);
      console.log('\n  These are retrievable with `memory_search` but never reach the always-loaded index.');
      console.log('  Consolidate several into one fact, expire what no longer holds, or raise');
      console.log('  `indexTokenBudget` in .foundry/config.json and pay for it every session.');
    }
    console.log('\nRetire a fact by setting `expires`, not by deleting it: the history of a decision is part of its value.');
    return;
  }
  console.error('Usage: foundry memory [index|search <query>|prune]');
  process.exitCode = 1;
}

/**
 * The plugins enabled for this project, or null if no settings file names one.
 *
 * Claude Code merges `enabledPlugins` across scopes — user, then project, then project-local
 * — and `/plugin install` records enablement in the USER file. Reading only the project's
 * settings.json meant that in a normal marketplace install nothing was ever scoped out, and
 * the figure below silently became "every plugin in the tree". Later scopes win, and a value
 * of `false` is a disable, not an absence.
 */
function enabledPluginNames() {
  const files = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(ROOT, '.claude', 'settings.json'),
    path.join(ROOT, '.claude', 'settings.local.json'),
  ];
  const state = {};
  let sawAny = false;
  for (const file of files) {
    const settings = readJson(file);
    const raw = settings && typeof settings === 'object' ? settings.enabledPlugins : null;
    if (!raw) continue;
    const entries = Array.isArray(raw) ? raw.map((k) => [k, true]) : Object.entries(raw);
    for (const [key, on] of entries) {
      state[String(key).split('@')[0]] = Boolean(on);
      sawAny = true;
    }
  }
  if (!sawAny) return null;
  return new Set(Object.entries(state).filter(([, on]) => on).map(([name]) => name));
}

/**
 * Agent and skill `description:` lines are routing metadata: they sit in context for the
 * whole session, for every enabled plugin. Reporting a memory saving while omitting the
 * one cost Foundry itself adds made the headline percentage flattering by construction.
 * When the plugin tree cannot be located we say so rather than quietly reporting zero.
 */
function pluginSurface() {
  // No existence guard: this resolves to the grandparent of the file currently executing, so
  // it exists by construction, and path.resolve clamps at the filesystem root rather than
  // walking past it. The guard that used to stand here could not be made true by any input,
  // environment or layout — dead code in the shape of a live check, which reads as a handled
  // case and is not one. If this ever needs to survive a pruned install, make the directory
  // injectable so the arm is reachable and can be tested.
  const pluginsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const enabled = enabledPluginNames();
  const describe = (file) => {
    const m = fs.readFileSync(file, 'utf8').match(/^description:\s*(.+)$/m);
    return m ? estimateTokens(m[1]) : 0;
  };
  let agents = 0;
  let skills = 0;
  let total = 0;
  let counted = 0;
  for (const name of fs.readdirSync(pluginsDir)) {
    const dir = path.join(pluginsDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (enabled && !enabled.has(name)) continue;
    counted += 1;
    const agentDir = path.join(dir, 'agents');
    if (fs.existsSync(agentDir)) {
      for (const a of fs.readdirSync(agentDir).filter((x) => x.endsWith('.md'))) {
        agents += 1;
        total += describe(path.join(agentDir, a));
      }
    }
    const skillDir = path.join(dir, 'skills');
    if (fs.existsSync(skillDir)) {
      for (const sk of fs.readdirSync(skillDir)) {
        const file = path.join(skillDir, sk, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        skills += 1;
        total += describe(file);
      }
    }
  }
  return { total, agents, skills, plugins: counted, scoped: Boolean(enabled) };
}

function tokens() {
  const cfg = config(ROOT);
  const idx = fs.existsSync(P.index) ? fs.readFileSync(P.index, 'utf8') : '';
  const facts = activeFacts(ROOT);
  const factTokens = facts.reduce((n, f) => n + estimateTokens(`${f.title}\n${f.body}`), 0);
  const bbTokens = dirTokens(P.blackboard);
  const runbookTokens = listRunbooks(ROOT).reduce((n, b) => n + estimateTokens(fs.readFileSync(b.file, 'utf8')), 0);

  console.log('Foundry token accounting\n');
  console.log(`  memory index (always loaded)   ~${estimateTokens(idx)} tokens  (budget ${cfg.indexTokenBudget})`);
  console.log(`  facts, retrieved on demand     ~${factTokens} tokens across ${facts.length} facts`);
  console.log(`  runbooks, retrieved on demand  ~${runbookTokens} tokens`);
  console.log(`  blackboard artifacts           ~${bbTokens} tokens (never loaded wholesale)`);
  const surface = pluginSurface();
  if (surface.scoped) {
    console.log(`  plugin surface (always loaded)  ~${surface.total} tokens — ${surface.agents} agent and ${surface.skills} skill descriptions across ${surface.plugins} enabled plugin${surface.plugins === 1 ? '' : 's'}`);
  } else {
    // Nothing in any settings scope names a plugin, so this is not a measurement of what
    // this project loads: it is what the whole tree would cost with every plugin enabled.
    console.log(`  plugin surface (upper bound)    ~${surface.total} tokens — ${surface.agents} agent and ${surface.skills} skill descriptions across all ${surface.plugins} plugins in the tree`);
    console.log('                                 no settings file names an enabled plugin, so this is a ceiling, not a measurement');
  }
  console.log('');
  const eager = factTokens + runbookTokens + bbTokens;
  const lazy = estimateTokens(idx);
  console.log(`  eager loading would cost       ~${eager} tokens per session`);
  console.log(`  index-first costs              ~${lazy} tokens per session`);
  if (eager > 0) console.log(`  saving                         ~${Math.max(0, eager - lazy)} tokens per session (${Math.round((1 - lazy / Math.max(eager, 1)) * 100)}%)`);
  if (surface.plugins > 0) {
    console.log(`\n  The saving above is about memory only. Foundry ${surface.scoped ? 'also adds' : 'would add at most'} ~${surface.total} tokens`);
    console.log('  of plugin surface to every session; disable the verticals you are not using.');
  }
  console.log('\nEstimates use ~4 characters per token. For billed usage see /cost and /usage.');
}

function runbooks() {
  const books = listRunbooks(ROOT);
  if (!books.length) return console.log('No runbooks. Create one with the `runbook` skill after any task worth repeating.');
  for (const b of books) console.log(`${b.slug.padEnd(28)} ${b.title}${b.trigger ? `\n${' '.repeat(29)}trigger: ${b.trigger}` : ''}`);
}

function validateCmd([schemaId, target]) {
  if (!schemaId || !target) {
    console.error('Usage: foundry validate <schema-id> <path-to-json>');
    process.exitCode = 1;
    return;
  }
  const loaded = loadSchema(schemaId, SCHEMA_DIR);
  if (!loaded) {
    console.error(`Unknown contract "${schemaId}". Available: ${availableSchemas().join(', ')}`);
    process.exitCode = 1;
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    // A missing or malformed file is a user error, not a crash: a raw ENOENT stack
    // trace tells the user nothing about what to do next.
    console.error(`Cannot read ${target}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = validate(loaded.schema, data, { schemaDir: loaded.dir });
  if (!errors.length) return console.log(`VALID against ${schemaId}`);
  console.error(`INVALID against ${schemaId}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
}

/** Profiles ship at the repository root, which sits at different depths depending on
 *  whether Foundry runs from a clone or from an installed plugin. Try both rather than
 *  assuming one layout. */
function profilesDir() {
  // FOUNDRY_PROFILES_DIR pins the directory outright, exactly as FOUNDRY_PROJECT_DIR pins the
  // root above. Without it, candidate 2 always resolves to the checked-in profiles/ of
  // whichever clone is executing, so candidate 3 is never consulted and the directory can
  // never be absent — which made every error message below this function unreachable from a
  // test, including the three written for the user the message at line 403 invites to drop a
  // hand-written profile into ./profiles/.
  if (process.env.FOUNDRY_PROFILES_DIR) return path.resolve(process.env.FOUNDRY_PROFILES_DIR);
  const candidates = [
    path.join(HERE, '..', 'profiles'),                    // bundled inside the plugin
    path.join(HERE, '..', '..', '..', 'profiles'),        // repository / marketplace clone
    path.join(ROOT, 'profiles'),                          // the project being worked on
  ];
  return candidates.find((d) => fs.existsSync(d)) || candidates[1];
}

/**
 * Accept both the legacy array form and the record form Claude Code writes, and keep every
 * entry — including the ones set to `false`.
 *
 * Rebuilding the record from the truthy entries alone deleted every explicit `false`, which
 * is not a redundant entry: the runtime's plugin manifest carries `defaultEnabled`, and its
 * own description says "Explicit enabledPlugins values always win", so an absent key falls
 * back to the manifest while `false` is a deliberate off switch. Dropping it re-enabled a
 * plugin the user had turned off — the opposite of the set union the docs promise.
 */
function mergeEnabledPlugins(current, plugins) {
  const kept = Array.isArray(current)
    ? Object.fromEntries(current.map((k) => [k, true]))
    : { ...(current || {}) };
  for (const p of plugins) kept[`${p}@foundry`] = true;
  return kept;
}

function profile([name]) {
  const dir = profilesDir();
  // This guard used to sit inside the no-argument branch, so on a plugin-only install
  // `foundry profile startup-mvp` answered `No profile "startup-mvp".` — which names neither
  // the real cause (there is no profiles directory at all) nor anything the user could run
  // next. Checking it before the split means both spellings of the command say the same true
  // thing.
  if (!fs.existsSync(dir)) {
    console.error('No profiles directory found next to this installation.');
    console.error('Profiles ship with the Foundry repository: clone it, or copy a profile JSON into ./profiles/.');
    process.exitCode = 1;
    return;
  }
  if (!name) {
    console.log('Available profiles:\n');
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      // One unreadable file in profiles/ used to take the whole listing down with a raw
      // SyntaxError, and the message above invites users to drop their own JSON in here.
      const p = readJson(path.join(dir, f));
      if (!p || typeof p !== 'object') { console.log(`  ${f.replace(/\.json$/, '').padEnd(26)} (not valid JSON — skipped)`); continue; }
      console.log(`  ${String(p.id || f.replace(/\.json$/, '')).padEnd(26)} ${p.description || ''}`);
    }
    console.log('\nApply one with: foundry profile <id>');
    return;
  }
  // A profile id names a file in the profiles directory and nothing else. Interpolating the
  // argument straight into a path let `foundry profile ../../something` read and apply an
  // arbitrary JSON file from disk, and crash on it.
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`"${name}" is not a profile id. Ids are lowercase words separated by hyphens; run \`foundry profile\` to list them.`);
    process.exitCode = 1;
    return;
  }
  const file = path.join(dir, `${name}.json`);
  if (!fs.existsSync(file)) {
    // Every sibling error in this file names a recovery — the id-format rejection points at
    // `foundry profile`, the unknown-contract error lists the schemas — and this one did not.
    // The names come from the filenames rather than each profile's `id` field, because the
    // lookup above is by filename: an id that disagrees with its filename is not something
    // the user could type here.
    const available = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
    console.error(`No profile "${name}".${available.length ? ` Available: ${available.sort().join(', ')}` : ' The profiles directory is empty.'}`);
    process.exitCode = 1;
    return;
  }
  const prof = readJson(file);
  if (!prof || typeof prof !== 'object' || Array.isArray(prof)) {
    console.error(`Profile "${name}" is not a JSON object: ${file}`);
    process.exitCode = 1;
    return;
  }
  if (!Array.isArray(prof.plugins) || !prof.plugins.every((p) => typeof p === 'string')) {
    console.error(`Profile "${name}" declares no "plugins" array, so there is nothing to apply: ${file}`);
    process.exitCode = 1;
    return;
  }
  prof.id = typeof prof.id === 'string' ? prof.id : name;
  const settingsDir = path.join(ROOT, '.claude');
  fs.mkdirSync(settingsDir, { recursive: true });
  const settingsPath = path.join(settingsDir, 'settings.json');

  // `readJson() || {}` treated "the file is not valid JSON" as "there is no file", and the write
  // below then replaced the user's settings with a profile-only object — silently discarding
  // hooks, statusLine, env, model and every permission rule, while the docs promise the file is
  // "merged, never replaced". A file we cannot read is a file we must not overwrite. Claude Code
  // itself rejects a settings file with a trailing comma, so this is a state users really reach.
  let current = {};
  if (fs.existsSync(settingsPath)) {
    const parsed = readJson(settingsPath);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error(`Refusing to apply a profile: ${settingsPath} is not a JSON object.`);
      console.error('Applying the profile now would replace its contents. Fix the file, then re-run.');
      process.exitCode = 1;
      return;
    }
    current = parsed;
  }

  // `foundry profile` is documented as the safe one-command way to configure a project, so
  // it must not quietly relax the project's permission posture. mergePermissions refuses to
  // loosen defaultMode and reports every rule it added; printing is the caller's job.
  const { permissions, notices } = mergePermissions(current.permissions || {}, prof.permissions || {});

  const merged = {
    ...current,
    extraKnownMarketplaces: {
      ...(current.extraKnownMarketplaces || {}),
      foundry: { source: { source: 'github', repo: 'fedcal/foundry' } },
    },
    // Claude Code stores enabledPlugins as a record {"<plugin>@<marketplace>": bool}.
    // Spreading that object into an array threw "is not iterable" on every project
    // that already had plugins enabled — which is every real project.
    enabledPlugins: mergeEnabledPlugins(current.enabledPlugins, prof.plugins),
    permissions,
  };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');

  ensureDirs(ROOT);
  const cfg = { ...config(ROOT), ...(prof.foundryConfig || {}) };
  fs.writeFileSync(P.config, JSON.stringify(cfg, null, 2) + '\n');

  console.log(`Applied profile "${prof.id}".`);
  console.log(`  plugins:  ${prof.plugins.join(', ')}`);
  console.log(`  settings: ${path.relative(ROOT, settingsPath)}`);
  for (const line of notices) console.log(`  ${line}`);
  console.log(`  config:   ${path.relative(ROOT, P.config)} (enforcement: ${cfg.enforcement})`);

  // A profile carries advice the CLI used to silently drop. A recommendation nobody is told
  // about is the same as no recommendation.
  if (prof.recommendedMcpServers?.length) {
    console.log(`\nRecommended MCP servers: ${prof.recommendedMcpServers.join(', ')}`);
    console.log('  Foundry configures its own server; the rest are yours to add.');
  }
  if (prof.jurisdictionPacks?.length) {
    console.log(`\nJurisdiction packs in scope: ${prof.jurisdictionPacks.join(', ')}`);
  }
  if (prof.notes?.length) {
    console.log('\nNotes:');
    for (const n of prof.notes) console.log(`  - ${n}`);
  }
  console.log('\nRestart Claude Code, or run /reload-plugins, for the change to take effect.');
}

function help() {
  console.log(`foundry — Foundry for Claude Code

  foundry init                  create or repair .foundry state in this project
  foundry doctor                check state, memory, runbooks and artifacts
  foundry memory index          rebuild the memory index
  foundry memory search <q>     search stored facts
  foundry memory prune          list expired, superseded and malformed facts, and the
                                facts that fall outside the index token budget
  foundry tokens                report what this project's memory costs per session
  foundry runbooks              list available runbooks
  foundry validate <id> <file>  validate a JSON artifact against a contract
  foundry profile [name]        list or apply a project profile

Project root: ${ROOT}`);
}

/* ----------------------------------------------------------------- helpers */

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function availableSchemas() {
  if (!fs.existsSync(SCHEMA_DIR)) return [];
  return fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.schema.json')).map((f) => f.replace('.schema.json', ''));
}
function duplicateTitles(facts) {
  const seen = new Map();
  const dupes = [];
  for (const f of facts) {
    const key = String(f.title || '').toLowerCase().trim();
    if (seen.has(key)) dupes.push(`${seen.get(key)} / ${f.id}`);
    else seen.set(key, f.id);
  }
  return dupes;
}
function invalidArtifacts() {
  const bad = [];
  if (!fs.existsSync(P.blackboard)) return bad;
  for (const wave of fs.readdirSync(P.blackboard)) {
    const dir = path.join(P.blackboard, wave);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const full = path.join(dir, file);
      const data = readJson(full);
      if (!data) { bad.push(`${wave}/${file}: not valid JSON`); continue; }
      const loaded = data.schema ? loadSchema(data.schema, SCHEMA_DIR) : null;
      if (!loaded) { bad.push(`${wave}/${file}: unknown or missing schema`); continue; }
      const errors = validate(loaded.schema, data, { schemaDir: loaded.dir });
      if (errors.length) bad.push(`${wave}/${file}: ${errors.length} violation(s)`);
    }
  }
  return bad;
}
function dirTokens(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirTokens(full) : estimateTokens(fs.readFileSync(full, 'utf8'));
  }
  return total;
}
function report(label, items) {
  if (!items.length) return;
  console.log(`  ${label}:`);
  for (const i of items) console.log(`    - ${i}`);
}
