# Slack scopes — asking for less

A bot token carries every scope granted to it, in every channel the app can reach. Scopes are
granted once and reviewed approximately never, so the moment to be strict is the request.

## The set that covers delivery notifications

| Scope | Grants | Needed for |
|---|---|---|
| `chat:write` | post as the app in channels it belongs to | every message |
| `chat:write.public` | post to public channels without joining | avoiding an invite per channel |
| `channels:read` | list public channels, resolve names to ids | name → id resolution |
| `groups:read` | the same for private channels the app is in | private channel targets |
| `reactions:write` | add reactions | acknowledging without posting |
| `files:write` | upload files | rare — prefer a link |
| `chat:write.customize` | override username and icon per message | almost never; it obscures who posted |

Start with `chat:write` and `channels:read`. Add only what a specific failing call proves is
missing — the `missing_scope` error names the scope required, so the ladder is empirical rather
than speculative.

## The high-consequence scope

`channels:history` reads every message in every channel the app can access, including things
people said assuming a small audience.

Request it only for a stated, time-boxed audit — the alert-fatigue measurement is the legitimate
case — and say when it will be removed. Do not request it because a future feature might want it.
An app holding history scope indefinitely is a standing read capability over the workspace's
conversations, and it will outlive everyone who remembers approving it.

## Bot token or user token

Prefer a **bot token** (`xoxb-`). It acts as the app, its permissions are explicit, and it
survives the person who installed it leaving.

A **user token** (`xoxp-`) acts as a human: it inherits everything that person can see, it posts
under their name, and it dies with their account. Use one only when the action genuinely must
appear to come from that person, and say so.

## Handling failures honestly

Slack returns HTTP 200 with `ok: false`. Report the `error` verbatim rather than paraphrasing.

| `error` | Meaning | Correct response |
|---|---|---|
| `missing_scope` | token lacks a scope; the response names it | list it, do not retry |
| `not_in_channel` | app is not a member | report and give the invite command — do not join silently |
| `channel_not_found` | wrong id, or a private channel the app cannot see | never guess another id |
| `is_archived` | channel archived | stop; archiving was a decision |
| `ratelimited` | too fast | honour `Retry-After` |
| `invalid_auth` / `account_inactive` | token revoked or app removed | stop; do not retry with a different token |

## Rate limits

Chat posting is roughly one message per second per channel, with short bursts tolerated. A loop
posting per item will be throttled and will have deserved it — batch into a digest instead.

Other method families sit in tiers with their own limits; `conversations.history` in particular is
slow, which is another reason the audit is time-boxed rather than continuous.

## Token handling

- From the environment (`SLACK_BOT_TOKEN`) only. Never from a file the user did not name.
- Never printed, never logged, never written into an artifact or a commit message.
- Never in a URL — Slack takes it as a header, and URLs end up in shell history and proxy logs.
- A token that appears anywhere it should not is rotated in the Slack app config, not deleted from
  the file. Deleting the file does not un-leak it.

## Reviewing later

Record which scopes were granted, when, and for what, in the repository next to the integration.
The question "why does this app have history access" needs an answer that is not "nobody
remembers".
