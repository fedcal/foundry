# Block Kit patterns

Four message shapes. Every one leads with what happened and what is needed, and links artifacts
rather than pasting them.

## Alert

```json
{
  "blocks": [
    { "type": "section", "text": { "type": "mrkdwn",
      "text": "*Checkout p95 above budget* — 1.9s against a 1.2s budget, breaching 12m.\n*Needed:* on-call decides rollback of build 4471." } },
    { "type": "context", "elements": [ { "type": "mrkdwn",
      "text": "`checkout` · prod · <https://example.invalid/runbook/checkout-latency|runbook> · <https://example.invalid/dash/checkout|dashboard>" } ] }
  ]
}
```

The ask is in the first block, after the fact and before the metadata. An alert with no `Needed:`
line is a dashboard entry that chose the wrong medium.

## Deploy record

One line. It is a log, not an announcement.

```json
{
  "blocks": [
    { "type": "context", "elements": [ { "type": "mrkdwn",
      "text": ":rocket: `checkout` *4471* → prod · <https://example.invalid/c/9f2a1|9f2a1> · 3 changes · <https://example.invalid/run/8812|pipeline>" } ] }
  ]
}
```

Using `context` rather than `section` is deliberate: it renders smaller, which is the correct
visual weight for something posted twenty times a day.

## Incident opener, to be pinned

```json
{
  "blocks": [
    { "type": "section", "text": { "type": "mrkdwn",
      "text": "*INC-20260903-checkout-5xx*\n*Impact:* card payments failing for roughly 8% of sessions.\n*Commander:* @<user_id>\n*Status:* investigating" } },
    { "type": "context", "elements": [ { "type": "mrkdwn",
      "text": "opened 14:22 UTC · updates in thread · <https://example.invalid/runbook/checkout-5xx|runbook>" } ] }
  ]
}
```

Update this message with `chat.update` and keep it pinned. Do **not** post a new status message
each time — a stream of status posts is what makes an incident channel unreadable exactly when it
must be readable.

## Digest

Batching is the main lever against alert fatigue: one message replacing forty.

```json
{
  "blocks": [
    { "type": "section", "text": { "type": "mrkdwn",
      "text": "*Overnight batch* — 3 failures, 41 succeeded." } },
    { "type": "section", "fields": [
      { "type": "mrkdwn", "text": "*reconcile-eu*\nexit 3 · <https://example.invalid/log/1|log>" },
      { "type": "mrkdwn", "text": "*reconcile-us*\ntimeout · <https://example.invalid/log/2|log>" }
    ] },
    { "type": "context", "elements": [ { "type": "mrkdwn", "text": "no action needed for the 41 successes" } ] }
  ]
}
```

`fields` renders two columns and is the compact way to list several items without a wall of
bullets. Cap it: past roughly ten entries, link a report instead.

## Rules

- **`text` is still required** alongside `blocks`. It is what appears in notifications and on
  devices that cannot render blocks. Omitting it produces a silent, contentless notification.
- **Escape `&`, `<`, `>`** in any interpolated value. A branch name containing `<` breaks the
  message.
- **Links are `<url|label>`**, not markdown. Slack mrkdwn is not markdown, and `[label](url)`
  renders literally.
- **Mention users by id** (`<@U123ABC>`), never by display name — display names change.
- **`actions` only for buttons that do something.** A button that opens a URL is a link, and a
  link costs nothing.
- **Never paste a log, diff, stack trace or report body.** Link it. A 400-line paste makes the
  channel unusable for everyone who scrolls past it afterwards.

## Threading

Reply in the thread of the originating message for every update on the same event, using its `ts`
as `thread_ts`. Set `reply_broadcast` only when the update genuinely changes what the channel
needs to know — a resolution, or an escalation.

## Verifying a send

Slack returns HTTP 200 on failure. Parse the body: `ok: true` plus a `ts` means it posted;
`ok: false` carries an `error` string to report verbatim. Store the `ts` — every later update or
threaded reply needs it.
