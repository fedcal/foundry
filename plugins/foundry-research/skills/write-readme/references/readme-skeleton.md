# README skeleton

Fill in, then delete every bracket. Anything you cannot fill in is a finding about the project,
not a gap to paper over with adjectives.

---

```markdown
# <Name>

<Name> is a <category the reader already knows> that <does what> for <whom>.

[at most 4 badges, on one line: build status, licence, package version]

**For:** <who benefits, concretely>
**Not for:** <who should not use this> — use <named real alternative> instead.

## Non-goals

- <thing it deliberately does not do>, because <one clause>.
- <thing it deliberately does not do>, because <one clause>.

## Install

​```bash
<one command>
​```

Requires <runtime> <minimum version, verified from <file>>.
Verified on <platforms actually tested>.

## First success

​```bash
<one command producing a visible, correct result>
​```

​```
<the actual output, pasted from a real run>
​```

<One sentence: what just happened and what it generalises to.>

Measured at <N> s on <clean container image>, excluding install.

## Where to go next

- **Learn the model** — <link> (20-minute tutorial)
- **Do <common task>** — <link>
- **Look something up** — <link to generated reference>
- **Understand why it works this way** — <link>
- **Contribute** — CONTRIBUTING.md

## Status and support

- Maturity: <experimental | beta | stable | maintenance-only>, as of <YYYY-MM>.
- Supported versions: <policy>. Security reports: SECURITY.md.
- Licence: <SPDX-Identifier> — see LICENSE.
- Questions: <where>. Realistic response: <what>.
```

---

## Budgets

| Section | Hard budget | Failure if exceeded |
|---|---|---|
| One sentence | 25 words | the reader cannot categorise the project |
| For / Not for | 4 bullets total | scope becomes unreadable |
| Non-goals | 5 bullets | it is turning into an explanation page |
| Install | 1 command block + 2 lines | alternatives belong behind a link |
| First success | 1 command + its real output + 2 lines | it is turning into a tutorial |
| Where to go next | 8 links | link lists stop being read past ~8 |
| Whole file | ~120 lines | move content into the docs site |

## The clean-machine test

The only test that matters. Run it, and record the numbers in the pull request, not in the
README.

```bash
# adjust the image to the project's declared runtime
docker run --rm -it -v "$PWD:/src:ro" <runtime-image> bash -lc '
  set -euo pipefail
  cd /tmp
  time <install command>
  time <first success command>
'
```

Record: exit code, install seconds, first-success seconds, and a character-for-character
comparison of the pasted output against the real output. Then repeat once on a second platform
if the project claims to support one.

If any step required knowledge that is not in the README, that knowledge is the defect. Add it,
or remove the claim of support for that platform.

## Section-order rationale

The order exists because of how a stranger reads, and each swap has a known cost:

| Common reordering | What it costs |
|---|---|
| Architecture diagram before install | evaluators leave before finding out whether it runs |
| Badges before the one sentence | the first screen carries no information |
| Full option table instead of first success | nobody gets a working result; issues become "how do I start" |
| Contributing before usage | the project appears to be recruiting rather than offering something |
| Sponsorship before install | reads as a request before a gift |
| Acknowledgements before usage | credits are navigation noise for a first-time reader |

## Things worth adding only if true

- A one-line comparison to the obvious alternative, stated fairly and dated.
- A single screenshot or terminal recording, with alt text describing what it shows — not what
  it looks like (WCAG 2.2 SC 1.1.1).
- A "known limitations" list. It converts future issues into expectations, and it is the second
  most trust-building section after "Not for".
- The project's release cadence, if there is one. It answers "is this alive" better than any
  badge.

## Things never to add

- Fabricated output, invented version numbers, or a flag you did not read from the source.
- "Coming soon" for anything.
- Comparison tables where every competing row is worse. Nobody believes them, and they date
  badly the moment a competitor ships.
- Benchmark numbers without the methodology, the hardware and the date.
- A table of contents in a file this short.
- Decorative emoji in headings — they degrade screen-reader output and pollute search anchors.
