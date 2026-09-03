---
name: write-readme
description: Write or repair a README that actually works — one-sentence what, who it is for, honest non-goals, install, a 60-second first success, then links out. Use when a project has no README, a README that is a wall of badges and marketing, or one where a newcomer cannot get a working result. Includes an anti-pattern list and a measurable first-success gate. Not for full documentation sites and not for API reference.
allowed-tools: Read Grep Glob Bash Write Edit
user-invocable: true
argument-hint: "[path/to/README.md] [--audit]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: research
  foundry.io: "repository -> README.md + review.v1"
license: Apache-2.0
---

# Write a README that works

A README has one job: let a stranger decide in 30 seconds whether this is for them, and if it
is, get a working result in 60 seconds. Everything else is a link.

The test is behavioural, not aesthetic. **Run the README on a clean machine and time it.** A
README you have not executed is a hypothesis.

## When not to use this

- The project needs a documentation site → `docs-site`. A README is the front door, not the
  building.
- The task is reference documentation → `api-reference`.
- The project is a private internal service with no external readers. Write a runbook instead;
  a runbook answers "it is 3am and it is broken", which is the only question that will be asked.

## The order, and why it is fixed

Readers arrive with a question and leave the moment they cannot find it. The order below maps
to the sequence in which the questions occur, and reordering it costs readers.

| # | Section | Question answered | Budget |
|---|---|---|---|
| 1 | Name + one sentence | "what is this?" | 1 sentence, ≤ 25 words |
| 2 | Who it is for / not for | "is this for me?" | 2–4 bullets |
| 3 | Non-goals | "will it do the thing I actually need?" | 2–5 bullets |
| 4 | Install | "how do I get it?" | 1 command block |
| 5 | First success | "does it work?" | ≤ 60 seconds, real output |
| 6 | Where to go next | "how do I learn more?" | a short link list |
| 7 | Status, licence, support | "can I depend on this?" | a few lines |

Sections 1–5 must fit **above the fold on a laptop**, roughly the first screen. If they do not,
cut, do not reorganise.

### 1. One sentence

Formula: `<Name> is a <category> that <does what> for <whom>.`

- Category is a word the reader already knows: a CLI, a library, a plugin, a server. Do not
  invent a category ("a semantic orchestration surface") — the reader must place you in one
  breath.
- No adjectives. "Fast", "simple", "powerful" and "modern" carry no information and cost trust.
- If you cannot write this sentence, the problem is not the README.

### 2. Who it is for, and who it is not for

Two lists. The second one is the credible one, and it is the one that converts readers into
users, because it proves the first list was not written by marketing.

> **For:** teams running <thing> on <platform> who need <outcome>.
> **Not for:** anyone needing <adjacent thing> — use <named alternative> instead.

Naming a real alternative that is better for a different case is the single highest-trust
sentence in a README. Almost nobody writes it.

### 3. Non-goals

What this project has deliberately decided not to do, and briefly why. Non-goals prevent the
issue that begins "I assumed this handled…". They also make the scope reviewable: a project
whose maintainers cannot state a non-goal has not decided what it is.

### 4. Install

One block, one path — the one most readers will take. Alternatives (from source, container,
package manager B) go behind a link or a collapsed section.

Requirements:
- State prerequisites and their **minimum versions**, verified from the project's own build
  configuration, not from memory. If a version is unverified, do not write a number; write
  "see `<file>`" and cite the file.
- The command must be copy-pasteable and must work in a shell with no prior setup.
- Verified on at least the platforms the project claims to support. If only one platform was
  tested, say which, rather than implying all.

### 5. First success in 60 seconds

The most important block in the file, and the one most often missing.

- **One** example that produces a **visible, correct** result.
- Paste the **actual** output, obtained by running it. Not a plausible one, not a prettified one.
- No configuration files, no accounts, no API keys. If the tool genuinely cannot do anything
  useful without a key, the first success is "prove it is installed and reachable" — a version
  or health check with real output.
- Time it. Write the measured number, with what was measured:
  `Measured at 41 s on a clean container, excluding install.` An unmeasured claim of "60
  seconds" is exactly the kind of statement this vertical does not publish.
- End with one sentence saying what just happened, so the reader can generalise.

If a first success genuinely cannot happen in 60 seconds, say what it does take, honestly, and
show the shortest real path. Readers forgive a slow setup; they do not forgive a surprise.

### 6. Where to go next

Five to eight links, each labelled by the reader's task, not by document type:

```
- Get started tutorial      docs/tutorial/…      learn the model in 20 minutes
- Configure authentication  docs/how-to/…        a task recipe
- API reference             docs/reference/…     generated, always current
- Why it is designed this way  docs/explanation/… trade-offs and history
- Contributing              CONTRIBUTING.md      dev setup and review rules
```

The README does not contain reference material. Ever. It links to it.

### 7. Status, licence, support

- **Maturity**, stated plainly: experimental, beta, stable, maintenance-only. Undated silence
  reads as abandoned.
- **Supported versions** and the security-reporting route (`SECURITY.md`).
- **Licence**, as an SPDX identifier plus a link to `LICENSE`.
- **Support expectations**: where questions go, and what response is realistic. "Best effort,
  usually within a week" is far better than implying a support contract.

## Anti-patterns

Each of these has a measurable tell, so an audit can find them without argument.

| Anti-pattern | Tell | Fix |
|---|---|---|
| **Badge wall** | more than 4 badges above the first sentence | keep build status and licence; move the rest down or delete |
| **Hero paragraph** | adjectives before any concrete statement | replace with the one sentence formula |
| **Architecture first** | a diagram before the install command | move to an explanation page |
| **Table of contents in a short file** | a ToC for a file under ~200 lines | delete; the reader's browser has one |
| **The reference dump** | a flag or option table in the README | move to generated reference and link |
| **Untested install** | no clean-environment record | run it in a container and record the result |
| **Fabricated output** | output blocks that do not match a real run | run it and paste the real output |
| **Version drift** | version numbers written inline | reference the manifest file, or generate the line |
| **Sponsor block above install** | funding links in the first screen | move below "Where to go next" |
| **Acknowledgements before usage** | credits above the first command | move to the bottom; gratitude is not navigation |
| **"Coming soon"** | a documented feature that does not exist | delete it; a promise in a README is a bug report waiting |
| **Wall of unlabelled links** | a link list with no task labels | label each link by what the reader is trying to do |
| **Emoji headings** | decorative emoji in heading text | remove; they break screen-reader output and search |
| **Marketing verbs** | `blazing`, `seamless`, `revolutionary`, `world-class` | delete the sentence and state a measured fact or nothing |
| **Silent scope** | no "not for" and no non-goals | add both |

## Audit mode

`--audit` measures an existing README and emits `review.v1` without editing it.

```bash
wc -l README.md
grep -c 'img.shields.io\|badge' README.md              # badge count
grep -n '^#\{1,3\} ' README.md                          # section order
grep -niE '\b(blazing|seamless|robust|world-class|cutting-edge|revolutionary|simply|just |easily)\b' README.md
grep -nE '^\|' README.md | head                         # tables = probable reference dump
grep -nE '[0-9]+\.[0-9]+\.[0-9]+' README.md             # inline version numbers -> drift risk
awk '/```/{n++} END {print n/2" fenced blocks"}' README.md
```

Then run the install and the first-success block in a clean container and record: exit code,
wall-clock seconds, and whether the pasted output matches the real output character for
character. That last check finds more defects than every lint above combined.

## Exit criteria

- [ ] One sentence present, ≤ 25 words, no adjectives, follows the formula.
- [ ] "For" and "Not for" both present; "Not for" names a real alternative.
- [ ] ≥ 2 non-goals stated.
- [ ] Sections 1–5 fit within roughly one screen.
- [ ] Install is one block, prerequisites carry verified minimum versions or cite a file.
- [ ] First success executed on a clean environment; real output pasted; elapsed time measured
      and written with what was measured.
- [ ] Zero fabricated outputs, versions, flags or error strings.
- [ ] ≤ 4 badges above the first sentence.
- [ ] Zero occurrences of the marketing verb list (verified by grep).
- [ ] No reference tables in the README.
- [ ] Next-step links labelled by reader task, ≤ 8 links.
- [ ] Maturity, supported versions, SPDX licence and support expectations stated.
- [ ] Every image has alt text; heading levels descend without skipping (WCAG 2.2 SC 1.1.1,
      SC 1.3.1); no "click here" (SC 2.4.4).
- [ ] `review.v1` emitted with any finding that could not be fixed in-file.

## Interop and degradation

- Style, sentence and revision discipline: `technical-writer` and its seven-pass checklist.
- Anything longer than the README: `docs-site`.
- Reference content: `api-reference`. It never lives here.
- If the project claims a capability you cannot verify from source or a run, hand the claim to
  `evidence-verifier` rather than softening the wording.
- If no container runtime is available to test install on a clean machine, say so explicitly in
  the README audit ("install verified on the author's machine only") rather than implying a
  clean-room test happened.
- If `superpowers` is installed, run `superpowers:verification-before-completion` before
  declaring the README done; otherwise re-run the install and first-success blocks a second
  time from a fresh shell and record both results.

## Deliberately not covered

- Full documentation sites, tutorials, how-to guides and explanation pages.
- Generated API reference.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md` — the README links to
  them; it does not absorb them.
- Changelog and release notes.
- Marketing landing pages, comparison tables against competitors, benchmark claims.
- Translation of the README. One source locale; translations are a `docs-site` decision.

## References

- `references/readme-skeleton.md` — a fill-in skeleton with the exact section order and the
  budget per section.
