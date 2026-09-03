---
name: audit-accessibility
description: Run a repeatable WCAG 2.2 Level AA audit of a page, route or component and emit a review.v1 artifact. Automated axe pass first, then the manual checks automation provably cannot do — focus order, reflow at 320 CSS px and 400% zoom, 24x24 target size, focus obscuring, and screen reader announcements — each mapped to a success criterion. Use before shipping UI, for a conformance evidence pack, or when an audit must be reproducible by someone else.
allowed-tools: Read Grep Glob Bash Write Edit
user-invocable: true
argument-hint: "<url-or-route> [--pages routes.txt] [--level AA] [--out .foundry/blackboard/<wave>]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: dev
  foundry.io: "route list -> review.v1 with WCAG 2.2 SC-mapped findings"
license: Apache-2.0
---

# Repeatable WCAG 2.2 AA audit

The output of this skill is **evidence**, not an opinion. Another person must be able to
re-run every step and reach the same verdict. That is the whole design goal.

Automated rule engines detect only a minority of WCAG failures — commonly reported as around
a third. Steps 3–7 below exist because they cover what step 2 structurally cannot: whether
the order makes sense, whether the announcement is useful, whether the thing is reachable.

## When NOT to use this

- You want to fix a known issue. Just fix it; this skill is for discovery and evidence.
- You need a legal accessibility statement. This produces the evidence table; drafting the
  statement is the legal vertical's job.
- The target is a PDF, Word document or native mobile app. Out of scope.
- You have no way to render the page. Read §Degradation before starting — a static-only run
  is legitimate but must be labelled as such.

## Deliberately not covered

WCAG Level AAA (recorded as `info` only), EN 301 549 clauses outside 9 and 12,
usability quality (`ux-architect`), performance (`frontend-performance-engineer`), and any
claim of conformance. This skill adds no dependency to the project.

## Step 1 — Fix the scope and record the environment

Ambiguity here invalidates the whole audit.

```bash
OUT=${1:-.foundry/blackboard/audit/accessibility}
mkdir -p "$OUT/raw"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
  echo "node: $(node -v)"
  npx axe --version 2>/dev/null | sed 's/^/axe-cli: /'
  node -p "'axe-core: '+require('axe-core/package.json').version" 2>/dev/null
} > "$OUT/raw/environment.txt"
cat "$OUT/raw/environment.txt"
```

Record explicitly, in the artifact `metrics`:

- The exact route list audited (URLs, not descriptions).
- Viewport sizes tested and the browser + version.
- Assistive technology pairings used, with versions.
- Conformance target: **WCAG 2.2 Level AA** unless overridden.
- Whether the page was audited server-rendered, hydrated, or both.

Pick routes by **user journey coverage**, not by convenience: sign-in, the primary task
flow end to end, one data-heavy view, one form with validation, one modal, and the error
pages. Auditing only the home page is theatre.

## Step 2 — Automated pass (axe)

Use whatever is already installed; add nothing. Detection first:

```bash
node -p "Object.keys({...require('./package.json').devDependencies,...require('./package.json').dependencies})\
.filter(d=>/axe|pa11y|lighthouse|playwright|cypress|puppeteer/.test(d)).join('\n')" 2>/dev/null
```

Then, in order of preference, whichever is available:

```bash
# a) axe CLI against a running app
npx axe "http://localhost:4200/checkout" --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa \
  --save "$OUT/raw/axe-checkout.json"

# b) Playwright + @axe-core/playwright, if the project already uses Playwright
#    (see references/automation.md for the harness)

# c) Lighthouse accessibility category, as a weak fallback only
npx lighthouse "http://localhost:4200/checkout" --only-categories=accessibility \
  --output=json --output-path="$OUT/raw/lh-checkout.json" --chrome-flags="--headless"
```

Triage rules for automated output:

- `critical` and `serious` axe impacts become findings without further debate.
- `moderate` and `minor` are reviewed individually; some are genuine, some are rule
  heuristics that do not apply. Refuting one requires a written reason in the finding.
- **A clean axe run is never a pass.** Record it as `metrics.automated.violations = 0` and
  continue to step 3. Reporting "no issues found" after step 2 is a defect in this audit.
- axe rule ids map to success criteria via the rule's own tags — carry the SC number into
  `standard`, never the rule id alone.

Harness code, per-runner: `references/automation.md`.

## Step 3 — Keyboard and focus order (SC 2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11, 2.4.1)

Automation cannot judge whether an order is *logical*. You must walk it.

For each page:

1. Load with focus on the document, press `Tab` repeatedly to the end, recording each stop:
   element, accessible name, and whether the focus indicator is visible.
2. Compare that sequence with the visual reading order. Any divergence is **SC 2.4.3**.
3. At every stop, check whether a sticky header, cookie banner, chat widget or toast fully
   hides the focused element — **SC 2.4.11 Focus Not Obscured (Minimum), Level AA**. Scroll
   the page halfway first; this failure usually appears only mid-scroll.
4. Any element you cannot leave with `Tab`, `Shift+Tab` or `Escape` is **SC 2.1.2**, and is
   `critical` without exception.
5. Any action available by mouse but not by keyboard is **SC 2.1.1**, `critical`.
6. `Tab` once from the very top: is there a skip link, and does pressing `Enter` actually
   move focus (not just scroll)? Missing or non-functional is **SC 2.4.1**.
7. Grep for the cheap self-inflicted failures:

```bash
grep -rn "outline:\s*none\|outline:\s*0" src/ --include=*.scss --include=*.css | grep -v "focus-visible"
grep -rn "tabindex=\"[1-9]" src/ --include=*.html          # positive tabindex: SC 2.4.3
grep -rnE "\(click\)" src/ --include=*.html | grep -vE "<(button|a|input|select|textarea)" | head -40
```

The third grep finds click handlers on non-interactive elements — the most common source of
2.1.1 failures in Angular codebases. Each hit needs a manual verdict, not a blanket finding.

## Step 4 — Reflow and zoom (SC 1.4.10, 1.4.4, 1.4.12)

1. **Reflow, SC 1.4.10 (AA).** Set the viewport to **320 CSS px** wide (equivalently 400%
   zoom at 1280 px) and 256 px tall for the vertical case. Requirement: no two-dimensional
   scrolling. Content that legitimately requires 2D — data tables, maps, complex diagrams,
   code blocks — is excepted, but the exception must be *claimed and justified* in the
   finding, not silently assumed.
2. **Resize text, SC 1.4.4 (AA).** 200% text-only zoom (browser text-size setting, not page
   zoom). Look for clipping and overlap. `font-size` in `px` inside fixed-height containers
   is the usual cause.
3. **Text spacing, SC 1.4.12 (AA).** Apply, via devtools or a user stylesheet:

```css
* { line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important; }
p { margin-block-end: 2em !important; }
```

No content may be lost or made unreadable. Fixed `height` on text containers fails here;
`min-height` does not.

Static pre-screen for likely offenders:

```bash
grep -rnE "height:\s*[0-9]+(px|rem)" src/ --include=*.scss | grep -vi "min-height\|icon\|avatar" | head -30
grep -rn "white-space:\s*nowrap" src/ --include=*.scss | head -20
grep -rnE "overflow(-x)?:\s*hidden" src/ --include=*.scss | head -20
```

## Step 5 — Target size (SC 2.5.8, Level AA)

Minimum **24×24 CSS px** for pointer targets, unless one of the standard exceptions applies:
sufficient spacing between targets, an equivalent control elsewhere on the page, the target
is inline within a sentence, the size is user-agent determined, or the presentation is
essential.

Measure — do not estimate. In the browser console:

```js
[...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="switch"],[tabindex]:not([tabindex="-1"])')]
  .map(el => { const r = el.getBoundingClientRect();
    return { name: (el.innerText || el.getAttribute('aria-label') || el.tagName).slice(0, 40),
             w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter(t => (t.w < 24 || t.h < 24) && t.w > 0)
```

Record every hit with its measured width and height as `kind: "measurement"` evidence.
Icon-only buttons, table row actions, close buttons on chips, and pagination controls are
the recurring offenders. Report the number as the number; "looks small" is not evidence.

## Step 6 — Screen reader announcements (SC 4.1.2, 4.1.3, 2.4.2, 2.5.3, 1.1.1, 3.3.1)

This is where the findings automation cannot produce live. Test **two** pairings minimum
(NVDA + Firefox, VoiceOver + Safari, JAWS + Chrome, TalkBack + Chrome) and name versions.

Per page, execute the checklist in `references/manual-checks.md` §Screen reader script and
record the **actual announced string** for each item. Minimum coverage:

| Check | Fails as |
|---|---|
| Every control announces name + role + state | SC 4.1.2 |
| Announced name contains the visible label text | SC 2.5.3 Label in Name |
| Errors, toasts, result counts announced without moving focus | SC 4.1.3 Status Messages |
| Route change announces the new page and updates the title | SC 2.4.2, and 2.4.3 for focus |
| Images convey equivalent information, decoratives are silent | SC 1.1.1 |
| Validation errors are announced and name the field | SC 3.3.1 |
| Headings list describes the page structure | SC 1.3.1, 2.4.6 |
| Link list contains no "click here" / bare URLs | SC 2.4.4 |

**Never invent an announcement transcript.** If no screen reader is available, say so, mark
these findings `confidence: low`, and raise the missing-AT-testing gap as its own finding.

## Step 7 — Contrast and colour (SC 1.4.3, 1.4.11, 1.4.1)

Text: **4.5:1**; large text (≥ 24 px, or ≥ 18.66 px bold): **3:1**. UI component boundaries
and meaningful graphics: **3:1** (SC 1.4.11). Check default, hover, focus and placeholder
states — the focus ring and input borders fail most often.

Record the computed ratio as a number in `evidence[kind="measurement"]`. Ratio computation
without a dependency: `references/manual-checks.md` §Contrast maths (WCAG relative
luminance). Also verify no state is communicated by colour alone (SC 1.4.1): required
fields, validation states, chart series, status chips.

## Step 8 — Write the `review.v1` artifact

```json
{
  "schema": "review.v1",
  "producedBy": "accessibility-engineer",
  "target": "https://app.example.com/checkout (routes: /checkout, /checkout/payment)",
  "dimension": "accessibility",
  "verdict": "block",
  "metrics": {
    "conformanceTarget": "WCAG 2.2 Level AA",
    "routesAudited": 6,
    "automated": { "tool": "axe-core", "violations": 11, "critical": 2, "serious": 4 },
    "manualChecksRun": ["focus-order", "reflow-320", "zoom-400", "text-spacing", "target-size", "screen-reader", "contrast"],
    "assistiveTech": ["NVDA + Firefox (Windows)", "VoiceOver + Safari (macOS)"],
    "scFailed": ["1.4.3", "2.1.2", "2.4.11", "2.5.8", "4.1.3"],
    "scPassed": ["1.4.10", "2.4.1", "3.3.1"]
  },
  "findings": [ /* finding.v1 objects, `standard` always filled */ ],
  "summary": "..."
}
```

Verdict rule, applied mechanically:

| Condition | `verdict` |
|---|---|
| Any Level A failure, or any `critical` finding | `block` |
| Level AA failures only, none blocking task completion | `pass-with-comments` |
| No A or AA failures; only `low`/`info` findings | `pass` |

Validate before finishing:

```bash
node -e '
const r = require("./'"$OUT"'/accessibility.json");
if (r.schema !== "review.v1") throw new Error("wrong schema");
const bad = r.findings.filter(f => !f.standard || !f.failureScenario);
if (bad.length) { console.error("findings missing standard/failureScenario:", bad.map(f=>f.id)); process.exit(1); }
console.log("ok", r.findings.length, "findings");'
```

## Exit criteria

1. Every route in scope has an automated result file under `raw/`.
2. All of steps 3–7 executed per route, and `metrics.manualChecksRun` lists them.
3. `metrics.scPassed` and `metrics.scFailed` are both populated — criteria checked and
   passed are recorded, so the audit is falsifiable.
4. 100% of findings have a non-empty `standard` naming a WCAG 2.2 SC number and level.
5. 100% of findings have a `failureScenario` naming AT/input method, page and wrong outcome.
6. Every contrast and target-size finding carries a numeric measurement in `evidence`.
7. Two or more AT pairings named with versions, or the gap is itself a finding.
8. `verdict` follows the table above with no discretion applied.
9. The artifact validates against `review.v1`; the returned summary is ≤ 300 tokens and does
   not paste the findings array.

## Degradation

- **No running app / no browser.** Run a static pass (grep-based checks in steps 3 and 4,
  template review for labels, `alt`, headings, `lang`, `autocomplete`, ARIA misuse). Set
  `metrics.mode = "static-only"`, cap all rendering-dependent findings at
  `confidence: low`, and list the criteria that could not be evaluated. Do not emit a
  `pass` verdict from a static-only run — the best available verdict is
  `pass-with-comments`.
- **No axe installed.** Do not install it. Use Lighthouse's accessibility category if
  available, and file a `tooling` finding that CI has no accessibility gate.
- **No screen reader.** Per step 6: declare it, do not fabricate.
- **`superpowers` installed.** Use `superpowers:verification-before-completion` before
  emitting the verdict, and `superpowers:systematic-debugging` when a failure's cause is
  unclear (for example, an announcement that works in one browser and not another).

## References

- `references/automation.md` — axe harnesses for CLI, Playwright, Cypress and unit tests; how to read axe JSON and map rule tags to SC numbers.
- `references/manual-checks.md` — the full manual scripts: focus-order sheet, screen reader script per AT with key commands, reflow procedure, contrast maths.
- `references/wcag22-aa-checklist.md` — every Level A and AA success criterion with how to test it and the usual Angular failure mode.
