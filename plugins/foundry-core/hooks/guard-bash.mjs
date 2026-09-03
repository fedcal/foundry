#!/usr/bin/env node
/**
 * PreToolUse(Bash) — block the small set of commands that destroy work or history.
 * Every block names the rule and the documented way out; nothing is a dead end.
 */
import { readHookInput, projectRoot, config, activeOverride, decide, noOpinion, recordMetric, foundryInitialised } from '../lib/foundry.mjs';

// bash executes `r\m -rf x` as `rm -rf x`, so the escapes come out before anything matches.
const unescape = (cmd) => cmd.replace(/\\(?=[A-Za-z])/g, '');

// A separator ends a command: options that follow one belong to the next command, not this one.
const segments = (cmd) => unescape(cmd).split(/\|\||&&|[;|&\n]/);

// Quoting and substitution punctuation is stripped per token, so `sh -c "rm -rf /"` and
// `echo $(rm -rf /)` are both still read as the delete they are.
const tokenise = (segment) =>
  segment.split(/\s+/).filter(Boolean).map((t) => t.replace(/^[$('"`]+|[)'"`]+$/g, '')).filter(Boolean);

const OPTION = /^-{1,2}[a-zA-Z][a-zA-Z-]*$/;
const isCommandWord = (token, name) => new RegExp(`^(?:[\\w./-]*/)?${name}$`).test(token);

/**
 * True when the option list carries any of `shorts` (in a cluster or alone) or `long`.
 * Compared per token rather than against the joined string, because `-[a-zA-Z]*[rR]`
 * over a joined list happily finds the `r` inside `--force`.
 */
const hasOption = (flags, shorts, long) =>
  flags.some((f) => (f.startsWith('--') ? f === long : [...shorts].some((s) => f.slice(1).includes(s))));

/**
 * The option tokens of every `rm` invocation, one array per invocation.
 * GNU rm accepts options after operands, so `rm ./build -rf` and `rm -r ./build -f` are the
 * same recursive forced delete as `rm -rf ./build`; collecting only the run that immediately
 * follows the command word let those spellings through.
 */
const rmFlagSets = (cmd) => {
  const sets = [];
  for (const segment of segments(cmd)) {
    const tokens = tokenise(segment);
    tokens.forEach((tok, i) => {
      if (!isCommandWord(tok, 'rm')) return;
      const flags = [];
      for (let j = i + 1; j < tokens.length; j += 1) {
        if (tokens[j] === '--') break;
        if (OPTION.test(tokens[j])) flags.push(tokens[j]);
      }
      sets.push(flags);
    });
  }
  return sets;
};

// Global options that consume the *next* token as their value, so the value is not mistaken
// for the subcommand: `git -C /path push --force` must still be read as a push.
const GIT_GLOBAL_TAKES_VALUE = /^(?:-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--config-env)$/;

/** Arguments of `git <name>`, skipping global options: `git -c user.name=x push …`. */
const gitSubcommand = (tokens, name) => {
  const g = tokens.findIndex((t) => isCommandWord(t, 'git'));
  if (g === -1) return null;
  let i = g + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (GIT_GLOBAL_TAKES_VALUE.test(t)) { i += 2; continue; }          // `-C /path`, `-c a.b=c`
    if (OPTION.test(t) || /^--?[\w-]+=/.test(t) || /^[\w.]+=/.test(t)) { i += 1; continue; }
    break;
  }
  return tokens[i] === name ? tokens.slice(i + 1) : null;
};

const forEachGitSubcommand = (cmd, name, fn) =>
  segments(cmd).some((segment) => {
    const args = gitSubcommand(tokenise(segment), name);
    return args ? fn(args, args.filter((a) => OPTION.test(a))) : false;
  });

// Reading or describing a destructive command is not running one: `grep -rn "rm -rf" .` and
// `git commit -m "drop table users"` are ordinary work, and denying them is what makes a user
// switch enforcement off. The exemption used to reach only the two text-scanning rules, so
// grepping your own codebase for `rm -rf` was denied by the delete rule.
// It applies only when *every* stage of the pipeline is one of these commands: one
// destructive stage (`grep -l x . | xargs rm -rf`) keeps every rule armed.
const QUOTED = /(['"])(?:\\.|(?!\1)[\s\S])*?\1/g;
const SINGLE_QUOTED = /'(?:\\.|[^'])*'/g;
const MENTIONS_ONLY = /^\s*(?:sudo\s+)?(?:grep|rg|ag|cat|less|more|head|tail|echo|printf|git\s+(?:grep|log|show|commit|tag)|gh\s+(?:issue|pr))\b/;
const isMentionOnly = (cmd) => {
  // Quoted text is masked first: the `|` in `grep "a|b" .` is data, not a pipe.
  const stages = segments(cmd.replace(QUOTED, '""')).filter((s) => s.trim());
  // Substitution is looked for with only SINGLE-quoted text masked out. `$(…)` and backticks
  // are literal inside `'…'` but bash still expands them inside `"…"`, so masking both quote
  // kinds here made `echo "$(rm -rf /)"` read as a bare echo and exempted it from every rule.
  const substitutable = cmd.replace(SINGLE_QUOTED, "''");
  return stages.length > 0 && stages.every((s) => MENTIONS_ONLY.test(s)) && !/\$\(|`/.test(substitutable);
};

const RULES = [
  {
    id: 'rm-recursive-force',
    test: (cmd) => rmFlagSets(cmd).some((flags) => hasOption(flags, 'rR', '--recursive') && hasOption(flags, 'f', '--force')),
    why: 'Recursive forced delete. Delete specific paths, or move them to a scratch directory first.',
  },
  {
    id: 'git-push-force',
    // `git push origin +main` is a forced update with or without a colon in the refspec.
    test: (cmd) => forEachGitSubcommand(cmd, 'push', (args, flags) =>
      hasOption(flags, 'f', '--force') || args.some((a) => a.length > 1 && a.startsWith('+'))),
    why: 'Force push rewrites shared history. Use --force-with-lease, and never on the default branch.',
  },
  {
    id: 'git-reset-hard-remote',
    // Only refs that discard *commits*. Bare `git reset --hard` and `git reset --hard HEAD`
    // throw away uncommitted work only and are deliberate, everyday cleanup.
    test: (cmd) => forEachGitSubcommand(cmd, 'reset', (args, flags) => {
      if (!flags.includes('--hard')) return false;
      const ref = args.find((a) => !OPTION.test(a));
      return Boolean(ref) && /^(?:origin|upstream)\/|^HEAD[~^]|^@\{u/.test(ref);
    }),
    why: 'Discards every local commit and working change down to that ref. Stash or branch first.',
  },
  {
    id: 'git-clean-force',
    // A dry run or an interactive run deletes nothing — and `git clean -n` is exactly what this
    // gate's own message tells the user to run first, so it must never be the thing that blocks.
    test: (cmd) => forEachGitSubcommand(cmd, 'clean', (args, flags) => {
      if (hasOption(flags, 'ni', '--dry-run') || flags.includes('--interactive')) return false;
      return hasOption(flags, 'dfxX', '--force');
    }),
    why: 'Deletes untracked and ignored files, including .env files. List them with `git clean -n` first.',
  },
  { id: 'db-drop', re: /\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+(?:TABLE\s+)?["'`[]?[A-Za-z_])/i, why: 'Destructive schema change. Route it through a reviewed migration.' },
  { id: 'chmod-777', re: /\bchmod\s+(-[a-zA-Z]+\s+)*0?777\b/, why: 'World-writable permissions. Grant the narrowest mode that works.' },
  { id: 'curl-pipe-shell', re: /\b(curl|wget)\b[^\n]*\|[^\n]*\b(sudo\s+)?(ba|z|k|da)?sh\b/, why: 'Executes unreviewed remote code. Download, read, then run.' },
  { id: 'history-rewrite', re: /\bgit\s+(filter-branch|filter-repo)\b|\bbfg\b/, why: 'Rewrites the whole repository history. Coordinate with every collaborator first.' },
];

const input = await readHookInput();
const command = String(input.tool_input?.command || '');
if (!command) noOpinion();

const root = projectRoot(input.cwd);
if (!foundryInitialised(root)) noOpinion();
const cfg = config(root);
if (cfg.enforcement === 'off') noOpinion();
if (isMentionOnly(command)) noOpinion();

const normalised = unescape(command);
for (const rule of RULES) {
  const hit = rule.test ? rule.test(command) : rule.re.test(normalised);
  if (!hit) continue;
  const override = activeOverride(root, rule.id);
  if (override) {
    recordMetric(root, { kind: 'gate_override_used', gate: rule.id, reason: override.reason });
    noOpinion();
  }
  recordMetric(root, { kind: 'gate_blocked', gate: rule.id, tool: 'Bash' });
  const reason =
    `Foundry gate \`${rule.id}\` blocked this command.\n${rule.why}\n\n` +
    `If it is genuinely required, add an override to \`.foundry/overrides.json\`:\n` +
    `{"overrides":[{"gate":"${rule.id}","reason":"<why>","expires":"<YYYY-MM-DD>"}]}`;
  if (cfg.enforcement === 'warn') decide('PreToolUse', 'ask', reason);
  decide('PreToolUse', 'deny', reason);
}
noOpinion();
