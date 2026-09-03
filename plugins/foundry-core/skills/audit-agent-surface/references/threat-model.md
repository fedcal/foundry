# What an attacker gains from each part of the surface

The agent's configuration is not settings; it is code that runs on events the user does not
choose. This is what each part is worth to somebody who can influence it.

## Hooks

**Gain: arbitrary code execution, on a schedule the user does not control.**

`SessionStart` and `UserPromptSubmit` fire without any tool call, so a hook runs in a session where
the user typed one word and approved nothing. A hook is therefore the cheapest persistence
mechanism on the machine: write the file once, execute on every session thereafter.

The writability of the script matters more than its content. A hook script in a directory that
another process can write is a standing invitation — the file passes review today and is replaced
tomorrow, with no event anybody watches.

Shell-form hooks compound this: a command assembled as a string composes with whatever it
interpolates, and nobody re-reads it after the day it was written.

## Permission rules

**Gain: removal of the only step where a human sees what is about to happen.**

`bypassPermissions` does not weaken a boundary, it removes the prompt. Everything downstream then
depends on rules nobody re-reads.

Broad allow entries are the quieter version. `Bash(node:*)` reads as "allow the project's Node
scripts" and actually permits `node -e '<anything>'` — a shell under a different name. Prefix
matching cannot express intent, only string shape, and the gap between the two is where the
permissive reading always wins.

The project layer is the highest-value target: a rule committed to `.claude/settings.json` applies
to everyone who clones the repository, and it arrives through a pull request that reviewers read
as configuration rather than as code.

## MCP servers

**Gain: a participant inside the model's context, and often a credential.**

An MCP server is not a library the agent calls. Its tool names, descriptions and responses become
text the model reads, which means a hostile server can place instructions where the model will
treat them as content. That is prompt injection with a supply-chain delivery mechanism.

The dangerous combination is capability pairing: a server that can read private data **and** a
component that can reach the network. Either alone is ordinary. Together they are an exfiltration
path, and the two halves are usually configured by different people at different times.

Credentials are the second prize. A token in `.mcp.json` is a secret in version control; a token
in the environment is readable by every hook and every server the session starts.

## Plugins and marketplaces

**Gain: all of the above at once, through one approval.**

A plugin ships agents, skills, hooks and MCP servers together. The user evaluates "should I
install this plugin", which is a single decision, and receives a bundle whose parts would each
have deserved their own.

A marketplace referenced by a moving branch supplies whatever that branch holds at install time.
Pinning is the difference between reviewing an artifact and trusting a maintainer indefinitely.

## Skills and agents

**Gain: a guardrail that was never a guardrail.**

`allowed-tools` pre-approves; it does not restrict. A skill that omits `Bash` from `allowed-tools`
can still run `Bash`. Only `disallowed-tools` denies. Every guardrail written as an omission is a
protection the author believes exists and the runtime never implemented — and it will be cited in
a review as evidence of safety.

## The asymmetry worth remembering

Every item here is configuration that reads as preference. It is reviewed with the attention given
to a theme setting and executes with the authority of the user who owns the session. That gap
between perceived and actual consequence is the whole reason this audit exists.
