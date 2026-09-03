#!/usr/bin/env node
/**
 * Validate every Foundry asset against AUTHORING.md.
 *
 * This is the gate that keeps nine plugins written by different authors coherent.
 * It runs in CI and is expected to pass with zero errors before anything is published.
 *
 *   node scripts/validate-assets.mjs [--strict]
 *
 * --strict also fails on warnings. Without it the script exits 0 when only warnings were
 * emitted, but it never claims conformance while any rule is reporting a violation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS = path.join(ROOT, 'plugins');

// Every module-level constant lives here, above the driver loop that runs at import time.
// A `const` declared further down the file is still in its temporal dead zone when that loop
// calls into a function that reads it, and the script dies with a ReferenceError.
const MODELS = ['sonnet', 'opus', 'haiku', 'fable', 'inherit'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const ISOLATIONS = ['worktree', 'remote'];
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
const SKILL_MAX_LINES = 500;
/** Relative paths a skill's prose points at: `references/x.md`, [](scripts/y.mjs), ${CLAUDE_SKILL_DIR}/z. */
const REFERENCE_PATTERNS = [
  /`((?:references|scripts|templates|assets)\/[A-Za-z0-9._\/-]+)`/g,
  /\]\(\.?\/?((?:references|scripts|templates|assets)\/[A-Za-z0-9._\/-]+)\)/g,
  /\$\{CLAUDE_SKILL_DIR\}\/([A-Za-z0-9._\/-]+)/g,
];
/** A bare marketplace source name, per the loader: `/^[A-Za-z0-9][-A-Za-z0-9._]*$/` and no "..". */
const BARE_SOURCE = /^[A-Za-z0-9][-A-Za-z0-9._]*$/;
/** Anything in a hook's args that looks like a script the hook will execute. */
const SCRIPT_ARG = /\.(mjs|cjs|js|sh|bash|py)$/;
const ITALIAN_MARKERS = /\b(deve|questo|perché|quando|viene|della|degli|nella|essere|sono|anche|come si|non è)\b/i;

const errors = [];
const warnings = [];
const stats = { plugins: 0, agents: 0, skills: 0, hooks: 0, workflows: 0, schemas: 0, outputStyles: 0 };

const err = (file, msg) => errors.push(`${rel(file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${rel(file)}: ${msg}`);
const rel = (f) => path.relative(ROOT, f);

/* ------------------------------------------------------------- marketplace */

const marketplacePath = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const marketplace = readJson(marketplacePath);
if (!marketplace) {
  err(marketplacePath, 'missing or unparseable');
} else {
  for (const field of ['name', 'owner', 'plugins']) {
    if (!marketplace[field]) err(marketplacePath, `missing required field "${field}"`);
  }
  // metadata.pluginRoot is a real, honoured key. Claude Code 2.1.239 shipped "Fixed marketplace
  // `metadata.pluginRoot` having no effect: bare plugin source names now resolve under it as the
  // docs describe", and the manifest schema documents it as the "Base directory for bare plugin
  // source names, relative to the marketplace root ... Sources that already start with "./" are
  // unaffected." Foundry does not need it — every source here is a full "./plugins/<name>" — but
  // the validator models the platform, not this one repository, so it must not fail a correct
  // marketplace for a reason the binary contradicts.
  const declaredRoot = marketplace.metadata?.pluginRoot;
  const pluginRoot = normalisePluginRoot(declaredRoot);
  if (declaredRoot !== undefined && pluginRoot === null) {
    err(marketplacePath, `metadata.pluginRoot "${declaredRoot}" must be a relative path inside the marketplace (e.g. "./plugins")`);
  }
  for (const entry of marketplace.plugins || []) {
    if (!entry.name || !entry.source) err(marketplacePath, `plugin entry needs name and source`);
    // Resolve exactly the way Claude Code does: a "./relative/path" source resolves against the
    // marketplace root; a bare name resolves under metadata.pluginRoot and is refused outright
    // when the marketplace does not set one.
    const dir = resolveSource(entry.source, pluginRoot);
    if (dir === undefined) {
      continue; // a remote source object (npm/url/github/git) — there is no local directory to check
    } else if (dir === null) {
      err(marketplacePath, `plugin "${entry.name}": bare source name "${entry.source}" requires metadata.pluginRoot. Use a "./relative/path" source, or set metadata.pluginRoot (e.g. "./plugins") to allow bare names`);
    } else if (!fs.existsSync(dir)) {
      err(marketplacePath, `plugin "${entry.name}": source "${entry.source}" does not resolve (${rel(dir)})`);
    } else if (!fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json'))) {
      err(marketplacePath, `plugin "${entry.name}": ${rel(dir)} has no .claude-plugin/plugin.json`);
    }
  }
}

/**
 * Normalise metadata.pluginRoot the way the loader does: reject a non-string, an empty string, an
 * absolute path, a backslash or a colon; strip a leading "./" and trailing slashes; reject any
 * "", "." or ".." segment. Returns the normalised root, "." for the marketplace root itself,
 * `undefined` when unset, or `null` when the value is present but unusable.
 */
function normalisePluginRoot(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value === '' || value.startsWith('/') || value.includes('\\') || value.includes(':')) return null;
  const trimmed = value.replace(/^\.\//, '').replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '.') return '.';
  if (trimmed.split('/').some((s) => s === '' || s === '.' || s === '..')) return null;
  return trimmed;
}

/**
 * Absolute directory a marketplace "source" points at, `null` when the loader would refuse it, or
 * `undefined` when the source is one of the loader's remote object forms — `{source:"npm",…}`,
 * `{source:"url",…}`, github/git — which name no local directory and cannot be existence-checked
 * from this repository.
 */
function resolveSource(source, pluginRoot) {
  if (typeof source !== 'string') return undefined;
  if (source === '') return path.resolve(ROOT, '.');
  if (BARE_SOURCE.test(source) && !source.includes('..')) {
    if (pluginRoot === undefined || pluginRoot === null) return null;
    return pluginRoot === '.' ? path.resolve(ROOT, source) : path.resolve(ROOT, pluginRoot, source);
  }
  return path.resolve(ROOT, source);
}

/* --------------------------------------------- MCP reachability (regression) */

/**
 * An explicit tools:/allowed-tools: allowlist excludes MCP tools unless it names
 * them. 34 agents and 47 skills shipped instructing the model to call
 * memory_write / blackboard_write while their own allowlist forbade it — the
 * agent then improvises or claims work it could not do. AUTHORING.md:89 says
 * "omit to inherit all", which is the fix; this makes the regression loud.
 */
/**
 * Claude Code namespaces a plugin-bundled MCP server as `plugin:<plugin>:<serverKey>` and builds
 * the tool prefix from that name, so foundry-core's server key `foundry` resolves to
 * `mcp__plugin_foundry-core_foundry__`. The bare `mcp__foundry__` spelling names nothing: an
 * asset using it sends the model looking for a tool that does not exist. 120 occurrences shipped
 * that way before this check existed, so it stays.
 */
const BARE_MCP = /mcp__foundry__/;

/**
 * A skill's `agent:` is matched against the REGISTERED agent id, and Claude Code registers a
 * plugin agent as `<plugin>:<agent>` (the same shape the Agent tool lists, e.g.
 * `episodic-memory:search-conversations`). A bare name never resolves to the plugin's own agent,
 * and is worse than a no-op: if the user has an unrelated agent of that name from another source,
 * the skill silently routes to a stranger's agent. 32 skills shipped with bare names.
 */
function checkAgentRef(file, data, agentNames) {
  // Read the parsed frontmatter, never a regex over the whole file: several skills document a
  // blackboard artifact in a fenced block whose `agent:` line would otherwise be mistaken for
  // the skill's own routing field.
  if (typeof data.agent !== 'string' || !data.agent.trim()) return;
  const ref = data.agent.trim();
  if (!ref.includes(':')) {
    err(file, `agent: "${ref}" is a bare name; a plugin agent is registered as "<plugin>:<agent>" and a bare name resolves elsewhere or not at all`);
    return;
  }
  if (!agentNames.has(ref)) err(file, `agent: "${ref}" does not match any agent shipped by this marketplace`);
}

function checkMcpPrefix(file, source) {
  if (BARE_MCP.test(source)) {
    err(file, 'names the MCP tool prefix "mcp__foundry__", which does not exist; a plugin server is addressed as "mcp__plugin_foundry-core_foundry__<tool>"');
  }
}

const MCP_PREFIX = 'mcp__plugin_foundry-core_foundry__';
const FOUNDRY_TOOLS = [
  'memory_search', 'memory_write', 'memory_index', 'blackboard_write', 'blackboard_read',
  'contract_validate', 'runbook_list', 'runbook_get', 'token_report',
];

/**
 * Diff the MCP tools the body tells the model to call against the ones its own allowlist admits.
 *
 * Three things this check used to get wrong, all of them ways of passing an asset that is broken:
 *   - it read `^(tools|allowed-tools):` out of the whole file, so a fenced example in the BODY was
 *     mistaken for the asset's own frontmatter field and flagged an asset that has no allowlist;
 *   - `if (fm[0].includes('mcp__')) return` short-circuited the moment the allowlist named ONE mcp
 *     tool, so an allowlist admitting `memory_search` passed a body calling `memory_write`;
 *   - the remediation named the bare `mcp__foundry__` prefix, which resolves to nothing, so an
 *     author who followed the message wrote an allowlist entry matching no tool.
 * It now compares tool by tool, out of the parsed frontmatter only, and names the real prefix.
 */
function checkMcpReachable(file, data, body) {
  const declared = data['tools'] ?? data['allowed-tools'];
  const field = data['tools'] !== undefined ? 'tools' : 'allowed-tools';
  if (typeof declared !== 'string' || !declared.trim()) return; // omitted, or a YAML list we do not parse
  const allowed = declared.split(/[,\s]+/).filter(Boolean);
  // Server-level and global wildcards admit every tool on the server.
  if (allowed.some((t) => t === 'mcp__*' || t === MCP_PREFIX.slice(0, -2) || t === `${MCP_PREFIX}*`)) return;

  const called = new Set();
  for (const tool of FOUNDRY_TOOLS) {
    if (new RegExp(`\\b${tool}\\b`).test(body)) called.add(MCP_PREFIX + tool);
  }
  for (const m of body.matchAll(/mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+/g)) called.add(m[0]);

  const unreachable = [...called].filter((t) => !allowed.includes(t));
  for (const tool of unreachable) {
    err(file, `body calls "${tool}" but "${field}" is an explicit allowlist that does not admit it (omit "${field}" to inherit every tool, or add "${tool}")`);
  }
}

/* ----------------------------------------------------------------- plugins */

/**
 * Registered agent ids, `<plugin>:<agent>`, collected before anything is validated because a
 * skill in one plugin may legitimately route to an agent in another.
 */
const AGENT_IDS = new Set();
for (const plug of fs.readdirSync(PLUGINS).filter((d) => fs.statSync(path.join(PLUGINS, d)).isDirectory())) {
  const agentsDir = path.join(PLUGINS, plug, 'agents');
  if (!fs.existsSync(agentsDir)) continue;
  for (const f of fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md'))) {
    AGENT_IDS.add(`${plug}:${f.replace(/\.md$/, '')}`);
  }
}

for (const name of fs.readdirSync(PLUGINS).filter((d) => fs.statSync(path.join(PLUGINS, d)).isDirectory())) {
  const dir = path.join(PLUGINS, name);
  stats.plugins += 1;

  const manifestPath = path.join(dir, '.claude-plugin', 'plugin.json');
  const manifest = readJson(manifestPath);
  if (!manifest) {
    err(manifestPath, 'missing or unparseable plugin.json');
    continue;
  }
  if (manifest.name !== name) err(manifestPath, `name "${manifest.name}" does not match directory "${name}"`);
  for (const field of ['version', 'description', 'license', 'author']) {
    if (!manifest[field]) err(manifestPath, `missing "${field}"`);
  }
  if (manifest.license !== 'Apache-2.0') err(manifestPath, `license must be Apache-2.0, found "${manifest.license}"`);
  if (name !== 'foundry-core') {
    const deps = manifest.dependencies || [];
    const hasCore = deps.some((d) => (typeof d === 'string' ? d : d.name) === 'foundry-core');
    if (!hasCore) err(manifestPath, 'every vertical plugin must declare a dependency on foundry-core');
  }
  if (!marketplace?.plugins?.some((p) => p.name === name)) {
    err(manifestPath, 'plugin exists on disk but is not listed in marketplace.json');
  }

  validateAgents(path.join(dir, 'agents'));
  validateSkills(path.join(dir, 'skills'));
  validateHooks(path.join(dir, 'hooks', 'hooks.json'));
  validateWorkflows(path.join(dir, 'workflows'));
  validateOutputStyles(path.join(dir, 'output-styles'));
  validatePacks(path.join(dir, 'packs'));
  validateJsonTree(path.join(dir, 'schemas'), (f) => { stats.schemas += 1; return f; });
}

/* --------------------------------------------------------- source encoding */

/**
 * A raw control byte in a source file quietly changes what every tool thinks the file is.
 * git decides text-vs-binary from the first 8000 bytes; GNU grep and file(1) scan the whole
 * file. A NUL past that window — as a test fixture for "malformed stdin" naturally produces —
 * leaves git diffing the file normally while `grep -rn` skips it in silence, so a search that
 * should have matched simply returns nothing and nobody learns why. Move the same byte into
 * the first 8000 and git calls the file binary too, at which point `git grep -nIE` skips it:
 * that command is the entirety of the credential scan in .github/workflows/validate.yml, and
 * a file it skips is a place a real secret can sit unnoticed.
 *
 * A test that needs a NUL byte writes the escape `\x00`. Node builds the identical string
 * from it, and the file stays text for everything else.
 */
const TEXT_EXT = new Set(['.mjs', '.cjs', '.js', '.json', '.md', '.mdx', '.yml', '.yaml']);

function checkSourceEncoding(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { checkSourceEncoding(full); continue; }
    if (!TEXT_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    const nul = fs.readFileSync(full).indexOf(0);
    if (nul >= 0) {
      err(full, `contains a raw NUL byte at offset ${nul} — write it as the escape \\x00 so the file stays text to git, grep and file(1)`);
    }
  }
}

checkSourceEncoding(PLUGINS);
checkSourceEncoding(path.join(ROOT, 'scripts'));

/* ------------------------------------------------------------------ agents */

function validateAgents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const full = path.join(dir, file);
    stats.agents += 1;
    const source = fs.readFileSync(full, 'utf8');
    const { data, body } = frontmatter(source);

    if (!data) { err(full, 'no YAML frontmatter'); continue; }
    if (!data.name) err(full, 'missing required frontmatter field "name"');
    else {
      if (!/^[a-z0-9-]+$/.test(data.name)) err(full, `name "${data.name}" must be lowercase letters, digits and hyphens`);
      if (data.name !== file.replace(/\.md$/, '')) err(full, `name "${data.name}" does not match filename`);
    }
    if (!data.description) err(full, 'missing required frontmatter field "description"');
    else if (data.description.length < 40) warn(full, 'description is very short; it is the routing key Claude uses to pick this agent');

    if (!data.model) err(full, 'missing "model" — every Foundry agent declares its model (AUTHORING.md §2)');
    else if (!MODELS.includes(data.model) && !/^claude-/.test(data.model)) err(full, `model "${data.model}" is not a valid alias or model id`);

    if (!data.effort) err(full, 'missing "effort" — every Foundry agent declares its effort (AUTHORING.md §2)');
    else if (!EFFORTS.includes(data.effort)) err(full, `effort "${data.effort}" is not one of ${EFFORTS.join(', ')}`);

    // The agent-definition frontmatter schema in 2.1.250 is `isolation:le(["worktree","remote"])`.
    // "remote" runs the agent in a remote cloud environment; its availability is gated, and when
    // it is unavailable the runtime falls back to "worktree" or a local agent with a warning
    // rather than failing — so it is a legal declaration and the validator must not reject it.
    if (data.isolation && !ISOLATIONS.includes(data.isolation)) {
      err(full, `isolation "${data.isolation}" is not one of ${ISOLATIONS.join(', ')}`);
    }
    // Out-of-enum colours are not rejected by the loader, they are silently discarded
    // (`function wqe(e,o){...if(Fd.includes(o))n.set(e,o)}`), so the author's intent vanishes with
    // no runtime signal at all. Fd = Object.keys($k) = the eight values below.
    if (data.color && !COLORS.includes(data.color)) {
      err(full, `color "${data.color}" is not a subagent colour; Claude Code silently drops anything outside ${COLORS.join(', ')}`);
    }
    // Verbatim from the loader: `for (let cn of ["permissionMode","hooks","mcpServers"]) if
    // (P[cn] !== void 0) warn("... which is ignored for plugin agents")`. Every plugin agent in
    // this marketplace is a plugin agent, so these keys are always dead weight plus a warning.
    for (const dead of ['permissionMode', 'mcpServers', 'hooks']) {
      if (data[dead] !== undefined) {
        err(full, `"${dead}" is ignored for plugin agents and makes the loader warn on every load; remove it (AUTHORING.md §1.3)`);
      }
    }

    if (!/##\s*Input contract/i.test(body)) err(full, 'missing "## Input contract" section (AUTHORING.md §4)');
    if (!/##\s*Output contract/i.test(body)) err(full, 'missing "## Output contract" section (AUTHORING.md §4)');

    if (!/does not|not cover|out of scope|will not/i.test(body)) {
      warn(full, 'does not state what it deliberately does NOT cover (AUTHORING.md §5)');
    }
    if (body.trim().length < 600) warn(full, 'body is thin — likely generic filler rather than a specific agent');
    checkLanguage(full, source);
    checkMcpReachable(full, data, body);
    checkMcpPrefix(full, source);
  }
}

/* ------------------------------------------------------------------ skills */

function validateSkills(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name.endsWith('.md') && entry.name !== 'SKILL.md') warn(path.join(dir, entry.name), 'stray markdown file in skills/');
      continue;
    }
    const full = path.join(dir, entry.name, 'SKILL.md');
    if (!fs.existsSync(full)) { err(full, 'skill directory has no SKILL.md'); continue; }
    stats.skills += 1;

    const source = fs.readFileSync(full, 'utf8');
    const { data, body } = frontmatter(source);
    if (!data) { err(full, 'no YAML frontmatter'); continue; }
    if (!data.name) err(full, 'missing "name"');
    else if (data.name !== entry.name) err(full, `name "${data.name}" does not match directory "${entry.name}"`);
    if (!data.description) err(full, 'missing "description" — it is how Claude decides to invoke the skill');
    else if (!/\buse (when|whenever|for|to|it|this|before|after|during)\b|\bwhen (the user|a |an |you|someone|starting|finishing)|\binvoke when\b|\bbefore \b|\bafter \b/i.test(data.description)) {
      warn(full, 'description says what the skill does but not WHEN to use it');
    }
    if (data.model && !MODELS.includes(data.model) && !/^claude-/.test(data.model)) err(full, `invalid model "${data.model}"`);
    if (data.effort && !EFFORTS.includes(data.effort)) err(full, `invalid effort "${data.effort}"`);

    checkAgentRef(full, data, AGENT_IDS);
    checkReferences(full, source, path.join(dir, entry.name), path.dirname(dir));

    const lines = source.split('\n').length;
    if (lines > SKILL_MAX_LINES) err(full, `${lines} lines exceeds the ${SKILL_MAX_LINES}-line limit; move depth into references/`);
    if (body.trim().length < 400) warn(full, 'body is thin — likely filler');
    checkLanguage(full, source);
    checkMcpReachable(full, data, body);
    checkMcpPrefix(full, source);
  }
}

/* -------------------------------------------------------- dangling references */

/**
 * Every relative path a skill points at must exist. Dangling references are the
 * characteristic defect of work produced in parallel: the prose promises a file
 * that was never written, and nobody notices until a user follows the link.
 *
 * The scan follows the reference graph rather than stopping at SKILL.md. Progressive disclosure
 * means the second hop is where most of the prose — and most of the pointers — actually live, so
 * checking only SKILL.md's own source let a dangling path inside `references/*.md` ship silently,
 * which is exactly the defect this function exists to catch. A visited-set guards cycles.
 */
function checkReferences(file, source, skillDir, pluginDir) {
  const visited = new Set([path.resolve(file)]);
  const queue = [[file, source]];
  while (queue.length) {
    const [from, text] = queue.shift();
    const seen = new Set();
    for (const re of REFERENCE_PATTERNS) {
      for (const m of text.matchAll(re)) {
        const ref = m[1].replace(/[.,;:]$/, '');
        if (seen.has(ref)) continue;
        seen.add(ref);
        // A reference may be relative to the skill, or to the plugin root when the skill
        // says so ("at the plugin root"). Both resolve; anything else is dangling.
        const target = [path.join(skillDir, ref), path.join(pluginDir, ref)].find((c) => fs.existsSync(c));
        if (!target) {
          err(from, `references "${ref}", which exists neither in the skill nor at the plugin root`);
          continue;
        }
        const key = path.resolve(target);
        if (target.endsWith('.md') && !visited.has(key) && fs.statSync(target).isFile()) {
          visited.add(key);
          queue.push([target, fs.readFileSync(target, 'utf8')]);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------- hooks */

function validateHooks(file) {
  if (!fs.existsSync(file)) return;
  const cfg = readJson(file);
  if (!cfg) { err(file, 'unparseable hooks.json'); return; }
  const VALID_EVENTS = new Set([
    'SessionStart', 'Setup', 'UserPromptSubmit', 'UserPromptExpansion', 'PreToolUse', 'PermissionRequest',
    'PermissionDenied', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'Notification', 'MessageDisplay',
    'SubagentStart', 'SubagentStop', 'TaskCreated', 'TaskCompleted', 'Stop', 'StopFailure', 'TeammateIdle',
    'InstructionsLoaded', 'ConfigChange', 'CwdChanged', 'DirectoryAdded', 'FileChanged', 'WorktreeCreate',
    'WorktreeRemove', 'PreCompact', 'PostCompact', 'Elicitation', 'ElicitationResult', 'SessionEnd',
  ]);
  for (const [event, entries] of Object.entries(cfg.hooks || {})) {
    if (!VALID_EVENTS.has(event)) err(file, `"${event}" is not a Claude Code hook event`);
    for (const entry of entries) {
      for (const hook of entry.hooks || []) {
        stats.hooks += 1;
        if (hook.type === 'command') {
          if (!hook.args) err(file, `${event}: command hooks must use exec form (command + args) for cross-platform safety`);
          checkHookScript(file, event, hook);
        }
        // Verbatim from the binary: `function iWe(){let e=a.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS;
        // if(e!==void 0&&e>0)return e; let t=0,...; for(let u of o)for(let p of u.hooks)
        // if(p.timeout&&p.timeout*1000>t)t=p.timeout*1000; return Math.max(1500,Math.min(t,60000))}`
        // — so 1500 ms is the FLOOR of the SessionEnd budget, not a shared cap, and the largest
        // declared timeout RAISES it. Declaring a longer timeout is how a SessionEnd hook avoids
        // being cut off, not how it gets cut off. The only silent loss is a timeout above the
        // 60 s ceiling, which is clamped away without a word.
        if (event === 'SessionEnd' && typeof hook.timeout === 'number' && hook.timeout > 60) {
          warn(file, `SessionEnd timeout ${hook.timeout}s is silently clamped to the 60s ceiling on the shared SessionEnd budget (only CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS can raise it further)`);
        }
      }
    }
  }
}

/**
 * Existence-check every script a command hook points at.
 *
 * This used to fire only when an argument literally contained `${CLAUDE_PLUGIN_ROOT}`, so a
 * relative path, or a typo that ate the variable, was skipped entirely and the plugin shipped a
 * hook pointing at nothing: Claude Code logs a spawn failure the user never reads, and the gate is
 * simply absent for the life of the plugin. `${CLAUDE_PLUGIN_ROOT}` is also required, not merely
 * honoured — a bare relative path resolves against the user's cwd once the plugin is installed.
 */
function checkHookScript(file, event, hook) {
  const pluginDir = path.dirname(path.dirname(file)); // <plugin>/hooks/hooks.json -> <plugin>
  for (const raw of hook.args || []) {
    const arg = String(raw);
    if (!SCRIPT_ARG.test(arg)) continue;
    if (arg.includes('${CLAUDE_PLUGIN_DATA}')) continue; // a runtime data path, not a shipped file
    if (!arg.includes('${CLAUDE_PLUGIN_ROOT}')) {
      err(file, `${event}: hook script "${arg}" must be written as "\${CLAUDE_PLUGIN_ROOT}/..."; a bare or relative path resolves against the user's working directory once the plugin is installed`);
    }
    const resolved = arg.replaceAll('${CLAUDE_PLUGIN_ROOT}/', '').replaceAll('${CLAUDE_PLUGIN_ROOT}', '.');
    const script = path.isAbsolute(resolved) ? resolved : path.join(pluginDir, resolved);
    if (!fs.existsSync(script)) err(file, `${event}: hook script not found at ${rel(script)}`);
  }
}

/* --------------------------------------------------------------- workflows */

function validateWorkflows(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const full = path.join(dir, file);
    stats.workflows += 1;
    const source = fs.readFileSync(full, 'utf8');
    if (!/^export const meta = \{/m.test(source)) err(full, 'workflow must begin with `export const meta = {`');
    if (!/name:\s*['"]/.test(source)) err(full, 'meta.name is required');
    if (!/description:\s*['"]/.test(source)) err(full, 'meta.description is required');
    if (/Date\.now\(\)|Math\.random\(\)|new Date\(\)/.test(source)) {
      err(full, 'Date.now(), new Date() and Math.random() throw inside workflows; pass values through args instead');
    }
  }
}

/* ------------------------------------------------------------ output styles */

function validateOutputStyles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const full = path.join(dir, file);
    stats.outputStyles += 1;
    const { data } = frontmatter(fs.readFileSync(full, 'utf8'));
    if (!data?.name) err(full, 'output style needs a "name"');
    if (!data?.description) err(full, 'output style needs a "description"');
  }
}

/* ------------------------------------------------------- jurisdiction packs */

function validatePacks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const full = path.join(dir, file);
    const pack = readJson(full);
    if (!pack) { err(full, 'unparseable JSON'); continue; }

    const header = pack.pack;
    if (!header) { err(full, 'missing "pack" header'); continue; }
    for (const field of ['id', 'name', 'scope']) {
      if (!header[field]) err(full, `pack header missing "${field}"`);
    }
    if (!('lastReviewed' in header)) err(full, 'pack header must carry "lastReviewed" (null until a human confirms it)');
    if (!Array.isArray(header.sources)) err(full, 'pack header must carry a "sources" array, even when empty');
    if (!header.verificationRequired) {
      err(full, 'pack header must state that law changes and controls must be confirmed against the current official text');
    }

    if (!Array.isArray(pack.controls) || !pack.controls.length) { err(full, 'pack has no controls'); continue; }
    for (const c of pack.controls) {
      const where = `${file}#${c.controlId || '(no id)'}`;
      for (const field of ['controlId', 'instrument', 'requirement']) {
        if (!c[field]) err(full, `${where}: control missing "${field}"`);
      }
      if (!c.appliesWhen) warn(full, `${where}: no appliesWhen — the control will be assessed for every project`);
      if (!c.evidenceHints) warn(full, `${where}: no evidenceHints — the engine has nothing to look for`);
      // A specific article citation is acceptable only when the pack points at the official
      // text it came from. Without a source, an article number is an unverifiable assertion.
      const citesArticle = /\bArt\.?\s*\d|\bArticle\s+\d|\bSection\s+\d|§\s*\d/.test(String(c.instrument));
      if (citesArticle && !c.unverifiedCitation && !(header.sources || []).length) {
        warn(full, `${where}: cites a specific article, but the pack lists no official source. Add one to pack.sources, or set unverifiedCitation:true`);
      }
    }
  }
}

function validateJsonTree(dir, tap = (f) => f) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const full = path.join(dir, file);
    tap(full);
    if (!readJson(full)) err(full, 'unparseable JSON');
  }
}

/* ---------------------------------------------------------------- language */

function checkLanguage(file, source) {
  const body = source.replace(/```[\s\S]*?```/g, '');
  if (ITALIAN_MARKERS.test(body)) warn(file, 'looks like it contains Italian; plugin assets must be English (AUTHORING.md §0)');
}

/* ------------------------------------------------------------------ output */

function frontmatter(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!m) return { data: null, body: source };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

console.log('Foundry asset validation\n');
console.log(`  ${stats.plugins} plugins · ${stats.agents} agents · ${stats.skills} skills · ${stats.hooks} hooks · ${stats.workflows} workflows · ${stats.schemas} schemas · ${stats.outputStyles} output styles\n`);

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ~ ${w}`);
  console.log('');
}
if (errors.length) {
  console.log(`Errors (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log('');
  process.exit(1);
}
// Several rules that map to AUTHORING.md §0 non-negotiables and §5 ship-blockers are warnings —
// "English only", "states when NOT to use it", the when-to-use clause in a skill description.
// Printing "All assets conform to AUTHORING.md." two lines under a warning that says an asset
// does not is a false claim about the very contract this script exists to certify, so the
// conformance line is now reserved for a genuinely clean run.
if (warnings.length) {
  const plural = warnings.length === 1 ? '' : 's';
  console.log(`No errors. ${warnings.length} warning${plural} — see above; some map to AUTHORING.md §0/§5, so this is not a conformance claim.`);
  if (process.argv.includes('--strict')) process.exit(1);
} else {
  console.log('All assets conform to AUTHORING.md.');
}
