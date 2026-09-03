#!/usr/bin/env node
/**
 * Stop — evidence before assertions.
 *
 * Blocks a turn that claims work is done, fixed or passing when no verification
 * command was run in it. Reads the transcript rather than trusting the claim.
 */
import fs from 'node:fs';
import { readHookInput, projectRoot, config, decide, noOpinion, recordMetric, foundryInitialised } from '../lib/foundry.mjs';

// `verified` on its own fired on truthful, hedged prose — "I verified the file exists, I have
// not run anything yet" was blocked — so it is anchored to an actual completion claim.
const CLAIM = /\b(all tests pass|tests are passing|everything works|it works now|fixed the (bug|issue)|build (is )?(green|passing)|verified (and (working|passing)|that (it|they|everything) (works|pass(es)?))|ready to (merge|ship|deploy)|fully working|done and tested)\b/i;
// Two independent alternatives. The old single form required a runner AND a later
// keyword, so every runner whose name already contains the keyword (pytest, go test,
// dotnet test, ng test, node --test) could never match — including the very command
// this repository's CLAUDE.md mandates. The bounded {0,200} replaces [^\n]* to keep
// backtracking linear on long transcript blobs.
const VERIFY = /\b(?:npm|pnpm|yarn|mvn|gradle|cargo|make)\b[^\n]{0,200}?\b(?:test|verify|check|build|lint|e2e|ci)\b|(?:^|[\s"'`])(?:pytest|go test|dotnet test|ng test|bun test|node --test|\.\/gradlew|\.\/mvnw|npx? (?:jest|vitest|playwright))\b/i;
// A command that only prints, reads or records the name of a runner has run nothing.
// `echo skipping npm test for now` and `git commit -m "npm test green"` satisfied the
// old check, which tested the runner pattern against the whole serialised tool input.
const MENTIONS_ONLY = /^\s*(?:sudo\s+)?(?:echo|printf|grep|rg|ag|cat|less|more|head|tail|sed|awk|ls|find|git\s+(?:commit|tag|grep|log|show|add|diff|status))\b/;

const input = await readHookInput();
// Set on a turn that is already a continuation forced by a previous Stop-hook block. The
// runtime asks hooks to short-circuit on it and overrides the hook after 8 consecutive
// blocks anyway; blocking twice only burns turns on a project whose runner this gate
// cannot recognise (bazel, tox, rspec, swift test).
if (input.stop_hook_active) noOpinion();

const claim = String(input.last_assistant_message || '');
if (!CLAIM.test(claim)) noOpinion();

const root = projectRoot(input.cwd);
if (!foundryInitialised(root)) noOpinion();
const cfg = config(root);
if (!cfg.verifyOnStop || cfg.enforcement === 'off') noOpinion();

let ranVerification = false;
try {
  // Walk backwards and stop at the user message that opened this turn: a verification
  // run 300 messages ago is not evidence about the claim being made now. Only a real
  // Bash tool_use counts — prose that merely mentions "npm test" is not a test run.
  const lines = fs.readFileSync(input.transcript_path, 'utf8').split('\n').slice(-400);
  // tool_result blocks follow their tool_use in the file, so walking backwards sees the
  // result first and can pair it by tool_use_id. The result is what turns a command into
  // evidence: the old check read only the input, so a run that failed still counted.
  const results = new Map();
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const role = entry.message?.role ?? entry.role;
    const content = entry.message?.content ?? entry.content ?? '';
    const blocks = Array.isArray(content) ? content : [];
    for (const c of blocks) {
      if (c?.type === 'tool_result' && c.tool_use_id) results.set(c.tool_use_id, c);
    }
    const isToolResult = blocks.some((c) => c?.type === 'tool_result');
    if (role === 'user' && !isToolResult) break;
    const ranBash = blocks.some((c) => {
      if (c?.type !== 'tool_use' || c?.name !== 'Bash') return false;
      const command = String(c.input?.command ?? '');
      if (!VERIFY.test(command) || MENTIONS_ONLY.test(command)) return false;
      // A failed run is not a passing build, and a call the user rejected at the permission
      // prompt never ran at all — both arrive as a tool_result with is_error:true. A silent
      // success (eslint, say) is legitimate evidence, so the result text is not inspected.
      return results.get(c.id)?.is_error !== true;
    });
    if (ranBash) { ranVerification = true; break; }
  }
} catch {
  noOpinion(); // no transcript to check: never block on missing evidence of evidence
}

if (ranVerification) noOpinion();

recordMetric(root, { kind: 'gate_blocked', gate: 'verify-before-claiming' });
decide('Stop', 'deny',
  'Foundry gate `verify-before-claiming`: this turn states the work is complete or passing, but no test, build or lint command completed successfully in it.\n' +
  'Run the project verification command and report its real output — including failures — or restate the claim as unverified.');
