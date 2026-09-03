#!/usr/bin/env node
/**
 * Install Foundry into a project.
 *
 * Two modes:
 *
 *   marketplace (default) — configure the project to pull Foundry from the plugin
 *     marketplace. Nothing is copied; updates arrive through `/plugin update`.
 *
 *   local — copy the selected plugins' agents, skills, hooks and MCP config into the
 *     project's own `.claude/` directory. For projects that must not depend on a
 *     marketplace, or that vendor their tooling. Updates require re-running this.
 *
 *   node scripts/install.mjs --profile angular-spring-enterprise --target ../my-app
 *   node scripts/install.mjs --mode local --plugins foundry-core,foundry-dev --target ../my-app
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Set by runFoundry when a step fails, so the installer cannot end on "Done." after an error.
let failed = false;

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) usage(0);

const target = path.resolve(args.target || process.cwd());
const mode = args.mode || 'marketplace';
if (!['marketplace', 'local'].includes(mode)) usage(1, `unknown mode "${mode}"`);
if (!fs.existsSync(target)) usage(1, `target directory does not exist: ${target}`);
if (path.resolve(target) === REPO) usage(1, 'refusing to install Foundry into the Foundry repository itself');

const profile = args.profile ? readProfile(args.profile) : null;
const plugins = (args.plugins ? String(args.plugins).split(',') : profile?.plugins || ['foundry-core']).map((p) => p.trim());

for (const p of plugins) {
  if (!fs.existsSync(path.join(REPO, 'plugins', p))) usage(1, `unknown plugin "${p}"`);
}
if (!plugins.includes('foundry-core')) plugins.unshift('foundry-core');

console.log(`Installing Foundry into ${target}`);
console.log(`  mode:    ${mode}`);
console.log(`  profile: ${profile ? profile.id : '(none)'}`);
console.log(`  plugins: ${plugins.join(', ')}\n`);

if (args['dry-run']) {
  console.log('Dry run: nothing was written.');
  process.exit(0);
}

const claudeDir = path.join(target, '.claude');
fs.mkdirSync(claudeDir, { recursive: true });
const settingsPath = path.join(claudeDir, 'settings.json');
const settings = readJson(settingsPath) || {};

if (mode === 'marketplace') {
  settings.extraKnownMarketplaces = {
    ...(settings.extraKnownMarketplaces || {}),
    foundry: { source: { source: 'github', repo: 'fedcal/foundry' } },
  };
  // Same record-vs-array mismatch as the CLI: read either shape, write the record.
  const alreadyEnabled = Array.isArray(settings.enabledPlugins)
    ? settings.enabledPlugins
    : Object.entries(settings.enabledPlugins || {}).filter(([, on]) => on).map(([k]) => k);
  settings.enabledPlugins = Object.fromEntries(
    unique([...alreadyEnabled, ...plugins.map((p) => `${p}@foundry`)]).map((k) => [k, true]),
  );
} else {
  installLocally();
}

if (profile) {
  settings.permissions = mergePermissions(settings.permissions || {}, profile.permissions || {});
}

writeJson(settingsPath, settings);
console.log(`  wrote ${path.relative(target, settingsPath)}`);

// Foundry project state
runFoundry(['init']);
if (profile?.foundryConfig) {
  const cfgPath = path.join(target, '.foundry', 'config.json');
  writeJson(cfgPath, { ...(readJson(cfgPath) || {}), ...profile.foundryConfig });
  console.log(`  wrote ${path.relative(target, cfgPath)}`);
}

wireClaudeMd();

if (failed) {
  console.error('\nInstall finished with errors — see above. State may be incomplete.');
  process.exitCode = 1;
} else {
  console.log('\nDone.');
}
if (mode === 'marketplace') {
  console.log('\nIn Claude Code, run:');
  console.log('  /plugin marketplace add fedcal/foundry');
  for (const p of plugins) console.log(`  /plugin install ${p}@foundry`);
} else {
  console.log('\nRestart Claude Code (or run /reload-plugins) to pick up the copied assets.');
}
console.log('\nThen verify with:  foundry doctor');
if (profile?.notes?.length) {
  console.log('\nProfile notes:');
  for (const n of profile.notes) console.log(`  - ${n}`);
}

/* --------------------------------------------------------------- functions */

function installLocally() {
  const agentsDir = path.join(claudeDir, 'agents');
  const skillsDir = path.join(claudeDir, 'skills');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  let agents = 0;
  let skills = 0;
  const hooks = {};
  const mcpServers = {};

  for (const plugin of plugins) {
    const root = path.join(REPO, 'plugins', plugin);

    const from = path.join(root, 'agents');
    if (fs.existsSync(from)) {
      for (const file of fs.readdirSync(from).filter((f) => f.endsWith('.md'))) {
        fs.copyFileSync(path.join(from, file), path.join(agentsDir, file));
        agents += 1;
      }
    }

    const skillsFrom = path.join(root, 'skills');
    if (fs.existsSync(skillsFrom)) {
      for (const dir of fs.readdirSync(skillsFrom, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        copyTree(path.join(skillsFrom, dir.name), path.join(skillsDir, dir.name));
        skills += 1;
      }
    }

    // Hooks and MCP need absolute paths: ${CLAUDE_PLUGIN_ROOT} only resolves for
    // installed plugins, and these assets are no longer installed as a plugin.
    const hooksFile = path.join(root, 'hooks', 'hooks.json');
    if (fs.existsSync(hooksFile)) {
      const parsed = JSON.parse(
        fs.readFileSync(hooksFile, 'utf8')
          .replaceAll('${CLAUDE_PLUGIN_ROOT}', root)
          .replaceAll('${CLAUDE_PLUGIN_DATA}', path.join(target, '.foundry', 'plugin-data', plugin)),
      );
      for (const [event, entries] of Object.entries(parsed.hooks || {})) {
        hooks[event] = [...(hooks[event] || []), ...entries];
      }
    }

    const mcpFile = path.join(root, '.mcp.json');
    if (fs.existsSync(mcpFile)) {
      // ${CLAUDE_PLUGIN_DATA} is only provided to installed plugins, so in local mode it
      // is redirected to a project-local directory rather than left as an unresolved literal.
      const raw = fs.readFileSync(mcpFile, 'utf8');
      const dataDir = path.join(target, '.foundry', 'plugin-data', plugin);
      if (raw.includes('${CLAUDE_PLUGIN_DATA}')) fs.mkdirSync(dataDir, { recursive: true });
      const parsed = JSON.parse(
        raw
          .replaceAll('${CLAUDE_PLUGIN_ROOT}', root)
          .replaceAll('${CLAUDE_PLUGIN_DATA}', dataDir),
      );
      Object.assign(mcpServers, parsed.mcpServers || {});
    }
  }

  if (Object.keys(hooks).length) mergeHooks(settings, hooks);
  if (Object.keys(mcpServers).length) {
    const mcpPath = path.join(target, '.mcp.json');
    const existing = readJson(mcpPath) || {};
    writeJson(mcpPath, { ...existing, mcpServers: { ...(existing.mcpServers || {}), ...mcpServers } });
    console.log(`  wrote ${path.relative(target, mcpPath)}`);
  }

  console.log(`  copied ${agents} agents and ${skills} skills into ${path.relative(target, claudeDir)}`);
  console.log('  note: local mode pins this copy. Re-run the installer to update.');
}

/**
 * Union Foundry's hook entries into the project's own, per event, and report what happened.
 *
 * A shallow spread (`{ ...settings.hooks, ...hooks }`) merges only at the top level: each hook
 * EVENT is a key whose value is an array, so spreading replaced the project's entire `PreToolUse`
 * array with Foundry's. A project that had its own audit, lint or secret-scanning hook on a shared
 * event lost it silently — the exact class of thing this repository exists to protect.
 *
 * Entries are deduped on the (command, args) pair so re-running the installer stays idempotent.
 */
function mergeHooks(settings, incoming) {
  const existingHooks = settings.hooks || {};
  const out = { ...existingHooks };
  const kept = [];
  for (const [event, entries] of Object.entries(incoming)) {
    const before = Array.isArray(existingHooks[event]) ? existingHooks[event] : [];
    const seen = new Set(before.flatMap((e) => (e.hooks || []).map(hookKey)));
    const added = [];
    for (const entry of entries) {
      const fresh = (entry.hooks || []).filter((h) => !seen.has(hookKey(h)));
      if (!fresh.length && (entry.hooks || []).length) continue; // already installed
      for (const h of fresh) seen.add(hookKey(h));
      added.push((entry.hooks || []).length ? { ...entry, hooks: fresh } : entry);
    }
    out[event] = [...before, ...added];
    if (before.length) kept.push(`${event}: kept ${before.length} existing, added ${added.length}`);
  }
  settings.hooks = out;
  if (kept.length) {
    console.log(`  hooks merged into events that already had entries (${kept.length}):`);
    for (const line of kept) console.log(`    + ${line}`);
  }
}

function hookKey(hook) {
  return JSON.stringify([hook.type, hook.command, hook.args || []]);
}

function wireClaudeMd() {
  const file = path.join(target, 'CLAUDE.md');
  const block = [
    '## Foundry',
    '',
    // No @import: the SessionStart hook already injects the index, so an import here
    // made every session pay for the same file twice.
    'Project memory index: `.foundry/memory/INDEX.md` (injected automatically at session start).',
    '',
    'Retrieve full facts with the `foundry` MCP tool `memory_search`. Do not read `.foundry/memory/facts/` directly.',
    'Before any recurring or error-prone task, check `runbook_list` and follow the runbook if one applies.',
    'Hand work between agents with `blackboard_write`, returning only the artifact path and a short summary.',
  ].join('\n');

  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current.includes('## Foundry')) {
    console.log('  CLAUDE.md already references Foundry, left unchanged');
    return;
  }
  fs.writeFileSync(file, current ? `${current.trimEnd()}\n\n${block}\n` : `${block}\n`);
  console.log(`  ${current ? 'updated' : 'created'} ${path.relative(target, file)}`);
}

function runFoundry(cliArgs) {
  try {
    const out = execFileSync('node', [path.join(REPO, 'plugins', 'foundry-core', 'bin', 'foundry.mjs'), ...cliArgs], {
      cwd: target,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: target },
    });
    for (const line of out.trim().split('\n')) console.log(`  ${line}`);
  } catch (err) {
    console.error(`  foundry ${cliArgs.join(' ')} failed: ${err.message}`);
    // Without this the installer went on to print "Done." and exit 0 after a step
    // that actually failed, leaving the state directory missing.
    failed = true;
    process.exitCode = 1;
  }
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function readProfile(id) {
  const file = path.join(REPO, 'profiles', `${id}.json`);
  if (!fs.existsSync(file)) {
    const available = fs.readdirSync(path.join(REPO, 'profiles')).map((f) => f.replace('.json', ''));
    usage(1, `unknown profile "${id}". Available: ${available.join(', ')}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Union the profile's rules into the existing ones and report exactly what changed.
 * Permissions were previously widened with no diff and no record, and defaultMode was
 * overwritten outright — a user who had chosen a stricter mode was silently relaxed.
 */
function mergePermissions(current, add) {
  const out = { ...current };
  const added = [];
  for (const key of ['allow', 'ask', 'deny']) {
    if (!add[key]) continue;
    const before = current[key] || [];
    out[key] = unique([...before, ...add[key]]);
    for (const rule of out[key]) if (!before.includes(rule)) added.push(`${key}: ${rule}`);
  }
  if (add.defaultMode && add.defaultMode !== current.defaultMode) {
    const RANK = { plan: 0, default: 1, acceptEdits: 2, bypassPermissions: 3 };
    const from = current.defaultMode;
    const to = add.defaultMode;
    // Never loosen silently: tightening is safe, relaxing needs the user to say so.
    if (from !== undefined && (RANK[to] ?? 1) > (RANK[from] ?? 1)) {
      console.log(`  keeping defaultMode "${from}" — the profile suggests "${to}", which is more permissive.`);
      console.log(`  set it yourself in .claude/settings.json if you want it.`);
    } else {
      out.defaultMode = to;
      added.push(`defaultMode: ${from ?? '(unset)'} -> ${to}`);
    }
  }
  if (added.length) {
    console.log(`  permissions added (${added.length}):`);
    for (const line of added) console.log(`    + ${line}`);
  }
  return out;
}

function unique(list) { return [...new Set(list)]; }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}
function usage(code, message) {
  if (message) console.error(`error: ${message}\n`);
  console.log(`Install Foundry into a project.

  node scripts/install.mjs [options]

  --target <dir>      Project to install into (default: current directory)
  --mode <mode>       marketplace (default) or local
  --profile <id>      Apply a profile: ${fs.readdirSync(path.join(REPO, 'profiles')).map((f) => f.replace('.json', '')).join(', ')}
  --plugins <list>    Comma-separated plugin names (overrides the profile's list)
  --dry-run           Show what would happen, write nothing
  --help`);
  process.exit(code);
}
