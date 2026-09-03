#!/usr/bin/env node
/**
 * PostToolUse(Write|Edit) — validate blackboard artifacts against their contract.
 * A non-conforming handoff is reported straight back to the agent, which then
 * corrects itself without human intervention. This is what keeps nine verticals
 * interoperable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHookInput, projectRoot, validate, loadSchema, emit, noOpinion, recordMetric } from '../lib/foundry.mjs';

const SCHEMA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
const input = await readHookInput();
const rawFile = String(input.tool_input?.file_path || '');
if (!rawFile) noOpinion();

const root = projectRoot(input.cwd);
// A relative file_path never matched the substring check, so the same artifact was
// validated when written with an absolute path and waved through otherwise.
const file = path.resolve(root, rawFile);
const rel = path.relative(root, file).split(path.sep).join('/');
if (!rel.startsWith('.foundry/blackboard/')) noOpinion();
if (!file.endsWith('.json')) noOpinion();
let payload;
try {
  payload = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
    `Foundry: ${path.basename(file)} is not valid JSON (${err.message}). Blackboard artifacts must be parseable JSON — rewrite it.` } });
}

if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
    `Foundry: ${path.basename(file)} must contain a JSON object declaring its contract, not ${Array.isArray(payload) ? 'an array' : String(payload)}.` } });
}

if (!payload.schema) {
  emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
    'Foundry: this blackboard artifact has no `schema` field. Every artifact must declare its contract id (e.g. "finding.v1") and `producedBy`.' } });
}

const loaded = loadSchema(payload.schema, SCHEMA_DIR);
if (!loaded) {
  const available = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.schema.json')).map((f) => f.replace('.schema.json', ''));
  emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
    `Foundry: unknown contract "${payload.schema}". Available contracts: ${available.join(', ')}.` } });
}

const errors = validate(loaded.schema, payload, { schemaDir: loaded.dir });
if (errors.length) {
  recordMetric(root, { kind: 'contract_violation', schema: payload.schema, count: errors.length });
  emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
    `Foundry: ${path.basename(file)} violates ${payload.schema}. Fix it before continuing:\n${errors.map((e) => `- ${e}`).join('\n')}` } });
}
recordMetric(root, { kind: 'contract_valid', schema: payload.schema });
noOpinion();
