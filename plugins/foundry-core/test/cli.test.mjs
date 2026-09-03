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

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

describe('fanout.mjs --concurrency', () => {
  let fakeClaudeDir;

  before(() => {
    // A stand-in for the real `claude` CLI: innocuous, deterministic, and fast. It ignores
    // its arguments and prints the minimal JSON shape fanout.mjs expects on stdout.
    fakeClaudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-fake-claude-'));
    tempDirs.push(fakeClaudeDir);
    const script = path.join(fakeClaudeDir, 'claude');
    fs.writeFileSync(script, '#!/usr/bin/env bash\necho \'{"result":"ok"}\'\n');
    fs.chmodSync(script, 0o755);
  });

  function runFanout(dir, args) {
    const env = { ...process.env, PATH: `${fakeClaudeDir}:${process.env.PATH}` };
    try {
      const stdout = execFileSync('node', [FANOUT, ...args], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, stdout, stderr: '' };
    } catch (err) {
      return { status: typeof err.status === 'number' ? err.status : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
  }

  function itemsFile(dir, items) {
    const file = path.join(dir, 'items.json');
    fs.writeFileSync(file, JSON.stringify(items));
    return file;
  }

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
