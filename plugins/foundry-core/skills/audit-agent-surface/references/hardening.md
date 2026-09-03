# Hardening, in order of effect

Ordered by risk removed per unit of friction added. Stop wherever the friction stops being worth
it for the machine in question — a disposable container and a laptop holding production
credentials do not deserve the same answer.

## 1. Decide the permission mode deliberately, per machine

`bypassPermissions` is a legitimate choice on a throwaway environment and a poor one on a machine
that can reach production. What makes it dangerous is not the setting, it is that it gets enabled
once to unblock an afternoon and then stays on for a year.

If it is on: write down where, why, and when it will be revisited. An undocumented permissive mode
is indistinguishable from an accident.

Scope it to a project rather than the user layer when possible — a smaller blast radius for the
same convenience.

## 2. Verify what the deny list actually denies

A deny list covering `.env`, key material and credential directories is worth having **only if it
is enforced under the active mode**. Test it rather than assuming: attempt one read that should be
denied and confirm the refusal.

A protection people believe they have is worse than a gap they know about, because it is budgeted
against.

## 3. Make hook scripts unwritable by anyone but their owner

```bash
find ~/.claude/hooks .claude/hooks -type f -perm -o+w 2>/dev/null
chmod go-w <each result>
```

This costs nothing and removes the cheapest persistence path on the machine.

## 4. Exec form for every hook

`command` + `args` instead of a shell string. It is inspectable, it does not interpolate, and it
behaves the same on Linux, macOS and Windows. Convert the shell-form ones the audit finds; there
are rarely many.

## 5. Narrow the broadest allow entries

Replace unbounded entries with the specific commands actually used. `Bash(node scripts/*)` instead
of `Bash(node:*)`; the named CLIs instead of `Bash(*)`.

Expect this to be iterative — allowlists tighten by running into prompts, not by prediction. That
is the correct process, not a failure of it.

## 6. Keep outward-facing actions in `ask`

`git push`, `gh release create`, `gh repo create`, `npm publish`, `docker push`,
`terraform apply`. These are the operations that leave the machine and cannot be undone from
inside it. Keeping them in `ask` costs one keystroke each and preserves the last review point
before something becomes public or permanent.

This matters most precisely when the mode is permissive: `ask` rules that survive the mode are the
remaining boundary.

## 7. Pin marketplaces and audit plugins as bundles

Pin to a commit or tag rather than a moving branch. When installing a plugin, look at what it
ships — hooks first, MCP servers second, agents and skills third — rather than evaluating the
plugin as a single yes/no.

## 8. Separate MCP servers that read private data from those that reach the network

Either capability alone is ordinary. Together they form an exfiltration path. Where both are
needed, know that you have accepted it, and prefer servers whose code you can read and whose
version you can pin.

Never store a token in `.mcp.json`. Use the environment, and keep the variable names — not the
values — in version control.

## 9. Write guardrails as `disallowed-tools`

`allowed-tools` pre-approves and denies nothing. Any restriction expressed as an omission from it
is decorative. This is a one-line fix per asset and removes a class of false confidence.

## 10. Re-run this audit on a trigger, not a calendar

After installing a plugin or MCP server, after any permission change, and before granting a
machine autonomous or unattended work. A quarterly review catches the drift; a triggered one
catches the change that caused it.
