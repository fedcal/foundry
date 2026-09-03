#!/usr/bin/env node
/**
 * UserPromptSubmit — targeted retrieval. Pulls only the facts that match what the
 * user just asked, and flags a runbook when the prompt matches its trigger.
 * Budget: 30s timeout, so this stays keyword-based and offline.
 */
import { readHookInput, projectRoot, searchFacts, listRunbooks, config, addContext, noOpinion } from '../lib/foundry.mjs';

const input = await readHookInput();
// UserPromptSubmit delivers the text as `prompt`; `user_prompt` was never populated,
// which silently disabled prompt-level recall entirely.
const prompt = String(input.prompt ?? input.user_prompt ?? '');
if (prompt.length < 12) noOpinion();

const root = projectRoot(input.cwd);
const cfg = config(root);
const facts = searchFacts(root, prompt, { limit: Math.min(5, cfg.memoryRetrieval.maxFacts), minScore: 3 });

const words = prompt.toLowerCase();
const books = listRunbooks(root).filter((b) => {
  const trigger = String(b.trigger || '').toLowerCase();
  if (!trigger) return false;
  return trigger.split(/[,;]/).some((t) => t.trim().length > 3 && words.includes(t.trim()));
});

if (!facts.length && !books.length) noOpinion();

const out = [];
if (facts.length) {
  out.push('## Relevant project memory');
  out.push(...facts.map((f) => `- **${f.id}** (${f.type}, ${f.confidence}): ${f.title}\n  ${f.body.replace(/\n+/g, ' ').slice(0, 300)}`));
  out.push('These are recorded project facts. If the request contradicts one, say so before acting.');
}
if (books.length) {
  out.push('', '## Runbook applies');
  out.push(...books.map((b) => `- \`${b.slug}\` — ${b.title}. Follow it; do not improvise an alternative path.`));
}
addContext('UserPromptSubmit', out.join('\n'));
