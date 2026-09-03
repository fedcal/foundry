/**
 * Contract tests for foundry-growth's PreToolUse(Write|Edit) substantiation gate.
 *
 * `plugins/foundry-growth/hooks/guard-claims.mjs` ships to users, runs on every Write and
 * Edit in a project that has opted in, and until this file existed it had no test at all —
 * and sat outside the `plugins/foundry-core/test/*.test.mjs` glob CI runs, so no regression
 * in it could ever be caught. A gate nobody exercises degrades in exactly two directions,
 * both invisible from the outside: it goes silent (and stops catching the fabricated
 * endorsement it exists for), or it starts firing on source, tests and README (and gets
 * switched off, which is the same outcome by a slower route).
 *
 * The hook's own header states a numbered VERIFIABLE BEHAVIOUR CONTRACT of nine items, each
 * one described as checkable by piping a payload into the file. Every test below names the
 * item it pins. Nothing here imports the hook: it is spawned as a real process and every
 * assertion is made against the raw bytes on stdout, stderr and the exit status — the same
 * three channels Claude Code reads. Reaching into the module for `inScope` or `scan` would
 * test Foundry's implementation of the contract instead of the contract.
 *
 * Node standard library only, matching the hook itself: foundry-growth may be installed
 * without foundry-core, so neither the hook nor its tests may import from a sibling plugin.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'guard-claims.mjs');

/** The enum verified against the Claude Code 2.1.250 binary. Anything else fails open. */
const PRETOOL_DECISIONS = new Set(['allow', 'deny', 'ask', 'defer']);

/** The hook's own constants, restated rather than imported, so a change to one is a failure here. */
const MAX_FINDINGS = 5;
const FRAGMENT_CHARS = 96;
const MAX_SCAN = 200_000;
const GATE = 'growth-claim-substantiation';

const tmpRoots = [];

/**
 * A fresh project root anchored with an empty `.git`. The anchor is load-bearing: the hook's
 * `projectRoot()` walks up until it finds `.git` or `.foundry`, so an un-anchored tmpdir would
 * let it climb past the fixture and settle on whatever ancestor happens to have one — including
 * a stray `.foundry` another process left under the OS tmpdir. The opt-in tests for item 9
 * would then be asserting against the wrong project and would pass for the wrong reason.
 */
function freshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-growth-claims-'));
  fs.mkdirSync(path.join(root, '.git'));
  tmpRoots.push(root);
  return root;
}

/** A root where `foundry init` has already run: `.foundry/` exists, so the gate is armed. */
function initRoot() {
  const root = freshRoot();
  fs.mkdirSync(path.join(root, '.foundry'));
  return root;
}

after(() => {
  for (const root of tmpRoots) fs.rmSync(root, { recursive: true, force: true });
});

/**
 * Raw spawn: arbitrary bytes on stdin, nothing interpreted, nothing asserted. stdin is coerced
 * to a Buffer here rather than handed to spawnSync as a string, because `encoding: 'buffer'` —
 * which is what makes stdout and stderr comparable byte-for-byte — is also applied to `input`.
 */
function spawnHook(stdin, cwd) {
  const input = Buffer.isBuffer(stdin) ? stdin : Buffer.from(stdin, 'utf8');
  return spawnSync('node', [HOOK], { input, encoding: 'buffer', cwd, maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Run the hook the way Claude Code does and return the raw wire bytes alongside the parsed
 * object. Items 1 and 2 are enforced on every single call rather than in one dedicated test:
 * a non-zero exit or a byte on stderr anywhere in this suite is a contract breach wherever it
 * happens, and the repository's house rule is that a hook never writes to stderr at all.
 */
function runHook(input, root) {
  const r = spawnHook(JSON.stringify({ cwd: root, ...input }), root);
  const stderr = r.stderr.toString('utf8');
  const stdout = r.stdout.toString('utf8');
  assert.equal(r.error, undefined, `guard-claims failed to spawn: ${r.error}`);
  assert.equal(stderr, '', `guard-claims wrote to stderr: ${stderr}`);
  assert.equal(r.status, 0, `guard-claims exited with status ${r.status}`);
  return { stdout, out: stdout.trim() ? JSON.parse(stdout) : null };
}

/** Write payload for a path relative to the project root, as the tool always delivers it: absolute. */
const write = (root, rel, content) => ({ tool_name: 'Write', tool_input: { file_path: path.join(root, rel), content } });

/** The reason string, asserting first that a decision was actually emitted. */
function reasonOf({ out }) {
  assert.ok(out, 'expected the gate to emit a decision for this fixture, but it stayed silent');
  return out.hookSpecificOutput.permissionDecisionReason;
}

/**
 * Split the reason into the findings it reports. The rendered shape is
 * `N. [rule-id] label\n   Found: "fragment"\n   Publishable when: remedy`, blocks separated by a
 * blank line; `excerpt()` collapses whitespace, so a fragment can never contain a newline and
 * this parse cannot silently merge two findings into one.
 */
function findingsOf(reason) {
  return reason
    .split('\n\n')
    .filter((block) => /^\d+\. \[/.test(block))
    .map((block) => {
      const [head, found, remedy] = block.split('\n');
      return {
        rule: head.match(/^\d+\. \[([a-z-]+)\]/)[1],
        label: head.replace(/^\d+\. \[[a-z-]+\] /, ''),
        fragment: found.match(/^ {3}Found: "(.*)"$/)[1],
        remedy: String(remedy ?? '').replace(/^ {3}Publishable when: /, ''),
      };
    });
}

/**
 * One line per rule in the hook, so an out-of-scope fixture is refused despite carrying
 * everything the gate looks for. Deliberately free of any token the suppressors recognise —
 * no `https://`, no "benchmark", no "projection", no "best practice" — because a fixture that
 * the detectors would have skipped anyway proves nothing about scoping.
 */
const EVERY_TRIGGER = [
  'Adoption grew 40% and revenue reached $2.5M with 10,000 users behind a 3x speedup.',
  'The best, fastest, cheapest and only #1 world-class, guaranteed, risk-free tool that never fails.',
  'Trusted by Acme, used by thousands, as seen in the trade weekly, backed by angels, customer logos below.',
  '"It changed everything for our whole engineering organisation, end to end." — Jane Doe',
  'Limited spots, only 3 left, offer ends today, act now, hurry, countdown running.',
  'This will save you money, it is going to replace everything, you will earn more.',
].join('\n');

/** Prose with nothing for any of the five rules to find: no digit, no superlative, no promise. */
const NO_RISK = 'This page explains what the tool does and how to install it from the repository.';

/* ------------------------------------------------------------------ item 1 */

describe('item 1 — the decision is `ask` or silence, never `deny`, never outside allow|deny|ask|defer', () => {
  test('a firing payload emits permissionDecision "ask" on the raw wire', () => {
    const root = initRoot();
    const { stdout, out } = runHook(write(root, 'growth/landing.md', EVERY_TRIGGER), root);

    // Asserted against the bytes, not a parsed convenience wrapper: the failure this pins is a
    // decision that reads correctly through a helper while the runtime receives something else.
    assert.match(stdout, /"permissionDecision":"ask"/, `raw stdout did not carry an "ask" decision: ${stdout.slice(0, 200)}`);
    assert.doesNotMatch(stdout, /"permissionDecision":"(?!ask")/, 'the only decision this gate may emit is "ask"');

    const decision = out.hookSpecificOutput.permissionDecision;
    assert.notEqual(decision, 'deny', 'this gate escalates a judgement the author settles in one sentence; a block gets it disabled');
    assert.ok(
      PRETOOL_DECISIONS.has(decision),
      `permissionDecision "${decision}" is outside allow|deny|ask|defer — Claude Code 2.1.250 rejects the payload ` +
        'and the call proceeds ungated, so an invalid value is indistinguishable from having no gate',
    );
    assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse', 'a mismatched event name is discarded by the runtime');
  });

  test('stdout is exactly one JSON object, so no second decision is appended after the first', () => {
    const root = initRoot();
    const { stdout } = runHook(write(root, 'growth/landing.md', EVERY_TRIGGER), root);
    // Two concatenated objects parse from neither JSON.parse nor the runtime: the whole payload
    // becomes unparseable hook output and the gate silently no-ops.
    assert.doesNotThrow(() => JSON.parse(stdout.trim()));
    assert.equal(stdout.trim().indexOf('}{'), -1);
  });

  test('no fixture in this suite can produce a decision other than ask', () => {
    const root = initRoot();
    const corpus = [
      write(root, 'growth/landing.md', EVERY_TRIGGER),
      write(root, 'marketing/press-release.md', 'Trusted by Google'),
      { tool_name: 'Edit', tool_input: { file_path: path.join(root, 'launch/post.md'), old_string: 'x', new_string: 'We are the fastest.' } },
      write(root, 'pitch/deck.md', 'Only 3 seats left, act now.'),
    ];
    for (const input of corpus) {
      const { out } = runHook(input, root);
      assert.equal(out.hookSpecificOutput.permissionDecision, 'ask');
    }
  });
});

/* ------------------------------------------------------------------ item 2 */

describe('item 2 — exit code 0 on every input, and stderr always empty', () => {
  /**
   * The garbage corpus. Every entry is something a real session can deliver: a truncated pipe,
   * a payload from a future schema, a field of the wrong type, bytes that are not UTF-8 at all.
   * A hook that throws on any of them costs the user a tool call and prints a stack trace into
   * their session, which is strictly worse than the hook not being installed.
   */
  const GARBAGE = [
    ['unparseable text', 'this is not { valid json'],
    ['empty stdin', ''],
    ['whitespace only', '   \n\t  '],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a JSON number', '5'],
    ['a JSON string', '"x"'],
    ['a JSON boolean', 'true'],
    ['an empty object', '{}'],
    ['tool_name with no tool_input', '{"tool_name":"Write"}'],
    ['tool_input as an array', '{"tool_name":"Write","tool_input":[]}'],
    ['file_path of the wrong type', '{"tool_name":"Write","tool_input":{"file_path":1}}'],
    ['content of the wrong type', '{"tool_name":"Write","tool_input":{"file_path":"growth/a.md","content":{}}}'],
    ['edits of the wrong type', '{"tool_name":"Edit","tool_input":{"file_path":"growth/a.md","edits":"nope"}}'],
    ['cwd of the wrong type', '{"cwd":42,"tool_name":"Write","tool_input":{"file_path":"growth/a.md","content":"Trusted by Acme"}}'],
    ['a leading NUL byte', '\x00{"tool_name":"Write"}'],
    ['a UTF-8 BOM before the object', '﻿{"tool_name":"Write"}'],
    ['2000 levels of nesting', `${'['.repeat(2000)}${']'.repeat(2000)}`],
    ['bytes that are not valid UTF-8', Buffer.from([0xff, 0xfe, 0x80, 0x81, 0x7b, 0x7d])],
  ];

  for (const [label, stdin] of GARBAGE) {
    test(`${label}: exit 0, stderr empty`, () => {
      const root = initRoot();
      const r = spawnHook(stdin, root);
      assert.equal(r.error, undefined, `failed to spawn: ${r.error}`);
      assert.equal(r.status, 0, `exited ${r.status} on ${label}`);
      assert.equal(
        r.stderr.toString('utf8'),
        '',
        `wrote to stderr on ${label} — Foundry hooks never write to stderr, and on a PreToolUse hook ` +
          'stderr is also the reason channel for an exit-2 block, so a stray warning there is a block the author never wrote',
      );
    });
  }

  test('the deciding path also exits 0 with an empty stderr', () => {
    const root = initRoot();
    const r = spawnHook(JSON.stringify({ cwd: root, ...write(root, 'growth/landing.md', EVERY_TRIGGER) }), root);
    assert.equal(r.status, 0, 'emitting a decision must not change the exit status: exit 2 is the block channel');
    assert.equal(r.stderr.toString('utf8'), '');
    assert.ok(r.stdout.length > 0, 'sanity: this fixture is supposed to decide');
  });

  test('an unreadable .foundry/config.json degrades to silence on stderr, not a warning', () => {
    const root = initRoot();
    // A config directory where a file belongs is the shape a bad merge or a half-finished
    // `foundry init` leaves behind; readConfig must swallow the EISDIR rather than announce it.
    fs.mkdirSync(path.join(root, '.foundry', 'config.json'));
    const r = spawnHook(JSON.stringify({ cwd: root, ...write(root, 'growth/landing.md', 'Trusted by Acme') }), root);
    assert.equal(r.status, 0);
    assert.equal(r.stderr.toString('utf8'), '');
    assert.match(r.stdout.toString('utf8'), /"permissionDecision":"ask"/, 'an unreadable config means default config, not a disarmed gate');
  });
});

/* ---------------------------------------------------------------- item 3 */

describe('item 3 — malformed, empty, non-object or unexpectedly shaped stdin produces zero bytes of stdout', () => {
  const SHAPES = [
    ['unparseable text', 'this is not { valid json'],
    ['empty stdin', ''],
    ['whitespace only', '   \n\t  '],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a JSON number', '5'],
    ['a JSON string', '"x"'],
    ['an empty object', '{}'],
    ['tool_input as an array', '{"tool_name":"Write","tool_input":[]}'],
    ['file_path of the wrong type', '{"tool_name":"Write","tool_input":{"file_path":1}}'],
    ['bytes that are not valid UTF-8', Buffer.from([0xff, 0xfe, 0x80, 0x81, 0x7b, 0x7d])],
  ];

  for (const [label, stdin] of SHAPES) {
    test(`${label}: zero bytes of stdout`, () => {
      const root = initRoot();
      const r = spawnHook(stdin, root);
      assert.equal(r.stdout.length, 0, `emitted ${r.stdout.length} bytes for ${label}: ${r.stdout.toString('utf8').slice(0, 120)}`);
    });
  }

  test('an event other than PreToolUse is not this hook\'s business, even with a firing payload', () => {
    const root = initRoot();
    const input = { hook_event_name: 'PostToolUse', ...write(root, 'growth/landing.md', EVERY_TRIGGER) };
    // permissionDecision exists on PreToolUse alone; emitting it on PostToolUse is output
    // nothing interprets, so answering the wrong event is a no-op that looks like a working gate.
    assert.equal(runHook(input, root).stdout, '');
  });

  test('a tool other than Write or Edit is ignored even when its input is full of claims', () => {
    const root = initRoot();
    for (const tool_name of ['Bash', 'Read', 'NotebookEdit', 'MultiEdit', '']) {
      const input = { tool_name, tool_input: { file_path: path.join(root, 'growth/landing.md'), content: EVERY_TRIGGER, command: EVERY_TRIGGER } };
      assert.equal(runHook(input, root).stdout, '', `${tool_name || '(empty tool_name)'} must not be scanned by a Write|Edit gate`);
    }
  });

  test('an Edit that introduces no new line has nothing to scan', () => {
    const root = initRoot();
    // Re-indenting or re-writing an existing claim is not a new claim. Re-asking every time is
    // how a user learns to click through the prompt without reading it.
    const unchanged = { tool_name: 'Edit', tool_input: { file_path: path.join(root, 'growth/landing.md'), old_string: 'Trusted by Google', new_string: 'Trusted by Google' } };
    assert.equal(runHook(unchanged, root).stdout, '');

    const noNewString = { tool_name: 'Edit', tool_input: { file_path: path.join(root, 'growth/landing.md'), old_string: 'Trusted by Google' } };
    assert.equal(runHook(noNewString, root).stdout, '');
  });

  test('an Edit in the batch `edits` form is scanned, and only its added lines', () => {
    const root = initRoot();
    const batch = {
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(root, 'growth/landing.md'),
        edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'q', new_string: 'Trusted by Acme' }],
      },
    };
    // The batch form is a separate branch of newText(); if it stopped being read the gate would
    // go silent on every multi-edit, which is the shape most Edit calls actually arrive in.
    assert.match(reasonOf(runHook(batch, root)), /borrowed-credibility/);
  });
});

/* ---------------------------------------------------------------- item 4 */

describe('item 4 — an in-scope file with no substantiation risk produces zero bytes of stdout', () => {
  test('plain prose under growth/ is not flagged', () => {
    const root = initRoot();
    assert.equal(runHook(write(root, 'growth/landing.md', NO_RISK), root).stdout, '');
  });

  test('a number with its source beside it is not flagged', () => {
    const root = initRoot();
    assert.equal(runHook(write(root, 'growth/landing.md', 'Throughput improved 40% (https://example.com/bench.json).'), root).stdout, '');
    assert.equal(runHook(write(root, 'growth/landing.md', 'Throughput improved 40%, measured on 2026-08-20.'), root).stdout, '');
  });

  test('the benign superlative collocations, including the negated form, are not flagged', () => {
    const root = initRoot();
    // "we are not the fastest" is a positioning document doing exactly what this vertical asks
    // for; punishing it is how an advisory gate becomes noise the author learns to dismiss.
    assert.equal(runHook(write(root, 'growth/positioning.md', 'We use a best-effort retry and we are not the fastest tool in this space.'), root).stdout, '');
  });

  test('a forward-looking sentence labelled as a projection is not flagged', () => {
    const root = initRoot();
    assert.equal(runHook(write(root, 'growth/landing.md', 'Our projection is that this will save teams a day each month.'), root).stdout, '');
  });

  test('sanity: the same sentence unlabelled IS flagged, so the previous test proves the label and not a dead rule', () => {
    const root = initRoot();
    assert.match(reasonOf(runHook(write(root, 'growth/landing.md', 'This will save teams a day each month.'), root)), /forward-looking-as-fact/);
  });

  test('an empty write has nothing to scan', () => {
    const root = initRoot();
    assert.equal(runHook(write(root, 'growth/landing.md', ''), root).stdout, '');
  });
});

/* ---------------------------------------------------------------- item 5 */

describe('item 5 — an out-of-scope path is silent even carrying every trigger phrase in the file', () => {
  /** Paths that must never be scanned, one per reason the exclusion exists. */
  const OUT_OF_SCOPE = [
    ['growth/pipeline.ts', 'PROSE_EXT: a .ts file under growth/ is code about growth, not copy'],
    ['growth/report.py', 'PROSE_EXT: same for Python'],
    ['growth/data.json', 'PROSE_EXT: data, not prose'],
    ['growth/config.yaml', 'PROSE_EXT: config, not prose'],
    ['growth/NOTES', 'PROSE_EXT: no extension at all must not be treated as prose'],
    ['test/growth/copy.md', 'EXCLUDED_PATH: a test asserting "trusted by" is refused must not itself be flagged'],
    ['tests/growth/copy.md', 'EXCLUDED_PATH'],
    ['__tests__/growth/copy.md', 'EXCLUDED_PATH'],
    ['spec/growth/copy.md', 'EXCLUDED_PATH'],
    ['fixtures/growth/copy.md', 'EXCLUDED_PATH: fixtures hold these phrases as data'],
    ['snapshots/growth/copy.md', 'EXCLUDED_PATH'],
    ['examples/growth/copy.md', 'EXCLUDED_PATH'],
    ['node_modules/pkg/launch/readme.md', 'EXCLUDED_PATH: third-party copy is not the user\'s to fix'],
    ['.git/growth/copy.md', 'EXCLUDED_PATH'],
    ['.foundry/growth/copy.md', 'EXCLUDED_PATH: Foundry state is not outbound copy'],
    ['plugins/foundry-growth/hooks/guard-claims.md', 'EXCLUDED_PATH: the authoring tree, which contains these phrases as patterns'],
    ['scripts/launch/notes.md', 'EXCLUDED_PATH'],
    ['site/src/content/landing/index.md', 'EXCLUDED_PATH: the documentation site belongs to foundry-research'],
    ['dist/marketing/index.html', 'EXCLUDED_PATH: build output is not edited by hand'],
    ['build/marketing/index.html', 'EXCLUDED_PATH'],
    ['coverage/growth/report.md', 'EXCLUDED_PATH'],
    ['vendor/growth/copy.md', 'EXCLUDED_PATH'],
    ['README.md', 'neither an outbound directory nor an outbound filename marker'],
    ['docs/README.md', 'the hook deliberately does not read documentation (foundry-research owns it)'],
    ['CONTRIBUTING.md', 'governance belongs to foundry-oss'],
    ['docs/growth-notes.md', 'OUTBOUND_DIR matches a whole path segment, not a filename prefix'],
    ['src/marketingutils/index.md', 'OUTBOUND_DIR must not match a segment that merely starts with the word'],
  ];

  for (const [rel, why] of OUT_OF_SCOPE) {
    test(`${rel} is silent — ${why}`, () => {
      const root = initRoot();
      assert.equal(runHook(write(root, rel, EVERY_TRIGGER), root).stdout, '', `${rel} was scanned; it must not be`);
    });
  }

  test('a path resolving outside the project root is silent (rel starts with ..)', () => {
    const root = initRoot();
    // Both spellings reach the same `rel.startsWith('..')` guard, and both are reachable: a
    // relative file_path is resolved against the root, an absolute one is made relative to it.
    const absolute = path.join(path.dirname(root), 'elsewhere', 'growth', 'landing.md');
    assert.equal(runHook({ tool_name: 'Write', tool_input: { file_path: absolute, content: EVERY_TRIGGER } }, root).stdout, '');
    assert.equal(runHook({ tool_name: 'Write', tool_input: { file_path: '../elsewhere/growth/landing.md', content: EVERY_TRIGGER } }, root).stdout, '');
  });

  /** The mirror image: every in-scope spelling, so the exclusions above are not passing by accident. */
  const OUTBOUND_DIRS = ['growth', 'marketing', 'launch', 'pitch', 'press', 'deck', 'decks', 'campaign', 'campaigns', 'outreach', 'landing', 'fundraising', 'brand'];
  for (const dir of OUTBOUND_DIRS) {
    test(`sanity: ${dir}/ IS in scope (OUTBOUND_DIR segment)`, () => {
      const root = initRoot();
      assert.match(reasonOf(runHook(write(root, `${dir}/copy.md`, 'Trusted by Acme'), root)), /borrowed-credibility/);
    });
  }

  const OUTBOUND_FILES = [
    'landing-page.md', 'launch_post.md', 'press.release.md', 'pitch.md', 'one-pager.md', 'announcement.md',
    'testimonial.md', 'prospectus.md', 'sales-copy.md', 'ad_copy.md', 'positioning.md', 'personal-brand.md',
    'investor-update.md',
  ];
  for (const name of OUTBOUND_FILES) {
    test(`sanity: docs/${name} IS in scope (OUTBOUND_FILE marker)`, () => {
      const root = initRoot();
      assert.match(reasonOf(runHook(write(root, `docs/${name}`, 'Trusted by Acme'), root)), /borrowed-credibility/);
    });
  }

  for (const ext of ['.md', '.mdx', '.markdown', '.txt', '.html', '.htm', '.rst', '.adoc', '.tex']) {
    test(`sanity: growth/copy${ext} IS in scope (PROSE_EXT allowlist)`, () => {
      const root = initRoot();
      assert.match(reasonOf(runHook(write(root, `growth/copy${ext}`, 'Trusted by Acme'), root)), /borrowed-credibility/);
    });
  }

  test('sanity: OUTBOUND_DIR matches at any depth, and the extension check is case-insensitive', () => {
    const root = initRoot();
    assert.match(reasonOf(runHook(write(root, 'a/b/growth/c/copy.md', 'Trusted by Acme'), root)), /borrowed-credibility/);
    assert.match(reasonOf(runHook(write(root, 'growth/COPY.MD', 'Trusted by Acme'), root)), /borrowed-credibility/);
  });

  /**
   * DIVERGENCE from the hook's own prose, recorded rather than hidden.
   *
   * The header states, of README, ADRs and governance documents: "none of those paths satisfy
   * `inScope`". They do when the filename carries an OUTBOUND_FILE marker, because that regex is
   * tested against the basename with no reference to the directory. An ADR titled
   * `docs/adr/0007-pitch-deck-structure.md` — or any ADR about positioning or an announcement —
   * is flagged, and foundry-oss/foundry-pmo own those files, not foundry-growth.
   *
   * This test pins the behaviour the code actually has so the divergence is visible in CI. If the
   * hook is fixed (by requiring an OUTBOUND_DIR segment for ADR/doc trees, or by adding `adr` to
   * EXCLUDED_PATH), this test must be inverted, not deleted.
   */
  test('KNOWN DIVERGENCE: an ADR whose filename carries an outbound marker is flagged, contradicting the header', () => {
    const root = initRoot();
    assert.match(
      reasonOf(runHook(write(root, 'docs/adr/0007-pitch-deck-structure.md', 'Trusted by Acme'), root)),
      /borrowed-credibility/,
      'if this now stays silent the hook was fixed — update the header claim and invert this test',
    );
  });
});

/* ---------------------------------------------------------------- item 6 */

describe('item 6 — at most 5 fragments, each ≤96 chars, each with a named remedy, and the slots are shared across rules', () => {
  /** A landing page that trips all five rules many times over. */
  const OVERLOADED = [
    ...Array.from({ length: 12 }, (_, i) => `Adoption grew ${i + 10}% that quarter.`),
    ...Array.from({ length: 6 }, (_, i) => `We are the fastest option in tier ${i}.`.replace(/\d/, '')),
    'Trusted by Acme. Used by thousands. As seen in the trade weekly. Backed by angels.',
    'Limited spots. Offer ends today. Act now. Last chance. Hurry.',
    'This will save you money and it is going to replace everything you use.',
  ].join('\n');

  test('at most 5 fragments are quoted', () => {
    const root = initRoot();
    const found = findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', OVERLOADED), root)));
    assert.ok(found.length > 0, 'sanity: the overloaded fixture must produce findings');
    assert.ok(found.length <= MAX_FINDINGS, `${found.length} fragments quoted; the cap is ${MAX_FINDINGS} and a reason nobody finishes reading is a reason nobody reads`);
    assert.match(reasonOf(runHook(write(root, 'growth/landing.md', OVERLOADED), root)), new RegExp(`${found.length} substantiation risks?`), 'the headline count must match the body');
  });

  test('every fragment is at most 96 characters', () => {
    const root = initRoot();
    for (const f of findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', OVERLOADED), root)))) {
      assert.ok(f.fragment.length <= FRAGMENT_CHARS, `fragment of ${f.fragment.length} chars exceeds ${FRAGMENT_CHARS}: ${f.fragment}`);
    }
  });

  test('a match far longer than the cap is truncated to exactly 96 characters with an ellipsis', () => {
    const root = initRoot();
    // The attributed-quote pattern accepts up to 240 characters between the quote marks, so this
    // is the one rule that can overrun the cap; the boundary is where an off-by-one would live.
    const quote = '"This product changed absolutely everything about the way our whole engineering organisation works day to day" — Jane Doe';
    const [f] = findingsOf(reasonOf(runHook(write(root, 'growth/testimonials.md', quote), root)));
    assert.equal(f.fragment.length, FRAGMENT_CHARS);
    assert.ok(f.fragment.endsWith('…'), 'a truncated fragment must say it was truncated');
  });

  test('every fragment carries a named remedy, and the remedy is the one belonging to its rule', () => {
    const root = initRoot();
    const found = findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', OVERLOADED), root)));
    const remedyPerRule = new Map();
    for (const f of found) {
      assert.ok(f.label.length > 0, `finding for ${f.rule} has no label`);
      assert.ok(f.remedy.length > 60, `finding for ${f.rule} has no usable remedy: "${f.remedy}"`);
      // A remedy that only says "fix it" is decoration; each of these names the artifact to cite.
      if (remedyPerRule.has(f.rule)) assert.equal(f.remedy, remedyPerRule.get(f.rule), `rule ${f.rule} reported two different remedies`);
      remedyPerRule.set(f.rule, f.remedy);
    }
    assert.ok(remedyPerRule.size > 1, 'sanity: this fixture is supposed to hit several rules');
  });

  test('THE FAIRNESS PROPERTY: one rule flooding the file cannot take all 5 slots while another rule goes unreported', () => {
    const root = initRoot();
    // Forty unsourced percentages against one fabricated endorsement, one scarcity line, one
    // superlative and one promise. A global cap consumed in file order would spend all five slots
    // on the percentages and never reach the endorsement — the more damaging of the two, and the
    // one the gate exists for. The per-rule pass in main() is what prevents that.
    const flood = Array.from({ length: 40 }, (_, i) => `Growth reached ${i + 10}% there.`).join('\n');
    const payload = `${flood}\nTrusted by Acme.\nLimited seats remaining.\nWe are the fastest.\nThis will double revenue.`;

    const found = findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', payload), root)));
    const rules = new Set(found.map((f) => f.rule));

    assert.ok(found.length <= MAX_FINDINGS);
    assert.equal(rules.size, found.length, 'no rule may appear twice while another rule is still unreported');
    for (const expected of ['unsourced-number', 'borrowed-credibility', 'manufactured-urgency', 'unqualified-superlative', 'forward-looking-as-fact']) {
      assert.ok(rules.has(expected), `${expected} has a finding in this payload but was crowded out of the report by another rule`);
    }
  });

  test('the spare slots DO go to a flooding rule once every other rule has one', () => {
    const root = initRoot();
    // The mirror of the fairness rule: sharing must not degrade into one-per-rule-and-stop, or a
    // page with a single kind of problem would under-report it and read as nearly clean.
    const flood = Array.from({ length: 40 }, (_, i) => `Growth reached ${i + 10}% there.`).join('\n');
    const found = findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', `${flood}\nTrusted by Acme.`), root)));
    assert.equal(found.length, MAX_FINDINGS, 'with only two rules firing, the remaining slots must still be filled');
    assert.equal(found.filter((f) => f.rule === 'unsourced-number').length, MAX_FINDINGS - 1);
    assert.equal(found.filter((f) => f.rule === 'borrowed-credibility').length, 1);
  });

  test('the reason names the gate, the file and both ways out of it', () => {
    const root = initRoot();
    const reason = reasonOf(runHook(write(root, 'growth/landing.md', 'Trusted by Acme'), root));
    assert.match(reason, new RegExp(GATE), 'a gate the user cannot name is a gate they cannot switch off');
    assert.match(reason, /growth\/landing\.md/, 'the reason must name the file, since a batch can carry several writes');
    assert.match(reason, /Advisory, not a block/);
    assert.match(reason, /overrides\.json/);
    assert.match(reason, /claimGuard/);
    assert.match(reason, /1 substantiation risk\b/, 'the singular form: a message that says "1 risks" reads as machine output nobody proofread');
  });

  test('an escalation is recorded in the metrics, with the rules that fired', () => {
    const root = initRoot();
    runHook(write(root, 'growth/landing.md', 'Trusted by Acme and adoption grew 40% there.'), root);
    const events = fs.readFileSync(path.join(root, '.foundry', 'metrics', 'events.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l));
    const escalation = events.find((e) => e.kind === 'gate_escalated' && e.gate === GATE);
    assert.ok(escalation, 'an escalation the operator cannot see in the metrics is one they cannot tune');
    assert.equal(escalation.file, 'growth/landing.md');
    assert.ok(escalation.findings.includes('borrowed-credibility'));
  });

  test('an unwritable metrics path costs the metric, never the decision', () => {
    const root = initRoot();
    // `.foundry/metrics` occupied by a file is what a bad merge or a read-only checkout leaves
    // behind. Telemetry is the least important thing this hook does; losing the escalation
    // because the append failed would be the most important thing it does, lost to the least.
    fs.mkdirSync(path.join(root, '.foundry'), { recursive: true });
    fs.writeFileSync(path.join(root, '.foundry', 'metrics'), 'not a directory');
    const { stdout } = runHook(write(root, 'growth/landing.md', 'Trusted by Acme'), root);
    assert.match(stdout, /"permissionDecision":"ask"/);
  });
});

/* ---------------------------------------------------------------- item 7 */

describe('item 7 — a 12 MB payload stays well inside the 10 s timeout, and at most 200_000 chars are matched', () => {
  /** 12 MB of harmless prose, built here rather than committed: a fixture that size is not reviewable. */
  function filler(bytes) {
    const unit = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod. ';
    return unit.repeat(Math.ceil(bytes / unit.length));
  }

  test('12 MB with a trigger inside the scanned window decides in well under the 10 s hooks.json timeout', () => {
    const root = initRoot();
    const content = `Trusted by Acme.\n${filler(12 * 1024 * 1024)}`;
    assert.ok(content.length >= 12 * 1024 * 1024, 'sanity: the payload really is 12 MB');

    const started = Date.now();
    const { out } = runHook(write(root, 'growth/landing.md', content), root);
    const elapsed = Date.now() - started;

    assert.equal(out.hookSpecificOutput.permissionDecision, 'ask', 'size must not disarm the gate');
    // Generous against a loaded CI box while still failing long before the 10 s the hook is given:
    // the failure this catches is a pattern that became super-linear, not a slow machine.
    assert.ok(elapsed < 5000, `took ${elapsed}ms including process spawn; the hooks.json timeout is 10s`);
  });

  test('a trigger sitting past character 200_000 is never matched', () => {
    const root = initRoot();
    // This is the only way to observe MAX_SCAN from outside the process, and it is what makes the
    // timing test above a bound rather than a measurement of one machine on one day.
    const head = filler(MAX_SCAN + 50_000);
    assert.ok(head.length > MAX_SCAN);
    assert.equal(runHook(write(root, 'growth/landing.md', `${head}\nTrusted by Google.`), root).stdout, '');
  });

  test('sanity: the same trigger just inside the window IS matched', () => {
    const root = initRoot();
    // Without this, the previous test would also pass if the hook had stopped scanning entirely.
    const head = filler(MAX_SCAN - 5_000).slice(0, MAX_SCAN - 5_000);
    assert.match(reasonOf(runHook(write(root, 'growth/landing.md', `${head}\nTrusted by Google.`), root)), /borrowed-credibility/);
  });
});

/* ---------------------------------------------------------------- item 8 */

describe('item 8 — there is no minimum text length', () => {
  test('the 17-character write "Trusted by Google" still fires', () => {
    const root = initRoot();
    const content = 'Trusted by Google';
    assert.equal(content.length, 17, 'sanity: the contract names this exact length');

    // An earlier draft skipped anything under 20 characters, which made the hook silent on the
    // shortest and most damaging thing it exists to catch: a fabricated endorsement.
    const found = findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', content), root)));
    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'borrowed-credibility');
  });

  test('a one-character-longer Edit fires too, so the rule is not tied to the Write path alone', () => {
    const root = initRoot();
    const edit = { tool_name: 'Edit', tool_input: { file_path: path.join(root, 'growth/landing.md'), old_string: '', new_string: 'Trusted by Google' } };
    assert.match(reasonOf(runHook(edit, root)), /borrowed-credibility/);
  });
});

/* ---------------------------------------------------------------- item 9 */

describe('item 9 — opt-in, the two opt-outs, and the override arms', () => {
  const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const configure = (root, cfg) => fs.writeFileSync(path.join(root, '.foundry', 'config.json'), JSON.stringify(cfg));
  const override = (root, entry) => fs.writeFileSync(path.join(root, '.foundry', 'overrides.json'), JSON.stringify({ overrides: [entry] }));
  const firing = (root) => write(root, 'growth/landing.md', 'Trusted by Acme');

  test('silent in a project that has never run `foundry init`, and leaves no .foundry behind', () => {
    const root = freshRoot();
    assert.equal(runHook(firing(root), root).stdout, '', 'PreToolUse(Write|Edit) carries no path matcher: without this guard, installing foundry-growth gates every markdown file on the machine');
    assert.ok(!fs.existsSync(path.join(root, '.foundry')), 'recordMetric must not create a .foundry tree in a project that never opted in');
  });

  test('sanity: the identical payload fires once `.foundry/` exists', () => {
    const root = initRoot();
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
  });

  test('the project root is found by walking up from a subdirectory cwd', () => {
    const root = initRoot();
    const nested = path.join(root, 'packages', 'site', 'src');
    fs.mkdirSync(nested, { recursive: true });
    // Claude Code sends the session's cwd, which is routinely a subdirectory — and in a worktree
    // ${CLAUDE_PROJECT_DIR} does not follow, which is why the hook reads cwd from stdin at all.
    // If the walk-up stopped at the first directory, every such session would find no `.foundry`,
    // the gate would go silent project-wide, and nothing would report that it had.
    assert.match(reasonOf(runHook({ ...firing(root), cwd: nested }, root)), /borrowed-credibility/);

    // And the relative path in the message stays anchored to the project root, not to the cwd.
    assert.match(reasonOf(runHook({ ...firing(root), cwd: nested }, root)), /`growth\/landing\.md`/);
  });

  test('enforcement "off" silences the gate', () => {
    const root = initRoot();
    configure(root, { enforcement: 'off' });
    assert.equal(runHook(firing(root), root).stdout, '');
  });

  test('growth.claimGuard false silences the gate', () => {
    const root = initRoot();
    configure(root, { growth: { claimGuard: false } });
    assert.equal(runHook(firing(root), root).stdout, '');
  });

  test('growth.claimGuard true, and a growth block without the key, both leave it armed', () => {
    const root = initRoot();
    // The check is `=== false`, so only the explicit opt-out counts; a truthy or absent value
    // must never be read as "off" or a typo in the config would silently disarm the gate.
    configure(root, { growth: { claimGuard: true } });
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
    configure(root, { growth: { somethingElse: 1 } });
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
  });

  test('enforcement "warn" does NOT silence it — only "off" may (fact-0009)', () => {
    const root = initRoot();
    configure(root, { enforcement: 'warn' });
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/, 'a config that reports a gate as on while it does nothing is worse than no gate');
  });

  test('an unexpired override on this gate silences it, today included', () => {
    const root = initRoot();
    override(root, { gate: GATE, reason: 'launch week, evidence lands Monday', expires: iso(30) });
    assert.equal(runHook(firing(root), root).stdout, '');

    // The comparison is `expires >= today`, so the expiry date itself is still inside the window.
    override(root, { gate: GATE, reason: 'expires at end of today', expires: iso(0) });
    assert.equal(runHook(firing(root), root).stdout, '');
  });

  test('an EXPIRED override does not silence it', () => {
    const root = initRoot();
    // Dates are computed from the clock, never hardcoded: a literal past date would become a
    // test that silently changes meaning, and a literal future one a test that fails in 2030.
    override(root, { gate: GATE, reason: 'stale suppression nobody removed', expires: iso(-1) });
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/, 'an override that has run out is not an override');
  });

  test('an override with NO expiry field does not silence it — a suppression may not be permanent', () => {
    const root = initRoot();
    // This is the arm that matters most: an entry with no `expires` is the easy thing to write and
    // would otherwise switch the gate off forever, with no date at which anyone revisits it. The
    // reason string tells the user exactly this, so the code and the message must agree.
    override(root, { gate: GATE, reason: 'we will get to it' });
    const reason = reasonOf(runHook(firing(root), root));
    assert.match(reason, /borrowed-credibility/);
    assert.match(reason, /An entry with no `expires` is ignored/);
  });

  test('an override for a different gate does not silence this one', () => {
    const root = initRoot();
    override(root, { gate: 'some-other-gate', reason: 'unrelated', expires: iso(30) });
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
  });

  test('a malformed overrides.json leaves the gate armed rather than disarming it', () => {
    const root = initRoot();
    // Failing open on an unreadable suppression file would make "break the JSON" the easiest way
    // to switch every Foundry gate off, and it would look like an accident.
    fs.writeFileSync(path.join(root, '.foundry', 'overrides.json'), '{ not json');
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
    fs.writeFileSync(path.join(root, '.foundry', 'overrides.json'), JSON.stringify({ overrides: 'nope' }));
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
  });

  test('a malformed or non-object config.json leaves the gate armed', () => {
    const root = initRoot();
    fs.writeFileSync(path.join(root, '.foundry', 'config.json'), '{ not json');
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
    fs.writeFileSync(path.join(root, '.foundry', 'config.json'), '[]');
    assert.match(reasonOf(runHook(firing(root), root)), /borrowed-credibility/);
  });
});

/* -------------------------------------------------- the five detectors, one arm each */

/**
 * One firing fixture per rule. These are not part of the numbered contract, but every `accept`
 * suppressor above (items 4 and 5) is only meaningful if the rule it suppresses can fire at all:
 * without these, a rule deleted by accident would make several tests above pass more easily.
 */
describe('each detector fires on its own, so the suppression tests above cannot pass vacuously', () => {
  const cases = [
    ['unsourced-number', 'Adoption grew 40% last quarter.'],
    ['unsourced-number', 'We serve 10,000 developers.'],
    ['unsourced-number', 'It is 3x faster.'],
    ['unsourced-number', 'Annual revenue reached $2.5M.'],
    ['unqualified-superlative', 'The fastest deployment tool available.'],
    ['unqualified-superlative', 'The only tool that does this.'],
    ['unqualified-superlative', 'We are the #1 choice.'],
    ['unqualified-superlative', 'A world-class, industry-leading platform.'],
    ['unqualified-superlative', 'Risk-free and guaranteed.'],
    ['unqualified-superlative', 'It never fails and always works.'],
    ['borrowed-credibility', 'Trusted by Acme.'],
    ['borrowed-credibility', 'Used by thousands of engineers.'],
    ['borrowed-credibility', 'As seen in the trade weekly.'],
    ['borrowed-credibility', 'Backed by well-known angels.'],
    ['borrowed-credibility', 'See our customer logos below.'],
    ['manufactured-urgency', 'Limited seats for the workshop.'],
    ['manufactured-urgency', 'Only 3 left.'],
    ['manufactured-urgency', 'Offer ends today.'],
    ['manufactured-urgency', 'Act now, last chance.'],
    ['manufactured-urgency', 'Spots are filling up fast.'],
    ['forward-looking-as-fact', 'This will cut your build time.'],
    ['forward-looking-as-fact', 'It is going to replace the whole toolchain.'],
    ['forward-looking-as-fact', 'You will save a day a week.'],
    ['forward-looking-as-fact', 'By 2030, the market will consolidate.'],
  ];

  for (const [rule, content] of cases) {
    test(`${rule}: "${content}"`, () => {
      const root = initRoot();
      const found = findingsOf(reasonOf(runHook(write(root, 'growth/landing.md', content), root)));
      assert.ok(found.some((f) => f.rule === rule), `expected ${rule}, got ${found.map((f) => f.rule).join(', ') || 'nothing'}`);
    });
  }

  test('a bare markdown link near a number is not that number\'s source', () => {
    const root = initRoot();
    // Removed from CITED on purpose: a landing page's nav link `[Docs](/docs)` sitting beside
    // "40% faster" silenced the gate on exactly the file it exists for.
    assert.match(reasonOf(runHook(write(root, 'growth/landing.md', 'See [Docs](/docs). Throughput improved 40%.'), root)), /unsourced-number/);
  });

  test('a bare ISO date near a number is a launch date, not a measurement date', () => {
    const root = initRoot();
    assert.match(reasonOf(runHook(write(root, 'growth/landing.md', '# Launch 2026-08-20\n\nThroughput improved 40%.'), root)), /unsourced-number/);
  });
});
