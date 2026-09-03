# Metrics: what each one actually measures

A metric is not "good" or "vain" in itself. It becomes vanity when it is reported without the
question it can answer, without the question it cannot, and without a decision that would change
if the number moved. Every entry below is written in that shape so it can be copied into the plan.

**The pairing rule.** Each metric in `docs/growth/audience-plan.md` names one decision it feeds.
If no decision changes at any value of the metric, delete the metric — collecting it costs time
that was budgeted for writing.

**The provenance rule.** Every reported number carries the tool that produced it, the date range,
and the date it was read: `1,240 [source: repo traffic API, 14d window, read 2026-08-28]`. A
number without those three is not reportable and never goes into outbound copy.

## Reach-shaped metrics

### Impressions / views / plays
- **Mechanically counts:** how many times a platform decided to render the item, by that
  platform's own definition, which differs per platform and changes without notice.
- **Answers:** did distribution happen at all? Did this item get distributed unusually more or
  less than my own median?
- **Cannot answer:** whether anyone read it, whether the right people saw it, whether it caused
  anything. It is not comparable across platforms and barely comparable across time on one.
- **Collect:** the platform's own analytics export. Record the platform's definition of the metric
  from its current documentation, with the date you read it — the definition is the metric.

### Unique visitors / sessions on your own site
- **Mechanically counts:** de-duplicated clients by whatever identifier your analytics uses,
  minus blocked clients, plus bots that were not filtered.
- **Answers:** relative traffic between pages and over time on one measurement setup.
- **Cannot answer:** absolute human count. Bot filtering, blockers and privacy proxies all move
  it, sometimes by a lot.
- **Collect:** server logs or a privacy-preserving analytics tool. Any analytics that sets
  identifiers or profiles visitors is a consent question → `foundry-legal:privacy-review`.

### Read-through / scroll depth / time on page
- **Mechanically counts:** client-side events fired while a tab was open.
- **Answers:** whether an opening is losing people — comparatively, between your own pieces.
- **Cannot answer:** comprehension, agreement, or value. A background tab reads as engagement.

## Attention-shaped metrics

### Referrer breakdown
- **Mechanically counts:** the `Referer` header your server received, where sent at all.
- **Answers:** which channel actually delivers people, which is the single most decision-relevant
  reach number you have — it tells you where the next hour of effort goes.
- **Cannot answer:** anything about traffic arriving with no referrer (direct, most apps, many
  privacy setups). Report the "unknown" bucket size next to the ranking or the ranking misleads.

### Replies, comments, and inbound messages
- **Mechanically counts:** humans who spent effort responding.
- **Answers:** whether the piece reached people with the problem — the highest-signal cheap metric
  available, especially the *content* of the replies.
- **Cannot answer:** scale. Ten replies can come from ten thousand readers or from thirty.
- **Collect:** read them and log recurring questions into the backlog as future pieces. This is
  the loop that makes the cadence self-feeding.

### Unsolicited references (someone linked, quoted, or reimplemented it)
- **Answers:** whether the work is useful to strangers — the strongest available evidence of it.
- **Cannot answer:** volume or growth rate; it is anecdote by construction. Count them anyway,
  with links, because they are also the only citable evidence for a usage claim later.
- **Collect:** search for the project name on a schedule; keep a dated file of links.

## Adoption-shaped metrics

### Repository stars
- **Mechanically counts:** accounts that pressed a button and have not withdrawn it. Read as a
  running total, it moves up on attention and effectively never moves down on abandonment.
- **Answers:** whether a piece reached people who bookmark things — a burst on the day is a
  distribution signal.
- **Cannot answer:** usage, retention, or value, and it is close to blind to decline. It must never
  be used as evidence of adoption in outbound copy.

### Clones, downloads, installs
- **Mechanically counts:** requests to a registry or host, CI runs and mirrors included.
- **Answers:** order of magnitude of automated plus human consumption, and its trend on one
  source.
- **Cannot answer:** number of users. Automated consumption — CI, mirrors, proxies, scanners — is
  included and can be the majority; only the registry's own current documentation says what it
  filters, so read that page and record the date.
- **Collect:** the host's own API (for GitHub, the repository traffic endpoints, which require push
  access and cover a rolling window the host documents — read the current documentation for the
  window, then export on a schedule or the history is gone). Registry counters differ per registry;
  record which one and the window.
- **Claim rule:** a download number may be published only with its source, window and the
  explicit caveat that it includes automation.

### New contributors, issues opened by strangers
- **Answers:** whether the project is reachable and comprehensible from outside.
- **Cannot answer:** audience size. Handled inside the repository by `foundry-oss` — this skill
  only counts the arrival, not the funnel that follows.

## Email-shaped metrics

### Subscriber count
- **Mechanically counts:** rows in a list you can export.
- **Answers:** how many people asked to hear from you again — the only reach number you own and
  can move between platforms.
- **Cannot answer:** attention. A list that never receives anything decays silently.
- **Never publish it as social proof** unless the export can be shown to whoever asks.

### Open rate
- **Mechanically counts:** whatever your sending provider counts as an open — conventionally the
  load of a tracking image, which is fetched by some clients and intermediaries without a human
  present and blocked outright by others. Read your provider's current documentation on what it
  counts and what it filters, record `source: <url>, checked: YYYY-MM-DD`, and quote that
  definition next to the number.
- **Answers:** very little, in both directions. Treat as a weak comparative signal at best.
- **Cannot answer:** whether anyone opened it. Do not gate any decision on it.

### Click rate on a link that only appears in the email
- **Answers:** whether the send caused an action — the usable email metric.
- **Cannot answer:** who, unless you are tracking individuals, which is a consent question →
  `foundry-legal:privacy-review`.

### Unsubscribes per send
- **Answers:** whether the send matched what people signed up for. A spike after a promotional
  send is the clearest honest feedback the channel produces.

## Search-shaped metrics

### Impressions and average position in a search console
- **Answers:** which queries the site is already eligible for, and therefore which pieces to write
  next — this is a topic-selection input, not a scoreboard.
- **Cannot answer:** competitor comparisons, ranking causes, or anything about engines you have
  not verified with. Requires site verification, and the data window is limited — export on a
  schedule.
- **Verification rule:** any statement about how a specific engine ranks or renders must be read
  from that engine's current documentation at the time of writing and stamped with the date. Do
  not carry ranking folklore into the plan.

### Vendor "authority" scores
- **Mechanically counts:** a vendor's model output.
- **Answers:** nothing verifiable. Excluded from the plan by default; if one is included, label it
  as a vendor estimate and name the vendor.

## The reporting template

```
metric | question it answers | question it cannot answer | source + window | read on | decision it feeds
```

Review cadence: read the table at the end of the horizon. Any metric whose "decision it feeds"
column never actually changed a decision is deleted in the next revision. The plan is allowed to
shrink; a metric table that only grows is a reporting habit, not a measurement.
