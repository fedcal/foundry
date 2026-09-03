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

/**
 * Run the installer. spawnSync, not execFileSync, so that stderr is captured on the exit-0
 * paths too: usage() puts its error line on stderr and its help text on stdout, and several
 * of the arms below need to read both.
 */
function runInstall(args) {
  const r = spawnSync(process.execPath, [INSTALL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: typeof r.status === 'number' ? r.status : 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('scripts/install.mjs', () => {
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

describe('scripts/install.mjs argument validation', () => {
  test('--help lists every profile that actually ships, and exits 0', () => {
    const r = runInstall(['--help']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /--target <dir>/);
    // The help text builds this list by reading profiles/ at runtime, so a profile added
    // without a matching help entry cannot silently go unadvertised — but a profile whose
    // file is unreadable would vanish from it, which is what this pins.
    for (const id of PROFILE_IDS) {
      assert.ok(r.stdout.includes(id), `--help must advertise the shipped profile "${id}"`);
    }
  });

  test('an unknown profile names the ones that exist and exits 1', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--profile', 'nope']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /error: unknown profile "nope"/);
    assert.match(r.stderr, /Available: /);
    for (const id of PROFILE_IDS) {
      assert.ok(r.stderr.includes(id), `the error must name the real profile "${id}"`);
    }
    assert.equal(fs.existsSync(path.join(dir, '.claude')), false, 'a rejected profile must not half-install');
  });

  test('an unknown mode exits 1 without touching the target', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--mode', 'sideways']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /error: unknown mode "sideways"/);
    assert.equal(fs.existsSync(path.join(dir, '.claude')), false, 'a validation failure must not half-install');
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);
    assert.equal(fs.existsSync(path.join(dir, '.foundry')), false);
  });

  test('an unknown plugin exits 1 and names it', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--plugins', 'foundry-core,foundry-nonexistent']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /error: unknown plugin "foundry-nonexistent"/);
    assert.equal(fs.existsSync(path.join(dir, '.claude')), false);
  });

  test('a target directory that does not exist exits 1 rather than creating it', () => {
    const dir = makeProject();
    const missing = path.join(dir, 'no-such-project');
    const r = runInstall(['--target', missing]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /error: target directory does not exist/);
    assert.equal(fs.existsSync(missing), false, 'the installer must not conjure the target it was told to install into');
  });

  test('refuses to install Foundry into the Foundry repository itself', () => {
    const r = runInstall(['--target', REPO]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refusing to install Foundry into the Foundry repository itself/);
  });

  test('--dry-run writes nothing at all', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--profile', 'startup-mvp', '--dry-run']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Dry run: nothing was written\./);
    // It still has to say what it would have done, or the flag is useless.
    assert.match(r.stdout, /profile: startup-mvp/);
    assert.match(r.stdout, /plugins: foundry-core, foundry-dev/);

    assert.equal(fs.existsSync(path.join(dir, '.claude')), false, '--dry-run must not create .claude/');
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false, '--dry-run must not create CLAUDE.md');
    assert.equal(fs.existsSync(path.join(dir, '.foundry')), false, '--dry-run must not run `foundry init`');
  });
});

describe('scripts/install.mjs re-running over an existing install', () => {
  test('leaves a CLAUDE.md that already references Foundry untouched', () => {
    const dir = makeProject();
    const first = runInstall(['--target', dir]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /created CLAUDE\.md/);

    const afterFirst = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');

    const second = runInstall(['--target', dir]);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /CLAUDE\.md already references Foundry, left unchanged/);

    const afterSecond = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.equal(afterSecond, afterFirst, 'a second install must not rewrite a file the user may have edited');
    assert.equal((afterSecond.match(/## Foundry/g) || []).length, 1, 'the Foundry block must never be appended twice');
  });

  test('appends its block to a CLAUDE.md the project already had, keeping the original text', () => {
    const dir = makeProject();
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# My project\n\nBuild with `make`.\n');

    const r = runInstall(['--target', dir]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /updated CLAUDE\.md/);

    const claudeMd = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /Build with `make`\./, 'the project\'s own instructions must survive install');
    assert.match(claudeMd, /## Foundry/);
    assert.ok(claudeMd.indexOf('Build with') < claudeMd.indexOf('## Foundry'), 'Foundry\'s block is appended, not prepended');
  });
});

/**
 * Local mode copies the plugins' assets into the project instead of enabling them from the
 * marketplace, so every one of these expectations is derived from what the repository actually
 * ships rather than from a hard-coded list that would rot the next time an agent is added.
 */
function pluginAgentNames(...pluginNames) {
  const names = new Set();
  for (const p of pluginNames) {
    const dir = path.join(REPO, 'plugins', p, 'agents');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.md')) names.add(f);
  }
  return [...names].sort();
}

function pluginSkillNames(...pluginNames) {
  const names = new Set();
  for (const p of pluginNames) {
    const dir = path.join(REPO, 'plugins', p, 'skills');
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) names.add(e.name);
  }
  return [...names].sort();
}

/** Every hook (type, command, args) triple in a settings.json, keyed the way mergeHooks keys them. */
function hookKeysByEvent(settings) {
  const out = {};
  for (const [event, entries] of Object.entries(settings.hooks || {})) {
    out[event] = entries.flatMap((e) => (e.hooks || []).map((h) => JSON.stringify([h.type, h.command, h.args || []])));
  }
  return out;
}

describe('scripts/install.mjs --mode local', () => {
  test('copies every agent and skill of the selected plugins into .claude/', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core,foundry-dev']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const expectedAgents = pluginAgentNames('foundry-core', 'foundry-dev');
    const copiedAgents = fs.readdirSync(path.join(dir, '.claude', 'agents')).sort();
    assert.deepEqual(copiedAgents, expectedAgents, 'local mode must copy every agent of every selected plugin');

    const expectedSkills = pluginSkillNames('foundry-core', 'foundry-dev');
    const copiedSkills = fs.readdirSync(path.join(dir, '.claude', 'skills')).sort();
    assert.deepEqual(copiedSkills, expectedSkills);

    // copyTree is recursive: a skill is useless without its SKILL.md, and several ship
    // reference material in subdirectories that must come across too.
    for (const skill of copiedSkills) {
      const skillDir = path.join(dir, '.claude', 'skills', skill);
      assert.ok(fs.existsSync(path.join(skillDir, 'SKILL.md')), `skill ${skill} was copied without its SKILL.md`);
      const sourceFiles = listAllFiles(path.join(REPO, 'plugins', fs.existsSync(path.join(REPO, 'plugins', 'foundry-core', 'skills', skill)) ? 'foundry-core' : 'foundry-dev', 'skills', skill));
      assert.equal(listAllFiles(skillDir).length, sourceFiles.length, `skill ${skill} lost files in the copy`);
    }

    assert.match(r.stdout, new RegExp(`copied ${expectedAgents.length} agents and ${expectedSkills.length} skills`));
  });

  test('tells the operator to restart rather than to install from the marketplace', () => {
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    assert.match(r.stdout, /Restart Claude Code \(or run \/reload-plugins\)/);
    assert.match(r.stdout, /local mode pins this copy/);
    assert.doesNotMatch(r.stdout, /plugin marketplace add/, 'local mode must not tell the user to add a marketplace it does not use');

    const settings = readJson(path.join(dir, '.claude', 'settings.json'));
    assert.equal(settings.extraKnownMarketplaces, undefined, 'local mode must not register the marketplace');
    assert.equal(settings.enabledPlugins, undefined, 'local mode must not enable plugins it just copied by hand');
  });

  test('resolves every ${CLAUDE_PLUGIN_*} macro to a real absolute path', () => {
    // ${CLAUDE_PLUGIN_ROOT} is only expanded for plugins installed through the marketplace.
    // Left unresolved here, the project would get an installation whose hooks silently never
    // fire and whose MCP server never starts — a failure with no error message anywhere.
    const dir = makeProject();
    const r = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const settingsRaw = fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8');
    const mcpRaw = fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8');
    assert.doesNotMatch(settingsRaw, /\$\{CLAUDE_PLUGIN_/, 'an unresolved macro in settings.json means the hooks never run');
    assert.doesNotMatch(mcpRaw, /\$\{CLAUDE_PLUGIN_/, 'an unresolved macro in .mcp.json means the MCP server never starts');

    const settings = JSON.parse(settingsRaw);
    const hookScripts = Object.values(settings.hooks).flatMap((entries) => entries.flatMap((e) => (e.hooks || []).flatMap((h) => h.args || [])));
    assert.ok(hookScripts.length > 0, 'foundry-core ships hooks; if none were merged this test proves nothing');
    for (const script of hookScripts) {
      assert.ok(path.isAbsolute(script), `hook script path must be absolute in local mode: ${script}`);
      assert.ok(fs.existsSync(script), `hook script does not exist on disk: ${script}`);
    }

    const server = JSON.parse(mcpRaw).mcpServers.foundry;
    assert.ok(server, '.mcp.json must declare the foundry server');
    const serverEntry = server.args.find((a) => a.endsWith('server.mjs'));
    assert.ok(path.isAbsolute(serverEntry), `MCP server path must be absolute: ${serverEntry}`);
    assert.ok(fs.existsSync(serverEntry), `MCP server does not exist on disk: ${serverEntry}`);
  });

  test('merges into an existing .mcp.json instead of replacing it', () => {
    const dir = makeProject();
    fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({
      mcpServers: { 'my-own-server': { command: 'node', args: ['./mine.mjs'] } },
    }));

    const r = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core']);
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const mcp = readJson(path.join(dir, '.mcp.json'));
    assert.ok(mcp.mcpServers['my-own-server'], 'a project\'s own MCP server must survive install');
    assert.ok(mcp.mcpServers.foundry);
  });

  test('preserves a project\'s own hook on an event Foundry also uses', () => {
    // A shallow spread merges only at the top level, so it replaced the project's whole
    // PreToolUse array with Foundry's — a project with its own audit or secret-scanning
    // hook lost it silently. mergeHooks exists to stop exactly that.
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './my-audit.sh' }] }] },
    }));

    const r = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /hooks merged into events that already had entries/);
    assert.match(r.stdout, /PreToolUse: kept 1 existing, added \d+/);

    const settings = readJson(path.join(dir, '.claude', 'settings.json'));
    const pre = settings.hooks.PreToolUse;
    assert.equal(pre[0].hooks[0].command, './my-audit.sh', 'the project\'s own hook must stay, and stay first');
    assert.ok(pre.length > 1, 'Foundry\'s own PreToolUse entries must be appended after it');
    assert.ok(
      pre.slice(1).every((e) => (e.hooks || []).every((h) => (h.args || []).some((a) => a.includes('foundry-core')))),
      'everything appended after the project\'s hook should be Foundry\'s',
    );
    // The events Foundry alone uses must still arrive in full.
    assert.ok(Array.isArray(settings.hooks.SessionStart) && settings.hooks.SessionStart.length > 0);
  });

  test('is idempotent: a second local install adds no duplicate hook entries', () => {
    // Without the dedupe in mergeHooks, every re-run doubles the hook chain, and the project
    // pays for each Foundry hook twice on every single tool call.
    const dir = makeProject();
    const first = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core']);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const afterFirst = hookKeysByEvent(readJson(path.join(dir, '.claude', 'settings.json')));
    assert.ok(Object.keys(afterFirst).length > 0, 'the first install must have merged some hooks');

    const second = runInstall(['--target', dir, '--mode', 'local', '--plugins', 'foundry-core']);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    const afterSecond = hookKeysByEvent(readJson(path.join(dir, '.claude', 'settings.json')));

    assert.deepEqual(afterSecond, afterFirst, 're-running the installer must not change the hook chain');
    for (const [event, keys] of Object.entries(afterSecond)) {
      assert.equal(new Set(keys).size, keys.length, `duplicate hook entries on ${event}: ${keys.join(', ')}`);
    }
    assert.match(second.stdout, /kept \d+ existing, added 0/, 'the second run must report that it added nothing');
  });
});

describe('scripts/install.mjs permission merging', () => {
  test('never loosens a defaultMode the project already chose', () => {
    // startup-mvp asks for "acceptEdits"; the project here has already settled on "default",
    // which is stricter. Relaxing that silently is exactly the class of change a user must
    // opt into, so the installer keeps what it found and says so.
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
      permissions: { defaultMode: 'default', allow: ['Read(./pre-existing/**)'] },
    }));

    const r = runInstall(['--target', dir, '--profile', 'startup-mvp']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /keeping defaultMode "default"/);
    assert.match(r.stdout, /which is more permissive/);

    const settings = readJson(path.join(dir, '.claude', 'settings.json'));
    assert.equal(settings.permissions.defaultMode, 'default', 'the installer must not widen a mode the user chose');
    // Refusing the mode must not abort the rest of the merge.
    assert.ok(settings.permissions.allow.includes('Read(./pre-existing/**)'));
    assert.ok(settings.permissions.allow.includes('Bash(npm:*)'), 'the profile\'s own allow rules still apply');
    assert.deepEqual(settings.permissions.deny, ['Read(./.env)', 'Read(./.env.*)']);
  });

  test('applies a stricter defaultMode, and reports the change', () => {
    // The mirror image: the project is on "acceptEdits" and oss-library asks for "default",
    // which is tighter. Tightening is safe, so it is applied without asking.
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
      permissions: { defaultMode: 'acceptEdits' },
    }));

    const r = runInstall(['--target', dir, '--profile', 'oss-library']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\+ defaultMode: acceptEdits -> default/);

    const settings = readJson(path.join(dir, '.claude', 'settings.json'));
    assert.equal(settings.permissions.defaultMode, 'default');
  });
});
