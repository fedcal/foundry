import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFrontmatter, stringifyFrontmatter, estimateTokens,
  ensureDirs, writeFact, activeFacts, listFacts, searchFacts, buildIndex,
  validate, loadSchema, activeOverride, overrideStatus, paths,
} from '../lib/foundry.mjs';

const SCHEMA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas');

let root;
before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-test-'));
  ensureDirs(root);
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe('frontmatter', () => {
  test('parses scalars, lists and inline arrays', () => {
    const { data, body } = parseFrontmatter(
      '---\nid: fact-0001\nconfidence: high\nexpires: null\ncount: 3\nflag: true\ntags: [auth, security]\nlist:\n  - one\n  - two\n---\n\nBody text.\n',
    );
    assert.equal(data.id, 'fact-0001');
    assert.equal(data.expires, null);
    assert.equal(data.count, 3);
    assert.equal(data.flag, true);
    assert.deepEqual(data.tags, ['auth', 'security']);
    assert.deepEqual(data.list, ['one', 'two']);
    assert.equal(body.trim(), 'Body text.');
  });

  test('returns the whole source when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('just text');
    assert.deepEqual(data, {});
    assert.equal(body, 'just text');
  });

  test('round-trips through stringify', () => {
    const original = { id: 'fact-0009', tags: ['a', 'b'], expires: null };
    const { data } = parseFrontmatter(stringifyFrontmatter(original, 'Body.'));
    assert.equal(data.id, original.id);
    assert.deepEqual(data.tags, original.tags);
    assert.equal(data.expires, null);
  });
});

describe('memory', () => {
  test('writes a fact and assigns a sequential id', () => {
    const r = writeFact(root, { title: 'Auth uses Keycloak', body: 'Delegated identity.', type: 'decision' }, '2026-08-27');
    assert.equal(r.action, 'created');
    assert.equal(r.id, 'fact-0001');
    assert.ok(fs.existsSync(r.file));
  });

  test('identical content is not stored twice', () => {
    const r = writeFact(root, { title: 'Auth uses Keycloak', body: 'Delegated identity.', type: 'decision' }, '2026-08-27');
    assert.equal(r.action, 'unchanged');
    assert.equal(listFacts(root).length, 1);
  });

  test('a same-titled fact supersedes the previous one and only the newer stays active', () => {
    const r = writeFact(root, { title: 'Auth uses Keycloak', body: 'Now with token exchange enabled.', type: 'decision' }, '2026-08-28');
    assert.equal(r.action, 'updated');
    assert.equal(r.supersedes, 'fact-0001');
    const active = activeFacts(root, '2026-08-28');
    assert.equal(active.length, 1);
    assert.equal(active[0].id, r.id);
  });

  test('expired facts drop out of the active set', () => {
    writeFact(root, { title: 'Temporary waiver for legacy TLS', body: 'Expires with the migration.', type: 'constraint', expires: '2026-01-01' }, '2025-06-01');
    const active = activeFacts(root, '2026-08-28');
    assert.ok(!active.some((f) => f.title.includes('Temporary waiver')));
    assert.ok(listFacts(root).some((f) => f.title.includes('Temporary waiver')), 'expired facts are retained on disk as history');
  });

  test('search ranks title matches above body matches and respects the type filter', () => {
    writeFact(root, { title: 'Database is PostgreSQL 16', body: 'Fixed by client policy.', type: 'constraint', tags: ['database'] }, '2026-08-28');
    writeFact(root, { title: 'Nightly batch window', body: 'Runs against the database at 02:00.', type: 'convention' }, '2026-08-28');

    const hits = searchFacts(root, 'database', { limit: 5, minScore: 1 });
    assert.ok(hits.length >= 2);
    assert.match(hits[0].title, /PostgreSQL/, 'a title hit outranks a body-only hit');

    const filtered = searchFacts(root, 'database', { type: 'convention', minScore: 1 });
    assert.ok(filtered.every((f) => f.type === 'convention'));
  });

  test('search returns nothing for terms that appear nowhere', () => {
    assert.deepEqual(searchFacts(root, 'kubernetes helm chart', { minScore: 1 }), []);
  });

  test('the index stays inside its token budget and reports what it dropped', () => {
    for (let i = 0; i < 200; i += 1) {
      writeFact(root, { title: `Generated convention number ${i} with a deliberately long title`, body: `Body ${i}.`, type: 'convention' }, '2026-08-28');
    }
    const small = buildIndex(root, { budget: 300 });
    assert.ok(small.dropped > 0, 'entries beyond the budget are dropped, not silently included');
    assert.ok(small.tokens <= 300, `index used ${small.tokens} tokens against a 300 budget`);
    const content = fs.readFileSync(paths(root).index, 'utf8');
    assert.match(content, /entries omitted/, 'the index says what it left out');
  });
});

describe('schema validation', () => {
  const finding = loadSchema('finding.v1', SCHEMA_DIR);

  test('every shipped contract loads', () => {
    for (const file of fs.readdirSync(SCHEMA_DIR)) {
      const id = file.replace('.schema.json', '');
      assert.ok(loadSchema(id, SCHEMA_DIR), `${id} failed to load`);
    }
  });

  test('accepts a conforming finding', () => {
    const errors = validate(finding.schema, {
      schema: 'finding.v1',
      producedBy: 'appsec-reviewer',
      id: 'F-1',
      severity: 'high',
      title: 'Login endpoint has no rate limit',
      summary: 'Credentials can be enumerated.',
      failureScenario: 'An attacker sends 10k requests per minute to /api/login and no lockout occurs.',
      confidence: 'high',
    }, { schemaDir: finding.dir });
    assert.deepEqual(errors, []);
  });

  test('rejects a missing required property and names it', () => {
    const errors = validate(finding.schema, {
      schema: 'finding.v1', producedBy: 'x', id: 'F-2', severity: 'high', title: 'No scenario', confidence: 'high',
    }, { schemaDir: finding.dir });
    assert.ok(errors.some((e) => e.includes('failureScenario')), errors.join('; '));
  });

  test('rejects an out-of-enum value', () => {
    const errors = validate(finding.schema, {
      schema: 'finding.v1', producedBy: 'x', id: 'F-3', severity: 'catastrophic',
      title: 'Bad severity', summary: 's', failureScenario: 'f', confidence: 'high',
    }, { schemaDir: finding.dir });
    assert.ok(errors.some((e) => e.includes('severity')), errors.join('; '));
  });

  test('rejects unexpected properties, because contracts are closed', () => {
    const errors = validate(finding.schema, {
      schema: 'finding.v1', producedBy: 'x', id: 'F-4', severity: 'low',
      title: 't', summary: 's', failureScenario: 'f', confidence: 'low', invented: true,
    }, { schemaDir: finding.dir });
    assert.ok(errors.some((e) => e.includes('invented')), errors.join('; '));
  });

  test('enforces maxLength, minItems and date format', () => {
    const adr = loadSchema('adr.v1', SCHEMA_DIR);
    const errors = validate(adr.schema, {
      schema: 'adr.v1', producedBy: 'solution-architect', number: 1,
      title: 'x'.repeat(200), status: 'accepted', date: 'not-a-date',
      context: 'c', options: [{ name: 'only one', pros: [], cons: [] }], decision: 'd',
    }, { schemaDir: adr.dir });
    assert.ok(errors.some((e) => e.includes('longer than 120')), 'maxLength');
    assert.ok(errors.some((e) => e.includes('valid date')), 'format');
    assert.ok(errors.some((e) => e.includes('at least 2 items')), 'minItems — an ADR with one option is not a decision');
  });

  test('follows a $ref into another contract file', () => {
    const review = loadSchema('review.v1', SCHEMA_DIR);
    const errors = validate(review.schema, {
      schema: 'review.v1', producedBy: 'appsec-reviewer', target: 'src/', dimension: 'security',
      verdict: 'block', summary: 's',
      findings: [{ schema: 'finding.v1', producedBy: 'appsec-reviewer', id: 'F-1', severity: 'high', title: 't', summary: 's', failureScenario: 'f', confidence: 'high' }],
    }, { schemaDir: review.dir });
    assert.deepEqual(errors, []);
  });

  test('compliance checks cannot omit the not-legal-advice disclaimer', () => {
    const cc = loadSchema('compliance-check.v1', SCHEMA_DIR);
    const errors = validate(cc.schema, {
      schema: 'compliance-check.v1', producedBy: 'compliance-engine', controlId: 'C-1',
      jurisdiction: 'eu', instrument: 'GDPR', requirement: 'r', status: 'undetermined',
      rationale: 'no evidence found', assessedOn: '2026-08-27',
    }, { schemaDir: cc.dir });
    assert.ok(errors.some((e) => e.includes('disclaimer')), errors.join('; '));
  });
});

describe('overrides', () => {
  test('an expired override is not active', () => {
    fs.writeFileSync(
      paths(root).overrides,
      JSON.stringify({ overrides: [{ gate: 'rm-recursive-force', reason: 'one-off cleanup', expires: '2026-01-01' }] }),
    );
    // Returning a truthy expired entry let `if (activeOverride(...))` honour a lapsed override.
    assert.equal(activeOverride(root, 'rm-recursive-force', '2026-08-27'), null);
    assert.equal(overrideStatus(root, 'rm-recursive-force', '2026-08-27').state, 'expired');
  });

  test('a live override is honoured', () => {
    const o = activeOverride(root, 'rm-recursive-force', '2025-12-31');
    assert.equal(o.reason, 'one-off cleanup');
    assert.equal(overrideStatus(root, 'rm-recursive-force', '2025-12-31').state, 'active');
  });

  test('an unknown gate has no override', () => {
    assert.equal(activeOverride(root, 'not-a-gate', '2026-08-27'), null);
    assert.equal(overrideStatus(root, 'not-a-gate', '2026-08-27').state, 'none');
  });
});

describe('token estimation', () => {
  test('is proportional to length and zero for nothing', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens(null), 0);
    assert.ok(estimateTokens('x'.repeat(400)) === 100);
  });
});

describe('facts honour their own contract', () => {
  test('a written fact validates against fact.v1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-contract-'));
    writeFact(dir, {
      type: 'decision', scope: 'project', title: 'Contracts apply to memory too',
      body: 'Facts are validated like any other artifact.', confidence: 'high', source: 'test',
    }, '2026-08-27');

    const file = fs.readdirSync(paths(dir).facts)[0];
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(paths(dir).facts, file), 'utf8'));
    const loaded = loadSchema('fact.v1');
    // Memory was the one tier exempt from the contracts Foundry sells; it no longer is.
    assert.deepEqual(
      validate(loaded.schema, { ...data, body: body.trim() }, { schemaDir: loaded.dir }),
      [],
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('index budget', () => {
  test('the truncation footer is counted inside the budget, not added on top', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-budget-'));
    for (let i = 0; i < 60; i += 1) {
      writeFact(dir, {
        type: 'domain', scope: 'project', title: `Fact number ${i} with a deliberately long title`,
        body: `Body ${i}`, confidence: 'medium', source: 'test',
      }, '2026-08-27');
    }
    const budget = 300;
    const result = buildIndex(dir, { budget });
    assert.ok(result.dropped > 0, 'the fixture must actually overflow the budget');
    const actual = estimateTokens(fs.readFileSync(paths(dir).index, 'utf8'));
    assert.ok(actual <= budget, `index is ${actual} tokens, over its own ${budget}-token budget`);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
