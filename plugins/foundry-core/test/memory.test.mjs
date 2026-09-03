import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  parseFrontmatter, ensureDirs, writeFact, activeFacts, listFacts, searchFacts, buildIndex,
  loadSchema, estimateTokens, paths,
} from '../lib/foundry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB_URL = pathToFileURL(path.join(HERE, '..', 'lib', 'foundry.mjs')).href;

// Every temp dir this file creates gets tracked here and swept in `after`, so a
// crashed assertion never leaves a stray directory behind in the OS temp folder.
const tempDirs = [];
function freshDir(prefix = 'foundry-memory-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  ensureDirs(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** Frontmatter keys a normal, well-formed write produces — the reference an
 * injection attempt must not be able to add to, remove from, or override beyond. */
function referenceKeys(dir) {
  const r = writeFact(
    dir,
    { title: 'Reference key set fact', body: 'Only used to snapshot which frontmatter keys a normal write produces.', type: 'domain' },
    '2026-08-28',
  );
  const { data } = parseFrontmatter(fs.readFileSync(r.file, 'utf8'));
  return Object.keys(data).sort();
}

/* ------------------------------------------------------- contract enforcement */

describe('writeFact enforces fact.v1', () => {
  const { schema } = loadSchema('fact.v1');
  const titleMax = schema.properties.title.maxLength;
  const bodyMax = schema.properties.body.maxLength;
  const typeEnum = schema.properties.type.enum;
  const confidenceEnum = schema.properties.confidence.enum;

  test('rejects a title longer than the schema maxLength and writes nothing', () => {
    const dir = freshDir();
    assert.throws(
      () => writeFact(dir, { title: 'x'.repeat(titleMax + 1), body: 'A body.', type: 'domain' }, '2026-08-28'),
      /fact does not satisfy fact\.v1/,
    );
    assert.equal(listFacts(dir).length, 0, 'a rejected fact must not land on disk');
  });

  test('rejects a body longer than the schema maxLength and writes nothing', () => {
    const dir = freshDir();
    assert.throws(
      () => writeFact(dir, { title: 'Overlong body', body: 'y'.repeat(bodyMax + 1), type: 'domain' }, '2026-08-28'),
      /fact does not satisfy fact\.v1/,
    );
    assert.equal(listFacts(dir).length, 0);
  });

  test('rejects a type outside the schema enum and writes nothing', () => {
    const dir = freshDir();
    assert.ok(!typeEnum.includes('not-a-real-type'), 'fixture must actually be out of enum');
    assert.throws(
      () => writeFact(dir, { title: 'Bad type', body: 'A body.', type: 'not-a-real-type' }, '2026-08-28'),
      /fact does not satisfy fact\.v1/,
    );
    assert.equal(listFacts(dir).length, 0);
  });

  test('rejects a confidence outside the schema enum and writes nothing', () => {
    const dir = freshDir();
    assert.ok(!confidenceEnum.includes('extreme'), 'fixture must actually be out of enum');
    assert.throws(
      () => writeFact(dir, { title: 'Bad confidence', body: 'A body.', type: 'domain', confidence: 'extreme' }, '2026-08-28'),
      /fact does not satisfy fact\.v1/,
    );
    assert.equal(listFacts(dir).length, 0);
  });

  test('rejects an expires value that is not a valid date and writes nothing', () => {
    const dir = freshDir();
    assert.throws(
      () => writeFact(dir, { title: 'Bad expiry', body: 'A body.', type: 'domain', expires: 'not-a-date' }, '2026-08-28'),
      /fact does not satisfy fact\.v1/,
    );
    assert.equal(listFacts(dir).length, 0);
  });

  test('accepts a conforming fact, including one that sits exactly at the length limits', () => {
    const dir = freshDir();
    const r = writeFact(
      dir,
      { title: 'z'.repeat(titleMax), body: 'w'.repeat(bodyMax), type: 'convention', confidence: 'low' },
      '2026-08-28',
    );
    assert.equal(r.action, 'created');
    assert.equal(listFacts(dir).length, 1);
  });
});

/* ----------------------------------------------------------- frontmatter injection */

describe('writeFact resists frontmatter injection', () => {
  const injectionCases = [
    { name: 'a bare \\n', title: 'Line one\nid: fact-9999' },
    { name: 'a \\r\\n pair', title: 'Line one\r\nid: fact-9999' },
    { name: 'an attempt to close the frontmatter block early', title: 'Legit title\n---\nbody: fake\n---' },
    { name: 'an attempt to override id', title: 'Nice try\nid: fact-9999' },
    { name: 'an attempt to override schema', title: 'Nice try\nschema: evil.v1' },
    { name: 'an attempt to override expires so an active fact reads as expired', title: 'Nice try\nexpires: 2000-01-01' },
  ];

  for (const { name, title } of injectionCases) {
    test(`a title containing ${name} cannot forge or overwrite frontmatter keys`, () => {
      const dir = freshDir();
      const keys = referenceKeys(dir);

      const r = writeFact(dir, { title, body: 'An honest body for this fact.', type: 'domain' }, '2026-08-28');
      const raw = fs.readFileSync(r.file, 'utf8');
      const { data, body } = parseFrontmatter(raw);

      assert.equal(data.id, r.id, 'the id must be the one writeFact assigned, not an injected one');
      assert.equal(data.schema, 'fact.v1', 'the schema tag must survive injection');
      assert.equal(data.type, 'domain', 'the type must survive injection');
      assert.notEqual(data.id, 'fact-9999');
      assert.notEqual(data.expires, '2000-01-01');
      assert.deepEqual(Object.keys(data).sort(), keys, 'no extraneous frontmatter key was forged');
      assert.match(body.trim(), /An honest body for this fact\./, 'the real body text must still be present');

      // The file the injection targeted must still be a single well-formed frontmatter
      // block: parsing it again must not surface a second, forged block.
      assert.equal((raw.match(/^---$/gm) || []).length, 2, 'exactly one frontmatter block, opened and closed once');
    });
  }

  test('a hostile value inside tags cannot forge a frontmatter key either', () => {
    const dir = freshDir();
    const keys = referenceKeys(dir);

    const r = writeFact(
      dir,
      { title: 'Fact with hostile tags', body: 'A body.', type: 'domain', tags: ['ok', 'evil\nid: fact-8888', 'also\r\nschema: evil.v1'] },
      '2026-08-28',
    );
    const { data } = parseFrontmatter(fs.readFileSync(r.file, 'utf8'));

    assert.equal(data.id, r.id);
    assert.equal(data.schema, 'fact.v1');
    assert.deepEqual(Object.keys(data).sort(), keys, 'no extraneous frontmatter key was forged via tags');
  });
});

/* ---------------------------------------------------------------------- concurrency */

describe('writeFact under real concurrency', () => {
  test('N different facts written from N separate processes at once all survive, with no lost writes', { timeout: 60_000 }, async () => {
    const dir = freshDir('foundry-memory-concurrency-');
    const workerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-memory-worker-'));
    tempDirs.push(workerDir);

    const workerFile = path.join(workerDir, 'concurrent-writer.mjs');
    fs.writeFileSync(
      workerFile,
      [
        `import { writeFact } from '${LIB_URL}';`,
        "const [, , dir, idx, iso] = process.argv;",
        'try {',
        '  const r = writeFact(dir, {',
        '    title: `Concurrent fact ${idx}`,',
        '    body: `Body written by concurrent worker ${idx}.`,',
        "    type: 'domain',",
        '  }, iso);',
        '  process.stdout.write(JSON.stringify(r));',
        '} catch (err) {',
        '  process.stderr.write(String((err && err.stack) || err));',
        '  process.exit(1);',
        '}',
        '',
      ].join('\n'),
    );

    const N = 16;
    const runWorker = (idx) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [workerFile, dir, String(idx), '2026-08-28'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(`worker ${idx} exited ${code}: ${stderr}`));
        else resolve(JSON.parse(stdout));
      });
    });

    // Launched together, not awaited one at a time, so the processes genuinely race
    // on the same .foundry/memory/facts directory.
    const results = await Promise.all(Array.from({ length: N }, (_, i) => runWorker(i)));

    assert.equal(results.length, N);
    const ids = results.map((r) => r.id);
    assert.equal(new Set(ids).size, N, `expected ${N} distinct ids, got ${JSON.stringify(ids)}`);

    const onDisk = fs.readdirSync(paths(dir).facts).filter((f) => f.endsWith('.md'));
    assert.equal(onDisk.length, N, `expected ${N} files on disk, found ${onDisk.length}: ${JSON.stringify(onDisk)}`);

    const titles = new Set(listFacts(dir).map((f) => f.title));
    for (let i = 0; i < N; i += 1) {
      assert.ok(titles.has(`Concurrent fact ${i}`), `fact ${i} is missing from disk — a concurrent write was lost`);
    }
  });
});

/* --------------------------------------------------------------- round-trip & retrieval */

describe('writeFact -> activeFacts -> searchFacts round-trip', () => {
  test('a relevant query finds the fact, an irrelevant one does not', () => {
    const dir = freshDir();
    writeFact(dir, { title: 'Payments run through Stripe', body: 'Checkout and subscriptions both use it.', type: 'decision', tags: ['payments'] }, '2026-08-28');

    const hits = searchFacts(dir, 'stripe payments', { minScore: 1 });
    assert.ok(hits.some((f) => f.title.includes('Stripe')), 'a relevant query must surface the fact');

    const miss = searchFacts(dir, 'kubernetes helm operator', { minScore: 1 });
    assert.deepEqual(miss, [], 'an irrelevant query must not surface the fact');
  });

  test('an expired fact drops out of activeFacts and out of search', () => {
    const dir = freshDir();
    writeFact(dir, { title: 'Legacy webhook shim stays until Q1', body: 'Remove once partner migrates.', type: 'constraint', expires: '2026-01-01' }, '2025-06-01');

    const active = activeFacts(dir, '2026-08-28');
    assert.ok(!active.some((f) => f.title.includes('Legacy webhook shim')), 'an expired fact must not be active');

    const hits = searchFacts(dir, 'legacy webhook shim', { minScore: 1 });
    assert.ok(!hits.some((f) => f.title.includes('Legacy webhook shim')), 'an expired fact must not be retrievable by search either');

    assert.ok(listFacts(dir).some((f) => f.title.includes('Legacy webhook shim')), 'expired facts still exist on disk as history');
  });

  test('rewriting the same title supersedes the previous fact, and only the newer one is active', () => {
    const dir = freshDir();
    const first = writeFact(dir, { title: 'On-call rotation is weekly', body: 'Handoff on Mondays.', type: 'convention' }, '2026-01-01');
    const second = writeFact(dir, { title: 'On-call rotation is weekly', body: 'Handoff moved to Wednesdays.', type: 'convention' }, '2026-08-28');

    assert.equal(second.action, 'updated');
    assert.equal(second.supersedes, first.id);

    const active = activeFacts(dir, '2026-08-28');
    const matches = active.filter((f) => f.title === 'On-call rotation is weekly');
    assert.equal(matches.length, 1, 'only the newer fact stays active');
    assert.equal(matches[0].id, second.id);
  });
});

/* ---------------------------------------------------------------------- index budget */

describe('buildIndex stays inside its token budget honestly', () => {
  test('reported dropped/listed counts match what actually landed in the file', () => {
    const dir = freshDir();
    const N = 150;
    for (let i = 0; i < N; i += 1) {
      writeFact(dir, { title: `Budget fact number ${i} with a deliberately long descriptive title`, body: `Body text for fact ${i}.`, type: 'domain' }, '2026-08-28');
    }

    const budget = 250;
    const result = buildIndex(dir, { budget });

    assert.equal(result.facts, N);
    assert.equal(result.listed + result.dropped, result.facts, 'listed and dropped must account for every active fact');
    assert.ok(result.dropped > 0, 'the fixture must actually overflow so budget enforcement is exercised');
    assert.ok(result.tokens <= budget, `index reports ${result.tokens} tokens against a ${budget}-token budget`);

    const content = fs.readFileSync(paths(dir).index, 'utf8');
    assert.ok(estimateTokens(content) <= budget, 'the file on disk must itself respect the budget, not just the reported figure');

    const footerMatch = /^> (\d+) entries omitted/m.exec(content);
    assert.ok(footerMatch, 'the index must say how many entries it left out');
    assert.equal(Number(footerMatch[1]), result.dropped, 'the number printed in the footer must match the real drop count');

    const listedEntries = (content.match(/^- \*\*fact-/gm) || []).length;
    assert.equal(listedEntries, result.listed, 'the number of entries actually printed must match the reported listed count');
  });
});

/* ------------------------------------------------------------------ parser robustness */

describe('parseFrontmatter does not throw on malformed input', () => {
  const cases = [
    ['a file with no frontmatter at all', 'just plain body text, no frontmatter here'],
    ['an empty string', ''],
    ['an empty frontmatter block', '---\n---\n\nBody only.\n'],
    ['a scalar value immediately followed by a list under the same key', '---\ntags: notalist\n  - item-one\n  - item-two\n---\n\nBody.\n'],
    ['an opening fence with no closing fence (truncated mid-write)', '---\nid: fact-0001\nschema: fact.v1\ntitle: Cut off mid'],
    ['a closing fence with no trailing newline', '---\nid: fact-0001\n---'],
    ['a stray key with no value', '---\nid:\nschema: fact.v1\n---\n\nBody.\n'],
    ['a line that is neither a key nor a list item', '---\nid: fact-0001\n   just some noise\nschema: fact.v1\n---\n\nBody.\n'],
  ];

  for (const [name, source] of cases) {
    test(`does not throw on ${name}`, () => {
      assert.doesNotThrow(() => parseFrontmatter(source));
      const { data, body } = parseFrontmatter(source);
      assert.equal(typeof data, 'object');
      assert.equal(typeof body, 'string');
    });
  }

  test('a file with no frontmatter returns the whole source as body and no data', () => {
    const { data, body } = parseFrontmatter('just plain body text, no frontmatter here');
    assert.deepEqual(data, {});
    assert.equal(body, 'just plain body text, no frontmatter here');
  });

  test('a truncated file missing its closing fence is treated as bodyless data, not parsed as if closed', () => {
    const { data, body } = parseFrontmatter('---\nid: fact-0001\nschema: fact.v1\ntitle: Cut off mid');
    assert.deepEqual(data, {}, 'without a closing fence the block cannot be trusted as frontmatter');
    assert.match(body, /Cut off mid/);
  });
});
