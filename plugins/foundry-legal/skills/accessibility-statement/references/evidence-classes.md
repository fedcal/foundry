# Evidence classes for a conformance claim

> **Automated technical assessment. Not legal advice.**

A conformance verdict is only as good as the evidence class behind it. This file says what each class
can support, so that a claim is never stronger than what was actually done.

## The classes

| Class | What it is | What it can support | What it cannot |
|---|---|---|---|
| **A — Automated** | axe-core, Lighthouse, pa11y, IBM Equal Access run over pages | "no automated violations detected on the pages scanned" | any conformance verdict on its own. Automated rules detect a minority of issues and cover a minority of criteria. |
| **B — Manual inspection** | a human applying a documented method to a page (tester, date, steps recorded) | a conformance verdict for that criterion on the pages inspected | criteria whose outcome depends on assistive technology behaviour |
| **C — Assistive technology** | a pass with a named AT and version (screen reader, magnifier, voice control, switch) | verdicts on name/role/value, status messages, focus order in custom widgets, and any criterion about programmatic exposure | nothing beyond the AT and pages tested — AT behaviour differs between products |
| **D — Code review** | reading the implementation | structural criteria where the code determines the outcome deterministically | anything depending on rendered output, computed styles, or runtime state |
| **E — Not evaluated** | no evidence of a sufficient class | reporting "not evaluated" | any verdict at all. Not evaluated is not a pass. |

## Which class each criterion type needs

| Criterion type | Minimum class | Why |
|---|---|---|
| Text alternatives (SC 1.1.1) | B | automation detects a missing `alt`; only a human judges whether the alternative is *equivalent* |
| Info and relationships (SC 1.3.1) | B + C | automation catches some structure; AT confirms what is actually exposed |
| Contrast (SC 1.4.3, 1.4.11) | A + B | automation is strong here, but misses text in images, gradients, overlays and state variants (hover, focus, disabled) |
| Keyboard (SC 2.1.1, 2.1.2) | B | automation cannot operate the interface |
| Focus visible / not obscured (SC 2.4.7, 2.4.11) | B | requires observing focus while tabbing, including under sticky headers and banners |
| Target size, dragging (SC 2.5.8, 2.5.7) | B | requires measuring and attempting the interaction |
| Accessible authentication (SC 3.3.8) | B | requires attempting login without a cognitive function test, and checking paste is not blocked |
| Redundant entry (SC 3.3.7) | B | requires completing a multi-step process |
| Name, role, value (SC 4.1.2) | C | the verdict is about what AT announces |
| Status messages (SC 4.1.3) | C | the verdict is about announcement without focus change |
| Media criteria (captions, audio description) | B | requires watching and checking synchronisation and accuracy |
| Non-web software clauses (EN 301 549, Section 508) | B + C on the platform's own AT | web tooling does not apply |

**Consequence:** an audit consisting only of automated scans supports a verdict on no criterion in
this table by itself. If that is all the evidence you have, most criteria are "not evaluated" and the
statement says so. That is the correct and honest output, and it is far safer than the alternative.

## Sampling

You almost never evaluate every page. Make the sampling explicit and defensible:

1. **Structured sample**: home, navigation and search, a complete transactional process end to end,
   a form-heavy page, a data table page, a media page, an error state, the login and account
   recovery flow, the accessibility statement page itself, plus the highest-traffic pages.
2. **Random sample** on top of the structured one, so the claim is not limited to pages that were
   fixed because they were tested.
3. **Templates and components**: identify the shared components, because a defect in one propagates
   across every page that uses it. Note which components were reviewed — this is often the most
   efficient evidence available.

Record: total pages in scope, pages sampled, how they were selected, and the date. Then state the
extrapolation explicitly:

> Verdicts are based on a sample of 18 of approximately 340 pages, selected as [method] on
> 2026-08-14. Criteria verdicts are extrapolated from that sample to pages built from the same
> templates and components; pages outside those templates were not evaluated.

## Recording per criterion

For each criterion in scope record: criterion id and name, verdict, evidence class, what was tested,
tester and date, and — for anything less than "supports" — the specific exceptions.

```
SC 1.4.3 Contrast (Minimum)  |  Partially supports  |  class A+B
  Tested: axe run 2026-08-14 on the 18-page sample, plus manual check of hover/focus/disabled
  states on the button and link components.
  Exceptions: (1) secondary button disabled state 2.9:1 (components/Button.tsx:44);
  (2) placeholder text in search 3.8:1 (components/SearchField.tsx:21);
  (3) text over the hero image varies with the uploaded image and was not evaluated.
```

Exception (3) is the pattern to watch for: a criterion whose outcome depends on content that changes.
It is "not evaluated" for the variable portion and must be said, not averaged away.

## Downgrade rules

Apply mechanically, before drafting:

- Evidence class below the minimum for the criterion type → **not evaluated**.
- Evidence older than the last release that touched the surface → **not evaluated**, with the date.
- Verdict from a tool run whose output you cannot locate → **not evaluated**. An unlocatable result is
  not evidence.
- "Supports" with any known open defect against that criterion → **partially supports** at best.
- Verdict on a page not in the sample and not built from a sampled template → **not evaluated**.

Run these as a separate pass after drafting. Finding one downgrade at this stage is normal; finding
none usually means the pass was not really run.
