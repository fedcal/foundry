# Automated pass — harnesses and how to read the output

Foundry installs nothing. Detect what the project already has and use that. If nothing is
available, that absence is itself a finding (`category: tooling`).

```bash
node -p "Object.keys({...require('./package.json').dependencies,...require('./package.json').devDependencies})\
.filter(d=>/axe|pa11y|lighthouse|playwright|cypress|puppeteer|jest-axe/.test(d)).join('\n')"
```

## axe CLI (a running app)

```bash
npx axe "http://localhost:4200/checkout" \
  --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa \
  --save out/axe-checkout.json
```

Confirm the tag names your installed version supports before trusting the filter —
`npx axe --help` lists them. A misspelled tag silently narrows the ruleset, which produces a
falsely clean report. Cross-check by running once with no `--tags` and comparing counts.

The CLI audits the URL as loaded. For anything behind authentication or reachable only
through interaction, use the Playwright or Cypress harness below instead.

## Playwright + `@axe-core/playwright`

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/sign-in', '/checkout', '/checkout/payment'];

for (const route of routes) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');   // hydration must finish first
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
```

For SPA states that only exist after interaction (a modal, an expanded menu, a form in its
error state), drive the interaction first, then analyse. **Most real violations live in
states the crawler never reaches.** Explicitly enumerate: each modal, each error state,
each expanded disclosure, each loaded-more list.

Scope to a subtree when auditing a component in isolation:

```ts
new AxeBuilder({ page }).include('[data-testid="checkout-form"]')
```

## Cypress + `cypress-axe`

```ts
cy.visit('/checkout');
cy.injectAxe();
cy.checkA11y(undefined, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } });
```

## Unit-level (`jest-axe` / `axe-core` in Karma)

Fast feedback per component, but note it audits a detached fragment: contrast, focus order
across the page and anything depending on real layout will not be evaluated. It is a
regression net, not an audit.

```ts
const { container } = await render(UserCardComponent, { inputs: { user } });
expect(await axe(container)).toHaveNoViolations();
```

## Lighthouse (weak fallback)

```bash
npx lighthouse "http://localhost:4200/checkout" --only-categories=accessibility \
  --output=json --output-path=out/lh.json --chrome-flags="--headless"
```

Lighthouse's accessibility category is a subset of axe with its own weighting, and its
score is not a conformance measure. Use it only when nothing better exists, and never quote
the score as evidence of conformance.

## Reading axe JSON

```bash
node -e '
const r = require("./out/axe-checkout.json");
const res = Array.isArray(r) ? r[0] : r;
for (const v of res.violations) {
  console.log([v.impact, v.id, v.tags.filter(t=>/^wcag\d/.test(t)).join(","), v.nodes.length, v.help].join(" | "));
}
console.log("passes:", res.passes.length, "incomplete:", res.incomplete.length);'
```

Four buckets matter:

| Bucket | Meaning | Action |
|---|---|---|
| `violations` | Rule failed | Triage all; `critical`/`serious` become findings automatically |
| `incomplete` | Rule could not decide | **Review every one manually.** Contrast over gradients and images lands here and is frequently a real failure |
| `passes` | Rule passed | Record the count in `metrics`; it is not a conformance claim |
| `inapplicable` | No matching element | Ignore |

Never skip `incomplete`. It is where the tool is honest about its limits, which is exactly
where the manual audit earns its keep.

## Mapping an axe rule to a success criterion

Every axe rule carries WCAG tags of the form `wcag<version><criterion>` — for example
`wcag143` for SC 1.4.3, `wcag412` for SC 4.1.2, `wcag258` for SC 2.5.8. Convert the tag to
dotted SC notation and put **that** in `finding.standard`, together with the level:

```
standard: "WCAG 2.2 SC 1.4.3 Contrast (Minimum) (Level AA) | EN 301 549 clause 9.1.4.3"
```

Rules tagged only `best-practice` (with no `wcag*` tag) map to no success criterion. Report
them with `standard: "Best practice — no WCAG SC"` and cap severity at `low`. Presenting a
best-practice rule as a conformance failure destroys the credibility of the whole report.

## Common false positives, and how to refute one properly

- **Colour contrast over a background image or gradient.** axe usually reports `incomplete`;
  measure the worst-case pixel manually and record the number.
- **`aria-hidden` on a focusable ancestor** reported where the element is genuinely removed
  from the tab order by other means — verify with a real `Tab` walk before refuting.
- **Duplicate landmark roles** flagged where the landmarks carry distinct accessible names
  (`aria-label`). Named duplicates are permitted; unnamed ones are not.
- **Nested interactive controls** inside a virtualised list where only one is rendered.

Refuting a rule requires a finding with `verdict: "refuted"`, the reason, and the manual
evidence that settles it. Silently deleting a violation from the report is falsification.

## Wiring the gate into CI

Fail the build on `critical` and `serious`; report the rest. Ratchet the threshold down each
sprint rather than setting an aspirational zero that gets disabled within a month.

```bash
node -e '
const r = require("./out/axe-checkout.json");
const res = Array.isArray(r) ? r[0] : r;
const blocking = res.violations.filter(v => ["critical","serious"].includes(v.impact));
if (blocking.length) { console.error("blocking a11y violations:", blocking.map(v=>v.id).join(", ")); process.exit(1); }'
```

A project with no accessibility gate in CI gets a `tooling` finding at `high` severity: every
manual audit you perform decays back to the starting point without one.
