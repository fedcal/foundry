#!/usr/bin/env node
/**
 * PreToolUse(Write|Edit|NotebookEdit) — two gates:
 *  1. hard deny on credentials being written into tracked files;
 *  2. escalate to the user on protected paths (CI workflows, lockfiles, applied migrations).
 */
import path from 'node:path';
import { readHookInput, projectRoot, config, activeOverride, decide, noOpinion, recordMetric, foundryInitialised } from '../lib/foundry.mjs';

const SECRETS = [
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id' },
  // A raw AWS secret has no prefix, so it is only recognisable beside its key name.
  { id: 'aws-secret-key', re: /\baws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9/+=]{40,}/i, label: 'AWS secret access key' },
  // `github_pat_…` is the fine-grained personal access token, which `gh[pousr]_` never matched.
  { id: 'github-token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/, label: 'GitHub token' },
  { id: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, label: 'Anthropic API key' },
  // The `{32,}` alphanumeric run is the legacy format. Every OpenAI key issued since 2024 is
  // `sk-proj-…`, whose second hyphen the alphanumeric class can never cross — so the gate that
  // names OpenAI missed OpenAI. The prefixes stay explicit: `sk-[A-Za-z0-9_-]{32,}` would also
  // match any long kebab-case identifier beginning with `sk-`, and this gate has no override.
  { id: 'openai-key', re: /\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})\b/, label: 'OpenAI-style API key' },
  { id: 'stripe-key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/, label: 'Stripe secret key' },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token' },
  { id: 'private-key', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, label: 'private key block' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, label: 'JWT' },
  { id: 'connection-string', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^\s:@/]+:[^\s:@/]+@/, label: 'database URL with inline password' },
];

// Values published by vendors specifically for documentation. Blocking these would stop
// anyone documenting the secret gate itself — including this project's own quickstart.
const DOCUMENTED_EXAMPLES = [
  'AKIAIOSFODNN7EXAMPLE',                      // AWS documentation example access key id
  'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',  // AWS documentation example secret key
  'AKIAI44QH8DHBEXAMPLE',                      // AWS documentation example access key id
];

const input = await readHookInput();
const file = String(input.tool_input?.file_path || input.tool_input?.notebook_path || '');
// NotebookEdit delivers the text as new_source; without it the notebook path was
// matched by the hook but never actually scanned.
const content = String(
  input.tool_input?.content ?? input.tool_input?.new_string ?? input.tool_input?.new_source ?? '',
);
if (!file) noOpinion();

const root = projectRoot(input.cwd);
if (!foundryInitialised(root)) noOpinion();
const cfg = config(root);
if (cfg.enforcement === 'off') noOpinion();
const rel = path.relative(root, path.resolve(root, file)).replace(/\\/g, '/');

if (cfg.secretScan && content && !/\.(example|sample|template)$/.test(rel) && !/^plugins\/foundry-core\/hooks\//.test(rel)) {
  for (const s of SECRETS) {
    // Every match, not just the first: a file that opens with the documented AWS example and
    // carries a live key further down used to be waved through on the strength of the example.
    // `includes` rather than equality, because a pattern anchored on its key name
    // (aws_secret_access_key = …) matches more than the credential itself.
    const matches = [...content.matchAll(new RegExp(s.re.source, `${s.re.flags.replace('g', '')}g`))];
    if (!matches.some((m) => !DOCUMENTED_EXAMPLES.some((example) => m[0].includes(example)))) continue;
    recordMetric(root, { kind: 'gate_blocked', gate: `secret:${s.id}`, file: rel });
    decide('PreToolUse', 'deny',
      `Foundry blocked this write: it contains what looks like a ${s.label}.\n` +
      `Move the value to an environment variable or a secret manager and reference it by name.\n` +
      `If this is a placeholder, make it obviously fake (e.g. "REDACTED") or use a .example file.`);
  }
}

const protectedGlobs = cfg.protectedPaths || [];
const hit = protectedGlobs.find((g) => globMatch(g, rel));
if (hit && !activeOverride(root, 'protected-path')) {
  recordMetric(root, { kind: 'gate_escalated', gate: 'protected-path', file: rel });
  decide('PreToolUse', 'ask',
    `\`${rel}\` matches the protected pattern \`${hit}\`.\nChanges here affect CI, dependency integrity or applied migrations. Confirm this is intended.`);
}
noOpinion();

function globMatch(glob, target) {
  const re = new RegExp('^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]') + '$');
  return re.test(target);
}
