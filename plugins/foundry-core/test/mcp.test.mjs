/**
 * End-to-end tests for the Foundry MCP server: real process, real stdio, real JSON-RPC.
 *
 * These exist because plugins/foundry-core/mcp/server.mjs shipped ~400 lines and 9 tools
 * with zero tests, and path-traversal bugs reached the eve of publication as a result.
 * Every test here talks NDJSON over stdin/stdout to a spawned `node mcp/server.mjs`
 * exactly the way Claude Code does — no importing server internals, no mocking fs.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

import { ensureDirs, paths } from '../lib/foundry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, '..', 'mcp', 'server.mjs');

/* -------------------------------------------------------------- test helpers */

function tmpRoot(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `foundry-mcp-${prefix}-`));
  ensureDirs(dir);
  return dir;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rejects with `label` if `promise` does not settle within `ms` — bounds every await. */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out waiting for: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * A thin JSON-RPC-over-stdio client wrapping the real server process, matching how
 * Claude Code itself talks to it: NDJSON in both directions, no framing headers.
 * Messages whose id has no matching pending request (parse errors carry id:null,
 * or a bug could answer a notification) are collected as "stray" and emitted.
 */
class McpClient extends EventEmitter {
  constructor(root) {
    super();
    this.proc = spawn('node', [SERVER], {
      env: { ...process.env, FOUNDRY_PROJECT_DIR: root },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this._buffer = '';
    this._nextId = 0;
    this._pending = new Map();
    this.stray = [];
    this.stderr = '';
    this.proc.stderr.on('data', (d) => { this.stderr += d.toString(); });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => this._onData(chunk));
    this.exited = new Promise((resolve) => this.proc.on('exit', (code, signal) => resolve({ code, signal })));
  }

  _onData(chunk) {
    this._buffer += chunk;
    let nl;
    while ((nl = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.slice(0, nl).trim();
      this._buffer = this._buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this.stray.push({ unparsable: line });
        continue;
      }
      const id = msg && typeof msg === 'object' ? msg.id : undefined;
      if (this._pending.has(id)) {
        this._pending.get(id)(msg);
        this._pending.delete(id);
      } else {
        this.stray.push(msg);
        this.emit('stray', msg);
      }
    }
  }

  /** Register interest in a response for `id` before writing the request that produces it. */
  expect(id) {
    return new Promise((resolve) => this._pending.set(id, resolve));
  }

  writeRaw(str) {
    this.proc.stdin.write(str);
  }

  send(obj) {
    this.writeRaw(JSON.stringify(obj) + '\n');
  }

  /** Request/response round trip with a default 3s bound so a stuck server fails fast, not forever. */
  async request(method, params, { id, timeoutMs = 3000 } = {}) {
    const reqId = id ?? `id-${++this._nextId}`;
    const pending = this.expect(reqId);
    this.send({ jsonrpc: '2.0', id: reqId, method, ...(params !== undefined ? { params } : {}) });
    return withTimeout(pending, timeoutMs, `response to ${method} (id ${reqId})`);
  }

  /** A JSON-RPC notification: no id, and per spec must never receive a direct response. */
  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}) });
  }

  callTool(name, args, opts) {
    return this.request('tools/call', { name, arguments: args }, opts);
  }

  /** Proves the process is still alive and answering — call after anything hostile. */
  async ping() {
    const res = await this.request('ping');
    assert.deepEqual(res, { jsonrpc: '2.0', id: res.id, result: {} });
    return res;
  }

  async close(root) {
    this.proc.stdin.end();
    await withTimeout(this.exited, 3000, 'server process exit after stdin close');
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
}

const RISK_ARTIFACT = {
  id: 'RISK-1',
  title: 'Vendor API rate limits threaten deploy cadence',
  category: 'vendor',
  probability: 0.4,
  impactEur: 5000,
  mitigation: 'Add exponential backoff and a fallback provider.',
  owner: 'platform-team',
  status: 'open',
};

function writeRunbook(root, slug, { title = 'Test runbook', trigger = 'testing' } = {}) {
  const file = path.join(paths(root).runbooks, `${slug}.md`);
  fs.writeFileSync(
    file,
    `---\ntitle: ${title}\ntrigger: ${trigger}\n---\n\n# ${title}\n\nBody of the ${slug} runbook.\n`,
  );
  return file;
}

const TOOL_NAMES = [
  'memory_search', 'memory_write', 'memory_index',
  'runbook_list', 'runbook_get',
  'contract_validate',
  'blackboard_write', 'blackboard_read',
  'token_report',
];

/* -------------------------------------------------------------------- protocol */

describe('MCP protocol', () => {
  let root;
  let client;

  before(() => {
    root = tmpRoot('protocol');
    client = new McpClient(root);
  });
  after(() => client.close(root));

  test('initialize reports the negotiated protocol version and tool/resource capabilities', async () => {
    const res = await client.request('initialize', { protocolVersion: '2025-06-18' });
    assert.equal(res.result.protocolVersion, '2025-06-18');
    assert.ok(res.result.capabilities.tools, 'must declare tools capability');
    assert.ok(res.result.capabilities.resources, 'must declare resources capability');
    assert.equal(res.result.serverInfo.name, 'foundry');
  });

  test('tools/list declares exactly the 9 Foundry tools', async () => {
    const res = await client.request('tools/list');
    const names = res.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [...TOOL_NAMES].sort());
    for (const t of res.result.tools) {
      assert.equal(t.inputSchema.type, 'object', `${t.name} must declare an object input schema`);
    }
  });

  test('resources/list exposes the memory index and contracts resources', async () => {
    const res = await client.request('resources/list');
    const uris = res.result.resources.map((r) => r.uri);
    assert.ok(uris.includes('foundry://memory/index'));
    assert.ok(uris.includes('foundry://contracts'));
  });

  test('ping answers an empty result', async () => {
    const res = await client.request('ping');
    assert.deepEqual(res.result, {});
  });

  test('a notification (no id) for an unhandled method receives no response at all', async () => {
    const before_ = client.stray.length;
    client.notify('notifications/cancelled', { requestId: 'whatever' });
    // Prove liveness with a real, correlated request instead of a blind sleep.
    await client.ping();
    assert.equal(client.stray.length, before_, 'a notification must never provoke a reply on the wire');
  });

  test('an unknown method with an id is rejected with -32601', async () => {
    const res = await client.request('totally/unknown');
    assert.equal(res.error.code, -32601);
    assert.match(res.error.message, /totally\/unknown/);
  });

  test('tools/call for an unknown tool is rejected with -32601, not silently accepted', async () => {
    const res = await client.callTool('no-such-tool', {});
    assert.equal(res.error.code, -32601);
    assert.match(res.error.message, /no-such-tool/);
  });

  test('malformed JSON on a line is reported as -32700 Parse error and does not kill the connection', async () => {
    const pending = client.expect(null);
    client.writeRaw('{ this is not json\n');
    const res = await withTimeout(pending, 2000, 'parse-error response');
    assert.equal(res.error.code, -32700);
    await client.ping();
  });

  test('a JSON-RPC request split across multiple stdin chunks is still reassembled and answered', async () => {
    const id = 'framed-request';
    const payload = JSON.stringify({
      jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'token_report', arguments: {} },
    });
    const mid = Math.floor(payload.length / 2);
    const pending = client.expect(id);
    client.writeRaw(payload.slice(0, mid)); // no trailing newline: the line is incomplete
    await delay(60);
    client.writeRaw(payload.slice(mid) + '\n');
    const res = await withTimeout(pending, 2000, 'framed response');
    assert.match(res.result.content[0].text, /Foundry token report/);
  });

  // --- JSON-RPC 2.0 conformance regressions (these bugs were fixed — must never come back). ---
  // The stdin loop in server.mjs now answers -32700 Parse error for unparseable input and
  // -32600 Invalid Request for valid JSON that is not a Request object. It used to destructure
  // a bare number or string into id undefined, treat it as a notification, and reply nothing.
  test(
    'regression: a syntactically valid JSON `null` line answers Invalid Request (-32600), not Parse error (-32700)',
    async () => {
      const pending = client.expect(null);
      client.writeRaw('null\n');
      const res = await withTimeout(pending, 1000, 'response to literal null');
      assert.equal(res.error.code, -32600, 'a value that parsed fine but is not a Request object is Invalid Request, not a parse failure');
    },
  );

  test(
    'regression: a syntactically valid JSON `42` line gets an Invalid Request (-32600) response, not silence',
    async () => {
      const strayCountBefore = client.stray.length;
      client.writeRaw('42\n');
      await client.ping(); // proves the server is alive and processed the line one way or another
      assert.equal(client.stray.length, strayCountBefore + 1, 'expected a -32600 Invalid Request response');
      const [reply] = client.stray.slice(-1);
      assert.equal(reply?.error?.code, -32600);
    },
  );

  test(
    'regression: a syntactically valid JSON string line gets an Invalid Request (-32600) response, not silence',
    async () => {
      const strayCountBefore = client.stray.length;
      client.writeRaw('"just a string"\n');
      await client.ping();
      assert.equal(client.stray.length, strayCountBefore + 1, 'expected a -32600 Invalid Request response');
      const [reply] = client.stray.slice(-1);
      assert.equal(reply?.error?.code, -32600);
    },
  );
});

/* ------------------------------------------------------------ security regressions */

describe('security regressions (these bugs were just fixed — must never come back)', () => {
  let root;
  let client;

  before(() => {
    root = tmpRoot('security');
    client = new McpClient(root);
  });
  after(() => client.close(root));

  test('runbook_get refuses a slug that attempts to walk out of .foundry/runbooks', async () => {
    // Plant a canary outside the project so a leak is unmistakable, not merely "file not found".
    const canary = path.join(os.tmpdir(), 'foundry-mcp-canary-outside-project.txt');
    fs.writeFileSync(canary, 'SECRET-OUTSIDE-PROJECT');
    try {
      const res = await client.callTool('runbook_get', { slug: '../../../..' });
      assert.equal(res.result.isError, true);
      assert.doesNotMatch(res.result.content[0].text, /SECRET-OUTSIDE-PROJECT/);
      assert.doesNotMatch(res.result.content[0].text, /root:/, 'must never echo something like /etc/passwd');
    } finally {
      fs.rmSync(canary, { force: true });
    }
  });

  test('resources/read refuses a runbooks URI that attempts to walk out of the project', async () => {
    const res = await client.request('resources/read', { uri: 'foundry://runbooks/../../..' });
    assert.ok(res.error, 'a traversal attempt must not resolve to a resource read');
    assert.doesNotMatch(JSON.stringify(res), /root:/, 'must never echo something like /etc/passwd');
  });

  test('contract_validate refuses an absolute `path` outside the project', async () => {
    const res = await client.callTool('contract_validate', { schema: 'risk.v1', path: '/etc/hostname' });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /must stay inside the project/);
  });

  test('contract_validate does not echo file content when the target is not valid JSON', async () => {
    const badFile = path.join(root, 'not-json.txt');
    fs.writeFileSync(badFile, 'SENTINEL-FILE-CONTENT-THAT-MUST-NOT-LEAK { not json');
    const res = await client.callTool('contract_validate', { schema: 'risk.v1', path: 'not-json.txt' });
    assert.equal(res.result.isError, true);
    assert.doesNotMatch(res.result.content[0].text, /SENTINEL-FILE-CONTENT-THAT-MUST-NOT-LEAK/, 'the parse error must never embed a slice of the file');
  });

  test('contract_validate rejects a `schema` id containing "../" as an unknown contract', async () => {
    const res = await client.callTool('contract_validate', { schema: '../../../etc/passwd.v1', data: {} });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /Unknown contract/);
  });

  test('blackboard_write rejects a `schema` id containing "../" as an unknown contract', async () => {
    const res = await client.callTool('blackboard_write', {
      wave: 'analysis', agent: 'tester', schema: '../../../etc/passwd.v1', data: {},
    });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /Unknown contract/);
  });

  test('blackboard_write with wave: ".." never writes outside .foundry/blackboard/', async () => {
    const res = await client.callTool('blackboard_write', {
      wave: '..', agent: 'tester', schema: 'risk.v1', data: RISK_ARTIFACT,
    });
    assert.equal(res.result.isError, undefined, 'a legitimate schema/data pair with a hostile wave must still validate');

    const bb = paths(root).blackboard;
    // ".." sanitizes to "_" (see server.mjs sanitize()) and must land inside the blackboard dir.
    const safeFile = path.join(bb, '_', 'tester.json');
    assert.ok(fs.existsSync(safeFile), `expected the artifact at ${safeFile}`);

    // Nothing must exist one level above the project root as a result of this call.
    const escaped = path.join(root, '..', 'tester.json');
    assert.equal(fs.existsSync(escaped), false);
  });
});

/* -------------------------------------------------------------- functional round trips */

describe('functional non-regression', () => {
  let root;
  let client;

  before(() => {
    root = tmpRoot('functional');
    writeRunbook(root, 'incident-response', { title: 'Incident response', trigger: 'prod is down' });
    client = new McpClient(root);
  });
  after(() => client.close(root));

  test('runbook_list lists a runbook that exists on disk', async () => {
    const res = await client.callTool('runbook_list', {});
    assert.match(res.result.content[0].text, /incident-response/);
    assert.match(res.result.content[0].text, /Incident response/);
  });

  test('runbook_get returns the full text of a real runbook', async () => {
    const res = await client.callTool('runbook_get', { slug: 'incident-response' });
    assert.equal(res.result.isError, undefined);
    assert.match(res.result.content[0].text, /Body of the incident-response runbook\./);
  });

  test('contract_validate accepts a valid artifact', async () => {
    const res = await client.callTool('contract_validate', {
      schema: 'risk.v1',
      data: { schema: 'risk.v1', producedBy: 'test-agent', ...RISK_ARTIFACT },
    });
    assert.match(res.result.content[0].text, /^VALID against risk\.v1\.$/);
  });

  test('contract_validate reports violations for an invalid artifact', async () => {
    const res = await client.callTool('contract_validate', {
      schema: 'risk.v1',
      data: { schema: 'risk.v1', producedBy: 'test-agent', title: 'Missing almost everything' },
    });
    assert.equal(res.result.isError, undefined, 'INVALID is a successful tool call, not a protocol error');
    assert.match(res.result.content[0].text, /^INVALID against risk\.v1:/);
    assert.match(res.result.content[0].text, /missing required property "category"/);
  });

  test('blackboard_write then blackboard_read round-trips the same artifact', async () => {
    const write = await client.callTool('blackboard_write', {
      wave: 'triage', agent: 'risk-scout', schema: 'risk.v1', data: RISK_ARTIFACT,
    });
    assert.equal(write.result.isError, undefined);
    assert.match(write.result.content[0].text, /triage.*risk-scout\.json/s);

    const summary = await client.callTool('blackboard_read', { wave: 'triage' });
    assert.match(summary.result.content[0].text, /risk-scout\.json/);
    assert.match(summary.result.content[0].text, /Vendor API rate limits threaten deploy cadence/);

    const full = await client.callTool('blackboard_read', { wave: 'triage', agent: 'risk-scout', full: true });
    const parsed = JSON.parse(/```json\n([\s\S]*)```/.exec(full.result.content[0].text)[1]);
    assert.equal(parsed.schema, 'risk.v1');
    assert.equal(parsed.producedBy, 'risk-scout');
    assert.equal(parsed.id, 'RISK-1');
  });

  test('memory_write, memory_search and memory_index work together end to end', async () => {
    const write = await client.callTool('memory_write', {
      title: 'Foundry MCP tests run against the real server process',
      body: 'mcp.test.mjs spawns mcp/server.mjs and speaks JSON-RPC over stdio rather than importing internals.',
      type: 'convention',
      tags: ['testing', 'mcp'],
    });
    assert.match(write.result.content[0].text, /^created: fact-\d{4}/);

    const search = await client.callTool('memory_search', { query: 'MCP tests real server process' });
    assert.match(search.result.content[0].text, /Foundry MCP tests run against the real server process/);

    const search2 = await client.callTool('memory_search', { type: 'decision', query: 'MCP tests real server process' });
    assert.match(search2.result.content[0].text, /No stored fact matches/, 'a type filter that excludes the fact must not return it');

    const index = await client.callTool('memory_index', {});
    assert.match(index.result.content[0].text, /facts listed/);
  });

  test('token_report summarizes memory, blackboard and event accounting', async () => {
    const res = await client.callTool('token_report', {});
    assert.match(res.result.content[0].text, /# Foundry token report/);
    assert.match(res.result.content[0].text, /Memory index:/);
    assert.match(res.result.content[0].text, /Blackboard artifacts:/);
  });

  test('resources/read serves the memory index and the contracts list', async () => {
    const idx = await client.request('resources/read', { uri: 'foundry://memory/index' });
    assert.match(idx.result.contents[0].text, /Foundry memory index/);

    const contracts = await client.request('resources/read', { uri: 'foundry://contracts' });
    assert.match(contracts.result.contents[0].text, /risk\.v1/);
  });
});

/* --------------------------------------------------------- hostile / missing arguments */

describe('hostile input never crashes the server', () => {
  let root;
  let client;

  before(() => {
    root = tmpRoot('hostile');
    client = new McpClient(root);
  });
  after(() => client.close(root));

  test('tools/call with no `arguments` at all is handled, and the server answers the next request', async () => {
    const res = await client.callTool('memory_search', undefined);
    assert.equal(res.error, undefined, 'must not blow up the JSON-RPC layer');
    await client.ping();
  });

  test('memory_write with all required fields missing reports a validation error, not a crash', async () => {
    const res = await client.request('tools/call', { name: 'memory_write', arguments: {} });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /Invalid arguments for memory_write/);
    await client.ping();
  });

  test('contract_validate with `type` outside its enum reports violations, not a crash', async () => {
    const res = await client.callTool('contract_validate', {
      schema: 'risk.v1',
      data: { category: 'not-a-real-category' },
    });
    assert.equal(res.result.isError, undefined);
    assert.match(res.result.content[0].text, /INVALID against risk\.v1/);
    await client.ping();
  });

  test('memory_search with an enormous `limit` does not crash and still answers', async () => {
    const res = await client.callTool('memory_search', { query: 'anything', limit: 999999999999 });
    assert.equal(res.error, undefined);
    assert.ok(Array.isArray(res.result.content));
    await client.ping();
  });

  test('blackboard_read with the required `wave` missing reports "no artifacts", not a crash', async () => {
    const res = await client.request('tools/call', { name: 'blackboard_read', arguments: {} });
    assert.equal(res.result.isError, true);
    await client.ping();
  });

  test('tools/call with no `name` at all is an unknown tool, not a crash', async () => {
    const res = await client.request('tools/call', { arguments: {} });
    assert.equal(res.error.code, -32601);
    await client.ping();
  });

  test('tools/call with `arguments` sent as a non-object array does not crash the process', async () => {
    const res = await client.request('tools/call', { name: 'memory_search', arguments: ['not', 'an', 'object'] });
    // Whatever it decides to answer, the process must still be alive to answer it.
    assert.ok(res, 'expected some JSON-RPC response, not a dropped connection');
    await client.ping();
  });
});

/* --------------------------------------------------------------- tool name resolution */

describe('tool resolution does not walk the prototype chain', () => {
  let root;
  let client;

  before(() => {
    root = tmpRoot('protochain');
    client = new McpClient(root);
  });
  after(() => client.close(root));

  test(
    'tools/call name:"constructor" is an unknown tool, not Object() off the prototype chain',
    async () => {
      const res = await client.callTool('constructor', {});
      assert.equal(res.error?.code, -32601, 'must be treated as an unknown tool');
    },
  );

  test('tools/call name:"__proto__" does not resolve to a callable handler and does not crash the server', async () => {
    const res = await client.callTool('__proto__', {});
    // Current behaviour: handlers.__proto__ is Object.prototype (truthy, not a function), so the
    // `if (!handler)` guard is fooled the same way as "constructor", but calling it throws and is
    // caught, producing an isError result rather than a silent {} success or a process crash.
    assert.ok(res.result?.isError || res.error, 'must not silently succeed with an empty result');
    await client.ping();
  });

  test(
    'BUG: tools/call name:"__proto__" should be reported as an unknown tool, not a caught TypeError',
    async () => {
      const res = await client.callTool('__proto__', {});
      assert.equal(res.error?.code, -32601, 'must be treated as an unknown tool, not a thrown-and-caught error');
    },
  );
});
