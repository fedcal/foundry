# The documentation CI pipeline

A freshness policy that is not enforced by a build is a wish. Eight stages, each with an owner,
a command and a failure condition. Wire them in whatever CI the project already uses; the
stages are generator-agnostic, the commands are not, so record the project's actual commands
next to each stage.

| # | Stage | Fails when | Blocking |
|---|---|---|---|
| 1 | Build (strict) | any generator warning | yes |
| 2 | Reference regeneration | generated output differs from committed output | yes |
| 3 | Link check | any internal link is broken | yes |
| 4 | Example execution | a runnable block exits non-zero or output differs | yes |
| 5 | Prose lint | a banned term or an off-glossary term appears | yes |
| 6 | Accessibility | a WCAG 2.2 AA automated check fails | yes |
| 7 | Preview deploy | — (informational, but its absence is a finding) | no |
| 8 | Freshness report | a page is past its review cadence | no, scheduled |

## 1. Build, strictly

Requirements, in order of how often they are violated:

- **One command from a clean clone.** Test it in a container with no cache.
- **Warnings promoted to errors.** Most generators have a strict flag; use it. A warning nobody
  reads is a broken link nobody fixes.
- **No network access during the build.** A docs build that fetches remote content fails during
  someone else's outage, usually while you are trying to ship a release.
- **Pinned toolchain.** Generator and every plugin locked in a lockfile, committed.

## 2. Reference regeneration — the drift detector

This is the stage that makes "reference is generated, never hand-maintained" real.

```
1. regenerate reference output into a gitignored directory
2. diff it against the committed output
3. non-empty diff -> fail, and print the diff
```

The failure message must say what to run to fix it. Contributors who see "docs are out of date"
with no command will disable the check.

Generation happens from the **source of truth**, not from a previous generation. See the
`api-reference` skill for the source-of-truth ladder.

## 3. Link check

Two link classes, two policies:

- **Internal links** — any breakage fails the build. No exceptions, no allow-list.
- **External links** — checked on a schedule rather than per pull request (external sites go
  down for reasons unrelated to your change), with failures allow-listed **individually by URL
  and with a reason**. A blanket `ignore-external: true` converts this stage into decoration.

Also check anchors, not just pages. A link to `#configuration` that no longer exists is a
broken link that most checkers skip by default; enable fragment checking explicitly.

## 4. Example execution

Every fenced block a reader is expected to run is executed, and its real output compared to the
documented output.

Mechanics that make this survivable:

- Mark blocks explicitly: runnable blocks carry a metadata marker, non-runnable blocks carry
  the opposite marker. **Unmarked is a failure**, otherwise the ratio silently drifts.
- Run against the version being documented, in a disposable environment.
- Normalise volatile output — timestamps, durations, generated ids, temp paths — with a
  documented substitution list, not with fuzzy matching.
- Keep a real failure example per guide and assert its error message too. Error strings drift
  more often than success paths, and they are what users search for.

## 5. Prose lint

Enforce, from a committed config:

- The banned-word list: `simply`, `just`, `easily`, `obviously`, `of course`, `blazing fast`,
  `seamless`, `robust`, `world-class`, `click here`, `read more`, `and/or`, `etc.`,
  `should work`, `please`.
- Glossary terms and their rejected synonyms, generated from `fact.v1` entries of type
  `glossary` so the docs and the domain research cannot diverge.
- Heading style: sentence case, no trailing punctuation, no skipped levels.
- Product and project names with their exact capitalisation.

Run on changed files in pull requests and on everything nightly. Linting the whole tree on every
pull request punishes contributors for pre-existing debt and teaches them to bypass the check.

## 6. Accessibility

Automated scanning catches a real but limited share of issues; run it and do not claim it
proves conformance. Gate on these WCAG 2.2 AA success criteria by number, because they are the
ones documentation sites fail:

| SC | Name | Typical docs failure |
|---|---|---|
| 1.1.1 | Non-text Content | architecture diagrams with no alt text or text equivalent |
| 1.3.1 | Info and Relationships | bold text used as a heading; layout tables |
| 1.4.3 | Contrast (Minimum) | syntax-highlighting themes, especially comments and muted text |
| 1.4.10 | Reflow | wide code blocks and tables forcing horizontal scroll at 320 CSS px |
| 2.4.4 | Link Purpose (In Context) | "click here", "read more" |
| 2.4.7 | Focus Visible | custom search and version-selector widgets |
| 2.4.11 | Focus Not Obscured (Minimum) | sticky headers and cookie banners covering the focused element |
| 3.1.1 | Language of Page | missing or wrong `lang` on translated pages |

Add one manual pass per release: navigate the site, the search and the version selector using
the keyboard only. Automated tools do not catch a focus trap in a search overlay.

## 7. Preview deploy

Every pull request gets a rendered preview URL, posted as a comment. Reviewing documentation as
a markdown diff hides exactly the defects that matter — broken tables, wrong heading levels,
overflowing code blocks, images that do not resolve.

If the hosting cannot produce per-pull-request previews, publishing a build artifact reviewers
can download is a weaker but acceptable fallback. Reviewing the diff alone is not.

## 8. Freshness report

A scheduled job, not a pull-request gate:

1. Read `last_reviewed` and the cadence from each page's frontmatter.
2. List pages past cadence, grouped by `CODEOWNERS` owner.
3. Open or update one issue per owner — not one per page, which produces noise and is ignored.
4. Render a visible "last reviewed on YYYY-MM-DD" line on any page past cadence, so readers can
   calibrate their trust. Silent staleness is the failure mode; visible staleness is a service.

## Change triggers beat calendars

The highest-value rule in the whole pipeline, and the one most projects lack:

```
if the pull request touches <watched source path>
and does not touch docs/
and does not carry the label `docs-not-needed`
then fail with: "this change affects <docs page>; update it or explain the exemption"
```

Maintain the watched-path → docs-page map in a committed file so it is reviewable. Calendar
review catches rot after it happens; triggers prevent it. Both are needed, and the trigger is
cheaper.

## Failure messages

Every gate's failure message contains three things:

1. What is wrong, specifically — file and line.
2. The exact command to reproduce locally.
3. The exact command to fix it, or the sentence explaining why a human must decide.

A gate whose message is "docs check failed" trains contributors to ignore it, and a gate that is
ignored is worse than no gate, because it creates the appearance of enforcement.
