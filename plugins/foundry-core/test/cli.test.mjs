/**
 * End-to-end tests for the `foundry` CLI (bin/foundry.mjs), the fan-out runner
 * (scripts/fanout.mjs) and the installer (scripts/install.mjs).
 *
 * These three ship with zero test coverage today. Real bugs have escaped as a
 * result: a crash on a legitimate config shape, an unvalidated --concurrency
 * that exited 0 having done no work, and an installer that printed "Done."
 * after a step had already failed. Every test here runs the real script as a
 * subprocess, in its own temporary directory, and cleans up after itself. No
 * test writes into this repository's own working copy.
 *
 * A few tests encode the *correct* behaviour rather than the current one, where
 * the current behaviour is a bug this file cannot fix (only bin/foundry.mjs,
 * scripts/install.mjs and scripts/fanout.mjs would need to change, and this
 * task's mandate is this file only). Those tests are marked BUG and are
 * expected to fail until the underlying script is fixed; see the summary this
 * agent reported alongside this file.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..', '..');
const CLI = path.join(HERE, '..', 'bin', 'foundry.mjs');
const FANOUT = path.join(HERE, '..', 'scripts', 'fanout.mjs');
const INSTALL = path.join(REPO, 'scripts', 'install.mjs');
const PROFILES_DIR = path.join(REPO, 'profiles');
const PROFILE_IDS = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

/* ------------------------------------------------------------------ setup */

const tempDirs = [];

/** A fresh, isolated project directory with its own git repo. */
function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-cli-'));
  tempDirs.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** Run the foundry CLI in `cwd`. Never throws: returns {status, stdout, stderr}. */
function runCli(cwd, args) {
  try {
    const env = { ...process.env, FOUNDRY_PROJECT_DIR: cwd };
    const stdout = execFileSync('node', [CLI, ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: typeof err.status === 'number' ? err.status : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listAllFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAllFiles(full));
    else out.push(full);
  }
  return out;
}

/* -------------------------------------------------------------------- init */

describe('foundry init', () => {
  test('creates the full .foundry structure with valid defaults', () => {
    const dir = makeProject();
    const r = runCli(dir, ['init']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Initialised Foundry state/);

    const base = path.join(dir, '.foundry');
    for (const sub of ['scratch', 'memory', 'memory/facts', 'runbooks', 'blackboard', 'metrics']) {
      assert.ok(fs.statSync(path.join(base, sub)).isDirectory(), `missing directory .foundry/${sub}`);
    }

    const config = readJson(path.join(base, 'config.json'));
    assert.equal(config.enforcement, 'gate');
    assert.equal(typeof config.indexTokenBudget, 'number');
    assert.ok(Array.isArray(config.protectedPaths) && config.protectedPaths.length > 0);

    const overrides = readJson(path.join(base, 'overrides.json'));
    assert.deepEqual(overrides.overrides, []);

    assert.ok(fs.existsSync(path.join(base, 'memory', 'INDEX.md')), 'init must build the memory index');
  });

  test('adds .foundry/scratch/ and .foundry/metrics/ to .gitignore', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const gitignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.match(gitignore, /\.foundry\/scratch\//);
    assert.match(gitignore, /\.foundry\/metrics\//);
  });

  test('is idempotent: running twice does not duplicate .gitignore entries or break state', () => {
    const dir = makeProject();
    const first = runCli(dir, ['init']);
    const second = runCli(dir, ['init']);
    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /Repaired Foundry state/, 'a second run should recognise the project is already initialised');

    const gitignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.equal((gitignore.match(/\.foundry\/scratch\//g) || []).length, 1, '.gitignore entry must not be duplicated');
    assert.equal((gitignore.match(/\.foundry\/metrics\//g) || []).length, 1, '.gitignore entry must not be duplicated');

    // config.json and overrides.json must survive untouched, not be reset to defaults.
    const cfgFile = path.join(dir, '.foundry', 'config.json');
    const before = readJson(cfgFile);
    fs.writeFileSync(cfgFile, JSON.stringify({ ...before, enforcement: 'warn' }, null, 2));
    runCli(dir, ['init']);
    assert.equal(readJson(cfgFile).enforcement, 'warn', 're-running init must not clobber an existing config.json');
  });
});

/* ------------------------------------------------------------------ doctor */

describe('foundry doctor', () => {
  test('reports every check ok and exits 0 on a freshly initialised project', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const r = runCli(dir, ['doctor']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /All checks passed\./);
    assert.doesNotMatch(r.stdout, /FAIL/);
  });

  test('BUG: on an uninitialised project, doctor reports the missing state but must not create it', () => {
    // doctor is a diagnostic command; it must not have side effects on disk. Today it does,
    // because doctor() calls buildIndex(), and buildIndex() calls ensureDirs() unconditionally
    // — so *running the diagnosis* creates .foundry/{scratch,memory,facts,runbooks,blackboard,
    // metrics} and writes memory/INDEX.md on a project that was never `foundry init`-ed.
    // Reproduce: mkdtemp + `git init -q`, then `foundry doctor` with no prior `foundry init`.
    const dir = makeProject();
    const r = runCli(dir, ['doctor']);
    assert.notEqual(r.status, 0, 'doctor must report the missing state as a failing check');
    assert.match(r.stdout, /FAIL.*\.foundry state directory exists/);

    assert.equal(
      fs.existsSync(path.join(dir, '.foundry')),
      false,
      'a read-only diagnostic must not create .foundry as a side effect of running',
    );
  });

  test('BUG: a malformed config.json must not be reported as a healthy default configuration', () => {
    // config() in lib/foundry.mjs swallows JSON.parse errors in a try/catch and silently
    // falls back to defaults. doctor() then validates the *defaults* it was handed, sees
    // enforcement:"gate" is a legal value, and reports "config.json present" / "enforcement
    // level is valid" as ok — even though the file on disk is not valid JSON at all.
    // Reproduce: `foundry init`, then overwrite .foundry/config.json with "{ not json",
    // then `foundry doctor`.
    const dir = makeProject();
    runCli(dir, ['init']);
    fs.writeFileSync(path.join(dir, '.foundry', 'config.json'), '{ not json');

    const r = runCli(dir, ['doctor']);
    assert.notEqual(r.status, 0, 'a broken config.json must fail doctor, not be silently treated as defaults');
  });
});

/* ----------------------------------------------------------------- profile */

describe('foundry profile', () => {
  test('lists all profiles shipped in profiles/ when called with no argument', () => {
    const dir = makeProject();
    const r = runCli(dir, ['profile']);
    assert.equal(r.status, 0, r.stderr);
    for (const id of PROFILE_IDS) assert.match(r.stdout, new RegExp(id.replace(/[-]/g, '\\-')));
  });

  for (const id of PROFILE_IDS) {
    test(`applies profile "${id}" cleanly when .claude/settings.json is absent`, () => {
      const dir = makeProject();
      const r = runCli(dir, ['profile', id]);
      assert.equal(r.status, 0, r.stdout + r.stderr);

      const settingsPath = path.join(dir, '.claude', 'settings.json');
      const settings = readJson(settingsPath);
      assert.equal(typeof settings.enabledPlugins, 'object');
      assert.ok(!Array.isArray(settings.enabledPlugins), 'enabledPlugins must be written as a record, not an array');

      const profileDef = readJson(path.join(PROFILES_DIR, `${id}.json`));
      for (const plugin of profileDef.plugins) {
        assert.equal(settings.enabledPlugins[`${plugin}@foundry`], true, `profile plugin ${plugin} must be enabled`);
      }
      assert.ok(settings.extraKnownMarketplaces?.foundry, 'the foundry marketplace must be registered');

      const cfg = readJson(path.join(dir, '.foundry', 'config.json'));
      if (profileDef.foundryConfig?.enforcement) assert.equal(cfg.enforcement, profileDef.foundryConfig.enforcement);
    });
  }

  test('accepts enabledPlugins already in record form and preserves other settings keys', () => {
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    const settingsPath = path.join(dir, '.claude', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({
      customMarker: 'keep-me-record-form',
      enabledPlugins: { 'other-plugin@somewhere': true },
    }));

    const r = runCli(dir, ['profile', 'startup-mvp']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const settings = readJson(settingsPath);
    assert.equal(settings.customMarker, 'keep-me-record-form', 'unrelated keys must survive `foundry profile`');
    assert.equal(settings.enabledPlugins['other-plugin@somewhere'], true, 'a pre-existing enabled plugin must not be dropped');
    assert.equal(settings.enabledPlugins['foundry-core@foundry'], true);
    assert.ok(!Array.isArray(settings.enabledPlugins));
  });

  test('accepts enabledPlugins in the legacy array form and rewrites it as a record', () => {
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    const settingsPath = path.join(dir, '.claude', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({
      customMarker: 'keep-me-array-form',
      enabledPlugins: ['other-plugin@somewhere'],
    }));

    const r = runCli(dir, ['profile', 'startup-mvp']);
    assert.equal(r.status, 0, r.stdout + r.stderr, 'a legacy array enabledPlugins must not crash the CLI');

    const settings = readJson(settingsPath);
    assert.equal(settings.customMarker, 'keep-me-array-form', 'unrelated keys must survive `foundry profile`');
    assert.ok(!Array.isArray(settings.enabledPlugins), 'the legacy array must be rewritten as a record');
    assert.equal(settings.enabledPlugins['other-plugin@somewhere'], true, 'a pre-existing enabled plugin must not be dropped');
    assert.equal(settings.enabledPlugins['foundry-core@foundry'], true);
  });

  test('merges permissions without dropping a pre-existing rule', () => {
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    const settingsPath = path.join(dir, '.claude', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({
      permissions: { allow: ['Read(./my-preexisting-rule/**)'] },
    }));

    runCli(dir, ['profile', 'oss-library']);

    const settings = readJson(settingsPath);
    assert.ok(
      settings.permissions.allow.includes('Read(./my-preexisting-rule/**)'),
      'merging a profile must not drop a permission the project already had',
    );
    assert.ok(settings.permissions.allow.length > 1, 'the profile\'s own allow rules must also be present');
  });

  test('rejects an unknown profile name without crashing', () => {
    const dir = makeProject();
    const r = runCli(dir, ['profile', 'does-not-exist']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /No profile "does-not-exist"/);
  });
});

/* ---------------------------------------------------------------- validate */

describe('foundry validate', () => {
  const validFact = {
    schema: 'fact.v1', producedBy: 'test', id: 'fact-0001', type: 'decision', scope: 'project',
    title: 'A decision', body: 'Because reasons.', confidence: 'high', source: 'conversation', created: '2026-01-01',
  };

  test('reports VALID and exits 0 for a well-formed artifact', () => {
    const dir = makeProject();
    const file = path.join(dir, 'good.json');
    fs.writeFileSync(file, JSON.stringify(validFact));
    const r = runCli(dir, ['validate', 'fact.v1', 'good.json']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /VALID against fact\.v1/);
  });

  test('lists every violation and exits non-zero for a malformed artifact', () => {
    const dir = makeProject();
    const { body, ...withoutBody } = validFact; // eslint-disable-line no-unused-vars
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, JSON.stringify(withoutBody));
    const r = runCli(dir, ['validate', 'fact.v1', 'bad.json']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /INVALID against fact\.v1/);
    assert.match(r.stderr, /missing required property "body"/);
  });

  test('an unknown schema id produces a readable error, not a crash', () => {
    const dir = makeProject();
    const file = path.join(dir, 'x.json');
    fs.writeFileSync(file, '{}');
    const r = runCli(dir, ['validate', 'made-up.v1', 'x.json']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Unknown contract "made-up\.v1"/);
    assert.match(r.stderr, /fact\.v1/, 'the error should list the schemas that are actually available');
  });

  test('BUG: a missing file must produce a readable error, not a raw Node stack trace', () => {
    // validateCmd() does `JSON.parse(fs.readFileSync(target, 'utf8'))` with no try/catch
    // around the read, so a missing file raises an uncaught ENOENT and Node prints its
    // default stack trace ("at Object.readFileSync (node:fs:...)") to stderr instead of a
    // one-line, human-readable message.
    // Reproduce: `foundry validate fact.v1 ./does-not-exist.json` in any project.
    const dir = makeProject();
    const r = runCli(dir, ['validate', 'fact.v1', './does-not-exist.json']);
    assert.notEqual(r.status, 0, 'a missing file must still exit non-zero');
    assert.doesNotMatch(r.stderr, /at Object\.readFileSync|node:internal|at ModuleJob\.run/,
      'a missing input file must produce a readable CLI error, not a raw Node stack trace');
  });
});

/* --------------------------------------------------------- tokens / runbooks / memory */

describe('foundry tokens, runbooks and memory on an initialised project', () => {
  test('tokens prints a coherent accounting and exits 0', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const r = runCli(dir, ['tokens']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Foundry token accounting/);
    assert.match(r.stdout, /memory index \(always loaded\)/);
    assert.match(r.stdout, /index-first costs/);
  });

  test('runbooks reports none available on a fresh project, and exits 0', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const r = runCli(dir, ['runbooks']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /No runbooks\./);
  });

  test('runbooks lists a runbook once one is added', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    fs.writeFileSync(path.join(dir, '.foundry', 'runbooks', 'sample.md'), '---\ntitle: Sample runbook\ntrigger: on sample work\n---\n\nDo the thing.\n');
    const r = runCli(dir, ['runbooks']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Sample runbook/);
    assert.match(r.stdout, /on sample work/);
  });

  test('memory index rebuilds INDEX.md and reports a fact count', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const r = runCli(dir, ['memory', 'index']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /facts listed/);
  });

  test('memory search reports no match for a query hitting nothing, and exits 0', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const r = runCli(dir, ['memory', 'search', 'nothing-should-ever-match-this-token']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /No match\./);
  });

  test('memory prune runs without error on a project with no facts', () => {
    const dir = makeProject();
    runCli(dir, ['init']);
    const r = runCli(dir, ['memory', 'prune']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Prune candidates/);
  });
});

/* ---------------------------------------------------------------- fanout.mjs */

/**
 * Stand-ins for the real `claude` CLI: innocuous, deterministic and fast. They are built at
 * module load rather than in a before() hook so that every fan-out describe below shares one
 * set of fixtures with no hook-ordering coupling between suites.
 */
function makeFakeCli(name, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `foundry-fake-${name}-`));
  tempDirs.push(dir);
  const script = path.join(dir, 'claude');
  fs.writeFileSync(script, body);
  fs.chmodSync(script, 0o755);
  return dir;
}

/** Ignores its arguments and prints the minimal JSON shape fanout.mjs expects. */
const fakeClaudeDir = makeFakeCli('claude', '#!/usr/bin/env bash\necho \'{"result":"ok"}\'\n');
/** Writes a diagnostic to stderr and exits non-zero, like an overloaded or unauthenticated CLI. */
const failingClaudeDir = makeFakeCli('failing', '#!/usr/bin/env bash\necho "claude: model overloaded" >&2\nexit 3\n');
/** Exits non-zero saying nothing at all — the case where only the exit code is left to report. */
const silentFailingClaudeDir = makeFakeCli('silent', '#!/usr/bin/env bash\nexit 7\n');
/** Succeeds but prints prose rather than JSON, as the real CLI does on some error surfaces. */
const proseClaudeDir = makeFakeCli('prose', '#!/usr/bin/env bash\necho "not json at all"\n');
/** Echoes its own argv back as the result, so a test can see exactly what was forwarded to it. */
const argvClaudeDir = makeFakeCli('argv', '#!/usr/bin/env node\nconsole.log(JSON.stringify({ result: process.argv.slice(2).join(" ") }));\n');

/** An empty directory holding no `claude` at all — a PATH on which the CLI cannot be found. */
const noClaudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-no-claude-'));
tempDirs.push(noClaudeDir);

const PATH_WITH_FAKE_CLAUDE = `${fakeClaudeDir}${path.delimiter}${process.env.PATH}`;

/**
 * Run fanout.mjs in `dir` with a chosen PATH. node is invoked through process.execPath, not
 * through the name "node", so that a test may hand this a PATH with no node on it (which is
 * how the missing-`claude` case is forced without deleting PATH — deleting it changes spawn
 * behaviour across platforms).
 *
 * spawnSync rather than execFileSync: fanout.mjs reports all of its progress on stderr, and
 * execFileSync only hands stderr back on the failure path — a successful run's diagnostics
 * would be invisible to the assertions.
 */
function runFanout(dir, args, pathValue = PATH_WITH_FAKE_CLAUDE, input) {
  const env = { ...process.env, PATH: pathValue };
  const opts = { cwd: dir, encoding: 'utf8', env };
  if (input === undefined) opts.stdio = ['ignore', 'pipe', 'pipe'];
  else opts.input = input;
  const r = spawnSync(process.execPath, [FANOUT, ...args], opts);
  return { status: typeof r.status === 'number' ? r.status : 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function itemsFile(dir, items) {
  const file = path.join(dir, 'items.json');
  fs.writeFileSync(file, typeof items === 'string' ? items : JSON.stringify(items));
  return file;
}

describe('fanout.mjs --concurrency', () => {
  test('--concurrency 4 processes every item and exits 0', () => {
    const dir = makeProject();
    itemsFile(dir, ['a', 'b', 'c', 'd', 'e']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--concurrency', '4', '--out', out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const results = readJson(out);
    assert.equal(results.items, 5);
    assert.equal(results.failures, 0);
    assert.equal(results.results.length, 5);
    assert.ok(results.results.every((x) => x.ok === true), 'every item must have actually run through the fake claude');
  });

  for (const bad of ['0', '-2', 'abc']) {
    test(`--concurrency ${bad} does not exit 0 declaring success without doing any work`, () => {
      const dir = makeProject();
      itemsFile(dir, ['a', 'b', 'c']);
      const out = path.join(dir, 'out.json');
      const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--concurrency', bad, '--out', out]);

      const wroteResults = fs.existsSync(out) ? readJson(out) : null;
      const allItemsProcessed = wroteResults && wroteResults.results.length === 3 && wroteResults.results.every((x) => x.ok === true);

      assert.ok(
        allItemsProcessed || r.status !== 0,
        `--concurrency ${bad} must either process every item or exit non-zero — it must never exit 0 having done no work`,
      );
    });
  }
});

describe('fanout.mjs argument handling', () => {
  test('--help prints the usage block and exits 0', () => {
    const dir = makeProject();
    const r = runFanout(dir, ['--help']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Usage: node scripts\/fanout\.mjs/);
    assert.match(r.stdout, /--concurrency/, 'the usage text must document every option the runner accepts');
  });

  test('a missing --prompt exits 1 and still shows what was expected', () => {
    const dir = makeProject();
    itemsFile(dir, ['a']);
    const r = runFanout(dir, ['--items', 'items.json']);
    assert.equal(r.status, 1, 'a run with no prompt template must not be treated as a successful no-op');
    assert.match(r.stdout, /--prompt\s+Prompt template/);
  });

  test('a missing --items exits 1 and still shows what was expected', () => {
    const dir = makeProject();
    const r = runFanout(dir, ['--prompt', 'do {{item}}']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /--items\s+JSON file/);
  });

  test('an items file containing an empty array exits 1', () => {
    const dir = makeProject();
    itemsFile(dir, '[]');
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out]);
    assert.equal(r.status, 1, 'an empty work list must not exit 0 reporting "0 succeeded"');
    assert.match(r.stderr, /--items must contain a non-empty JSON array/);
    assert.equal(fs.existsSync(out), false, 'a rejected work list must not leave a results file behind');
  });

  test('an items file containing an object rather than an array exits 1', () => {
    const dir = makeProject();
    itemsFile(dir, '{"a":1}');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--items must contain a non-empty JSON array/);
  });
});

describe('fanout.mjs --dry-run', () => {
  test('prints the command it would run for each item and spawns nothing', () => {
    const dir = makeProject();
    itemsFile(dir, ['a b', 'c']);
    const out = path.join(dir, 'out.json');

    // PATH deliberately holds no `claude`: if the runner spawned anything, every item would
    // fail with ENOENT and the process would exit 1. Exiting 0 is the proof it spawned nothing.
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', '{{item}}', '--out', out, '--dry-run'], noClaudeDir);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const dryLines = r.stderr.split('\n').filter((l) => l.includes('[dry-run] claude'));
    assert.equal(dryLines.length, 2, 'one line per item, no more and no less');

    // quote() only quotes what a shell would need quoting: the item with a space, not the one without.
    assert.ok(dryLines.some((l) => l.includes('-p "a b"')), `an argument containing a space must be quoted: ${r.stderr}`);
    assert.ok(dryLines.some((l) => /-p c(\s|$)/.test(l)), `an argument needing no quoting must be left bare: ${r.stderr}`);

    const results = readJson(out);
    assert.equal(results.failures, 0);
    assert.deepEqual(results.results, [{ item: 'a b', dryRun: true }, { item: 'c', dryRun: true }]);
  });
});

describe('fanout.mjs failure reporting', () => {
  test('a non-zero exit from claude is recorded per item, with its stderr, and exits 1', () => {
    const dir = makeProject();
    itemsFile(dir, ['a', 'b']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out],
      `${failingClaudeDir}${path.delimiter}${process.env.PATH}`);

    assert.equal(r.status, 1, 'a run in which every item failed must not exit 0');
    const results = readJson(out);
    assert.equal(results.failures, 2);
    assert.equal(results.results.length, 2);
    for (const entry of results.results) {
      assert.equal(entry.ok, false);
      assert.match(entry.error, /model overloaded/, 'the child\'s own diagnostic is what the operator needs, not just the exit code');
    }
    assert.match(r.stderr, /✗ a \(exit 3\)/);
  });

  test('a silent non-zero exit still reports the exit code rather than an empty error', () => {
    const dir = makeProject();
    itemsFile(dir, ['a']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out],
      `${silentFailingClaudeDir}${path.delimiter}${process.env.PATH}`);

    assert.equal(r.status, 1);
    const entry = readJson(out).results[0];
    assert.equal(entry.ok, false);
    assert.equal(entry.error, 'exit 7', 'with no stderr to quote, the exit code is the whole diagnosis');
  });

  test('stdout that is not JSON is preserved raw instead of being discarded', () => {
    const dir = makeProject();
    itemsFile(dir, ['a']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out],
      `${proseClaudeDir}${path.delimiter}${process.env.PATH}`);

    assert.equal(r.status, 0, r.stdout + r.stderr);
    const entry = readJson(out).results[0];
    assert.equal(entry.ok, true);
    assert.match(entry.result.raw, /not json at all/, 'unparseable output must be kept for the operator, not swallowed');
  });

  test('a missing claude CLI is reported as a PATH problem, not as a crash', () => {
    const dir = makeProject();
    itemsFile(dir, ['a', 'b']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out], noClaudeDir);

    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stderr, /node:internal|at ChildProcess/, 'an unusable environment must not surface as a Node stack trace');
    const results = readJson(out);
    assert.equal(results.failures, 2);
    for (const entry of results.results) {
      assert.equal(entry.ok, false);
      assert.match(entry.error, /the `claude` CLI was not found on PATH/);
    }
  });
});

describe('fanout.mjs work-list shapes', () => {
  test('an object item is labelled by its id and JSON-encoded into the prompt', () => {
    const dir = makeProject();
    itemsFile(dir, [{ id: 'svc-a', path: 'src/a' }, { name: 'svc-b' }, { path: 'src/c' }]);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'audit {{item}} as #{{index}}', '--out', out],
      `${argvClaudeDir}${path.delimiter}${process.env.PATH}`);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const results = readJson(out).results;
    assert.deepEqual(results.map((x) => x.item), ['svc-a', 'svc-b', 'item-2'],
      'labels fall back id -> name -> positional, so no item is ever reported anonymously');
    assert.match(results[0].result, /audit \{"id":"svc-a","path":"src\/a"\} as #0/,
      'an object item must reach the child as JSON, with its index substituted');
  });

  test('--items - reads the work list from stdin', () => {
    const dir = makeProject();
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', '-', '--prompt', 'do {{item}}', '--out', out],
      PATH_WITH_FAKE_CLAUDE, JSON.stringify(['piped-a', 'piped-b']));
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const results = readJson(out);
    assert.equal(results.items, 2);
    assert.deepEqual(results.results.map((x) => x.item), ['piped-a', 'piped-b']);
  });

  test('--allowed-tools overrides the default allowlist handed to each child', () => {
    const dir = makeProject();
    itemsFile(dir, ['a']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out, '--allowed-tools', 'Read'],
      `${argvClaudeDir}${path.delimiter}${process.env.PATH}`);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const argv = readJson(out).results[0].result;
    assert.match(argv, /--allowedTools Read(\s|$)/, 'the allowlist is the only thing constraining a headless agent');
    assert.doesNotMatch(argv, /Grep|Glob/);
    assert.match(r.stderr, /tools "Read"/);
  });
});

describe('fanout.mjs pass-through flags', () => {
  test('--model and --mcp-config reach every child process', () => {
    const dir = makeProject();
    itemsFile(dir, ['a']);
    const out = path.join(dir, 'out.json');
    const mcpConfig = path.join(dir, 'mcp.json');
    fs.writeFileSync(mcpConfig, JSON.stringify({ mcpServers: {} }));

    const r = runFanout(dir, [
      '--items', 'items.json', '--prompt', 'do {{item}}', '--out', out,
      '--model', 'a-specific-model', '--mcp-config', mcpConfig,
    ], `${argvClaudeDir}${path.delimiter}${process.env.PATH}`);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    // The fake CLI echoes its own argv back as the result, so this is the child's real argv.
    const argv = readJson(out).results[0].result;
    assert.match(argv, /--model a-specific-model/, 'the child must run on the model the operator asked for');
    assert.match(argv, new RegExp(`--mcp-config ${mcpConfig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(argv, /--allowedTools Read,Grep,Glob/, 'the default tool allowlist must still be applied');
  });

  test('neither flag is invented when the operator did not pass it', () => {
    const dir = makeProject();
    itemsFile(dir, ['a']);
    const out = path.join(dir, 'out.json');
    const r = runFanout(dir, ['--items', 'items.json', '--prompt', 'do {{item}}', '--out', out],
      `${argvClaudeDir}${path.delimiter}${process.env.PATH}`);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const argv = readJson(out).results[0].result;
    assert.doesNotMatch(argv, /--model/);
    assert.doesNotMatch(argv, /--mcp-config/);
  });
});

/* -------------------------------------------------------------- install.mjs */

describe('scripts/install.mjs', () => {
  function runInstall(args) {
    try {
      const stdout = execFileSync('node', [INSTALL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, stdout, stderr: '' };
    } catch (err) {
      return { status: typeof err.status === 'number' ? err.status : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
  }

  test('applies a profile to a fresh target: settings, foundry state and CLAUDE.md are all written', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--profile', 'startup-mvp']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const settings = readJson(path.join(dir, '.claude', 'settings.json'));
    assert.equal(settings.enabledPlugins['foundry-core@foundry'], true);
    assert.equal(settings.enabledPlugins['foundry-dev@foundry'], true);

    assert.ok(fs.existsSync(path.join(dir, '.foundry', 'config.json')), 'install must run `foundry init` on the target');
    const cfg = readJson(path.join(dir, '.foundry', 'config.json'));
    assert.equal(cfg.enforcement, 'warn', 'the profile\'s foundryConfig must be applied on top of the defaults');

    const claudeMd = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /## Foundry/);
  });

  test('merges permissions into an existing settings.json without losing pre-existing rules', () => {
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
      enabledPlugins: { 'already-enabled@marketplace': true },
      permissions: { allow: ['Read(./pre-existing/**)'] },
    }));

    const r = runInstall(['--target', dir, '--profile', 'oss-library']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const settings = readJson(path.join(dir, '.claude', 'settings.json'));
    assert.equal(settings.enabledPlugins['already-enabled@marketplace'], true, 'a pre-existing enabled plugin must survive install');
    assert.equal(settings.enabledPlugins['foundry-core@foundry'], true);
    assert.ok(settings.permissions.allow.includes('Read(./pre-existing/**)'), 'a pre-existing permission rule must survive install');
  });

  test('BUG: does not report success when the `foundry init` step it runs actually fails', () => {
    // runFoundry() in scripts/install.mjs wraps its execFileSync call in try/catch, logs
    // "foundry init failed: ..." on error, and then simply returns — nothing downstream
    // checks that return, sets process.exitCode, or aborts. Execution falls through to
    // wireClaudeMd() and finally `console.log('\nDone.')` with an implicit exit code of 0.
    // Reproduce: pre-create a *file* (not directory) named ".foundry" at the install
    // target, then `node scripts/install.mjs --target <dir>` with no --profile (so the
    // only failing step is the init call; a profile's own foundryConfig write would
    // otherwise crash the whole process with a second, uncaught mkdir error and mask
    // this bug behind a different, accidental non-zero exit).
    const dir = makeProject();
    fs.writeFileSync(path.join(dir, '.foundry'), 'not a directory — sabotages `foundry init`');

    const r = runInstall(['--target', dir]);

    assert.notEqual(r.status, 0, 'the installer must not exit 0 when a step it depends on failed');
    assert.doesNotMatch(r.stdout, /\nDone\.\n/, 'the installer must not claim "Done." after a step failed');
  });
});
