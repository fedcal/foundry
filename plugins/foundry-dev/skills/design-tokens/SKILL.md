---
name: design-tokens
description: Establish or refactor a design token system for a web/Angular codebase — three-tier naming (primitive, semantic, component), theming and dark mode, contrast validation of every semantic pair, and wiring into Angular Material or a custom stylesheet architecture. Use when colours and spacing are hard-coded, when dark mode is being added, when a design system is drifting, or when a rebrand must not become a find-and-replace.
user-invocable: true
argument-hint: "[--audit | --establish | --refactor] [--themes light,dark,hc] [--src src/]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: dev
  foundry.io: "stylesheets -> token layer + theme files + contrast report"
license: Apache-2.0
---

# Design token system: establish, refactor, validate

A token system exists to make one thing true: **changing a design decision means editing one
declaration.** If a rebrand, a dark mode or a contrast fix requires touching component
stylesheets, the system has failed regardless of how it is named.

The test that settles whether a system works: *can you swap the entire theme by changing only
the semantic layer, without editing a single component file?* If not, the semantic layer is
incomplete. Everything below serves that test.

## When NOT to use this

- A one-off marketing page with no reuse. Tokens cost more than they return.
- The project already uses a token pipeline (Style Dictionary, Theo, a Figma Tokens export).
  Work inside it; do not build a parallel system. Audit mode still applies.
- You need to pick brand colours or a type scale. That is a design decision — this skill
  structures decisions, it does not make them.
- Fewer than about 20 hard-coded values exist. Just fix them.

## Deliberately not covered

Visual/brand design, typography selection, icon systems, Figma synchronisation, WCAG auditing
beyond the contrast of token pairs (`audit-accessibility` owns the rest), and installing any
build tooling. This skill emits plain CSS custom properties and, where relevant, Sass; it
adds no dependency.

---

## Mode 1 — Audit (always run this first, in every mode)

Measure before proposing. These numbers are the baseline and the ratchet.

```bash
SRC=${SRC:-src}

echo "== literal colours =="
grep -rnoE "#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)" "$SRC" \
  --include=*.scss --include=*.css --include=*.html | wc -l

echo "== literal spacing (px/rem in layout properties) =="
grep -rnoE "(margin|padding|gap|inset|top|right|bottom|left)[^:]*:\s*[0-9.]+(px|rem)" "$SRC" \
  --include=*.scss --include=*.css | wc -l

echo "== literal radii / shadows / durations =="
grep -rnoE "border-radius:\s*[0-9.]+(px|rem)" "$SRC" --include=*.scss | wc -l
grep -rnoE "box-shadow:\s*[^;]+" "$SRC" --include=*.scss | wc -l
grep -rnoE "transition[^:]*:\s*[^;]*[0-9.]+m?s" "$SRC" --include=*.scss | wc -l

echo "== token usage =="
grep -rnoE "var\(--[a-z0-9-]+\)" "$SRC" --include=*.scss --include=*.css --include=*.html | wc -l

echo "== distinct colour values actually in use (the real palette) =="
grep -rhoE "#[0-9a-fA-F]{6}\b" "$SRC" --include=*.scss --include=*.css \
  | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn | head -40

echo "== existing custom properties =="
grep -rhoE "^\s*--[a-z0-9-]+" "$SRC" --include=*.scss --include=*.css | sort -u | head -60

echo "== Angular Material present? =="
node -p "require('./package.json').dependencies['@angular/material'] || 'not installed'" 2>/dev/null
grep -rn "mat.define-\|mat.theme\|@angular/material" "$SRC"/styles.scss 2>/dev/null | head
```

**Token adoption rate** = `var(--…)` occurrences ÷ (`var(--…)` + literal occurrences),
computed per category (colour, spacing, radius, shadow, motion). Record the five numbers.
Targets: ≥ 90% for colour and spacing, ≥ 80% for radius and motion. These are the exit
criteria; they only ever ratchet upward.

The "distinct colour values" output is the most revealing number in the audit. A codebase
with 6 intended brand colours and 74 distinct hex values does not have a colour problem —
it has a governance problem, and the count is the argument for fixing it.

---

## Mode 2 — Establish (three tiers, and only three)

Full naming grammar, worked examples and anti-patterns: `references/naming-and-tiers.md`.

### Tier 1 — Primitive: raw values, no meaning, never referenced by a component

```css
:root {
  --blue-50:  #eff5ff;  --blue-500: #3b6fd4;  --blue-600: #2f59ab;  --blue-900: #16274c;
  --grey-0:   #ffffff;  --grey-100: #f4f5f7;  --grey-600: #5b6172;  --grey-900: #14161c;
  --red-600:  #b3261e;  --green-600: #1e6b32;

  --size-1: 0.25rem; --size-2: 0.5rem; --size-3: 0.75rem; --size-4: 1rem;
  --size-6: 1.5rem;  --size-8: 2rem;   --size-12: 3rem;

  --font-size-100: 0.875rem; --font-size-200: 1rem; --font-size-400: 1.5rem;
  --duration-fast: 120ms; --duration-base: 200ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

Primitives are numbered on a scale, never named for a use. A component that writes
`var(--blue-600)` is a **governance violation** and a `medium` finding — it cannot be themed.

### Tier 2 — Semantic: role, not appearance. This is the layer components consume.

```css
:root {
  --color-surface-default:  var(--grey-0);
  --color-surface-sunken:   var(--grey-100);
  --color-surface-danger:   var(--red-600);
  --color-text-default:     var(--grey-900);
  --color-text-muted:       var(--grey-600);
  --color-text-on-accent:   var(--grey-0);
  --color-border-subtle:    var(--grey-100);
  --color-border-strong:    var(--grey-600);
  --color-action-primary:   var(--blue-600);
  --color-action-primary-hover: var(--blue-500);
  --color-focus-ring:       var(--blue-600);
  --focus-ring-width:       2px;

  --space-1: var(--size-1); --space-2: var(--size-2); --space-3: var(--size-3);
  --space-4: var(--size-4); --space-6: var(--size-6);
  --radius-sm: 4px; --radius-md: 8px; --radius-pill: 999px;
  --elevation-raised: 0 1px 2px rgb(0 0 0 / 0.08), 0 2px 8px rgb(0 0 0 / 0.06);
  --motion-enter: var(--duration-base) var(--ease-standard);
}
```

Naming grammar: `--<category>-<role>-<variant?>-<state?>`.
`--color-text-muted`, not `--color-grey-500`. A token named after a colour cannot survive a
theme change; a token named after a role cannot survive being wrong about the role, which is
a much cheaper mistake.

### Tier 3 — Component: optional, and only when a component genuinely diverges

```css
.app-button {
  --button-bg:      var(--color-action-primary);
  --button-fg:      var(--color-text-on-accent);
  --button-padding: var(--space-2) var(--space-4);
  background: var(--button-bg); color: var(--button-fg); padding: var(--button-padding);
}
.app-button--danger { --button-bg: var(--color-surface-danger); }
```

The value of tier 3 is that a consumer can re-skin one instance without a new class or an
`!important`. Create a tier-3 token only when a divergence actually exists; a tier-3 token
that merely aliases a semantic token is noise.

### Hard rules

1. Component and template code may reference **only** tiers 2 and 3. Never tier 1.
2. Maximum reference depth is 3 (component → semantic → primitive). Deeper chains are
   untraceable at debug time.
3. Every token has one owner and one definition. Two files defining `--color-text-default`
   is a defect that a cascade will resolve unpredictably.
4. Spacing, radius, elevation, motion duration and easing are tokens too. Colour-only token
   systems solve a third of the problem and then rot.
5. A new primitive requires a review; a new semantic token requires a stated role that no
   existing token covers.

---

## Mode 3 — Theming and dark mode

Themes swap **the semantic layer only**. If a component must change when the theme changes,
the semantic layer is incomplete — fix the layer, not the component.

```css
:root, [data-theme='light'] { /* semantic tokens as above */ }

[data-theme='dark'] {
  --color-surface-default: var(--grey-900);
  --color-surface-sunken:  #0d0f14;
  --color-text-default:    var(--grey-0);
  --color-text-muted:      #a5abbb;      /* lightened: grey-600 on dark fails 4.5:1 */
  --color-action-primary:  #7fa5ee;      /* lightened: blue-600 on dark fails 4.5:1 */
  --color-border-subtle:   #2a2e39;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* same overrides */ }
}

[data-theme='hc'] { /* high contrast: every pair >= 7:1, borders always visible */ }
```

Rules that are not negotiable:

- **Dark mode is not an inversion.** Every semantic pair must be re-measured; a colour that
  passes 4.5:1 on white almost never passes on near-black. Run the validator (Mode 4).
- Never pure `#000` as a dark surface — it maximises halation and makes elevation
  unrepresentable. Use a very dark neutral.
- Elevation in dark themes comes from surface lightness, not from shadow. Add
  `--color-surface-raised` rather than relying on `--elevation-raised`.
- Honour `prefers-color-scheme` **and** offer an explicit override. Persist the choice, apply
  it before first paint (a small inline script in `index.html`) or the user sees a flash.
- With SSR, the server does not know the user's preference. Either render a theme-neutral
  shell or set the attribute in an inline script before hydration; a theme flash on every
  navigation is a real defect, not a cosmetic one.
- Images, illustrations and charts need dark variants or a background that works in both.
- `color-scheme: light dark` on `:root` so native form controls and scrollbars follow.

---

## Mode 4 — Contrast validation (mandatory, automated)

Every semantic foreground/background pair is validated on every theme. This is a gate, not
a review step.

```bash
node "${CLAUDE_SKILL_DIR}/scripts/check-token-contrast.mjs" src/styles/tokens.css
```

The script (Node ≥ 20, standard library only — no install) parses the custom properties,
resolves `var()` chains, computes WCAG relative-luminance contrast ratios, and exits non-zero
if any declared pair falls below its threshold. Declare pairs in a small manifest next to the
tokens; see `references/contrast-validation.md` for the manifest format and thresholds.

| Pair kind | Minimum | Success criterion |
|---|---|---|
| Body text on its surface | 4.5:1 | WCAG 2.2 SC 1.4.3 (AA) |
| Large text (≥ 24 px, or ≥ 18.66 px bold) | 3:1 | SC 1.4.3 (AA) |
| Control borders, focus ring, meaningful icons | 3:1 | SC 1.4.11 (AA) |
| High-contrast theme, all text | 7:1 | SC 1.4.6 (AAA target for that theme) |

Wire it into CI alongside lint. A token system without a contrast gate reintroduces the
failures the tokens were supposed to prevent, one merge at a time.

Note: contrast is necessary, not sufficient. Colour must never be the only carrier of meaning
(SC 1.4.1) — that is checked by `audit-accessibility`, not here.

---

## Mode 5 — Wiring into Angular

### Custom system

```
src/styles/
  _primitives.css     # tier 1
  _semantic.css       # tier 2, :root + [data-theme='dark'] + [data-theme='hc']
  tokens.css          # imports the two above; the only file components' authors read
  tokens.manifest.json# pairs to validate + thresholds
```

Import `tokens.css` once in `styles.scss`. Component stylesheets consume `var(--…)` directly —
custom properties pierce Angular's view encapsulation, which is exactly why they are the right
mechanism here. Sass variables do **not**: they are compiled away and cannot be themed at
runtime. Use Sass only for build-time maths, never for theme values.

### Angular Material

Material's theming API differs substantially between major versions. **Read
`${CLAUDE_PLUGIN_ROOT}/references/stack-versions.json` and then confirm against the installed
package** before writing a single theme line:

```bash
node -p "require('./node_modules/@angular/material/package.json').version"
grep -rn "mat.define-\|mat.theme\|mat.core\|mat.all-component-themes" src/styles.scss | head
ls node_modules/@angular/material/_index.scss && grep -n "^@mixin \|^@function " node_modules/@angular/material/_index.scss | head -40
```

The last command lists the theming mixins and functions your installed version actually
exports — that is the authoritative answer, not documentation you remember.

Bridging strategy, in preference order:

1. **Feed Material from your tokens.** Build the Material theme's palettes from your primitive
   scale, so one palette change flows everywhere. Best when Material is your design system.
2. **Map Material's system custom properties to your semantic tokens** where the installed
   version exposes them. Verify which properties exist:
   `grep -rhoE "\-\-mat-[a-z0-9-]+" node_modules/@angular/material/prebuilt-themes/*.css | sort -u | head -40`
3. **Override at the component-token level** for the small number of components that must
   diverge. Never reach into Material's internal DOM with `::ng-deep` and a class name from
   its implementation — those selectors break on every minor upgrade and are a `high`
   maintenance finding.

Whichever you choose, record it as an ADR-worthy decision and a T1 fact (`type: convention`)
through the `foundry` MCP `memory_write` tool. The next person must not have to reverse
engineer it.

---

## Mode 6 — Refactor an existing codebase

Never a single big-bang commit — it is unreviewable and it will be reverted.

1. Run the audit. Publish the five adoption numbers.
2. Extract the **actual** palette from the audit's distinct-value list. Cluster near-duplicates
   (`#3b6fd4` and `#3c6fd5` are the same intent) and take that list to the designer for a
   decision. Do not silently pick one.
3. Land the primitive and semantic layers with **zero component changes**. Nothing renders
   differently. This commit is safe by construction and easy to review.
4. Migrate one feature directory per commit, mechanically:
   `grep -rn "#3b6fd4" src/app/checkout` → replace with the semantic token whose role matches.
   If no role matches, that is a missing semantic token, not a licence to use a primitive.
5. Add the contrast gate to CI after step 3, before step 4 finishes.
6. Add a lint rule or a CI grep forbidding literal hex values and primitive references in
   `src/app/**`, with the current count as the ceiling. Lower the ceiling every sprint.
7. Delete dead tokens. A token nothing references is a future misuse:
   `for t in $(grep -hoE "^\s*--[a-z0-9-]+" src/styles/_semantic.css | tr -d ' '); do
      n=$(grep -rc "var($t)" src/app | awk -F: '{s+=$2} END {print s}');
      [ "${n:-0}" -eq 0 ] && echo "UNUSED $t"; done`

---

## Governance (the part that decides whether this survives)

Write this down in `docs/design-system/governance.md`; a system without it forks within two
quarters.

- **Who may add a token, and who reviews.** Named people or a named role, not "the team".
- **Contribution path.** How a designer requests a token; how an engineer proposes one; what
  evidence is required (which components need it, why no existing token fits).
- **Deprecation policy.** Deprecated tokens keep working, are annotated with a replacement and
  a removal date, and are removed on that date. Deprecation without a date is not deprecation.
- **Versioning.** Renaming or removing a token is a breaking change to every consumer.
- **Usage report** published each release: adoption rate per category, unused tokens, literal
  values remaining, contrast failures. If nobody looks at the numbers, they will regress.
- **The escape hatch, and its cost.** There must be a documented way to bypass the system in
  an emergency, and every use must be logged with an owner and a removal condition.

---

## Exit criteria

1. Exactly three tiers exist, and `grep -rn "var(--\(blue\|grey\|red\|green\|size\)-" src/app`
   returns zero — no component references a primitive.
2. Token adoption ≥ 90% for colour and spacing, ≥ 80% for radius and motion, measured by the
   audit commands, with before/after numbers recorded.
3. Every theme defines every semantic token — no theme relies on inheriting a value that was
   only correct for the default theme. Verify by diffing the token name lists per theme.
4. The contrast validator exits 0 for every theme, and runs in CI.
5. Reference depth ≤ 3 and no token is defined in two places.
6. Zero unused tokens, verified by the dead-token loop above.
7. Dark mode applies before first paint — no flash on load or on navigation, verified on an
   SSR build if SSR is enabled.
8. `governance.md` exists and names an owner, a contribution path and a deprecation policy
   with dates.
9. A theme can be swapped end to end with no component file edited. Demonstrate it.

## Degradation

- **Tailwind or another utility framework present.** Do not build a parallel system. Map
  tokens into that framework's theme configuration and keep one source of truth; report the
  duplication as a finding if one already exists.
- **An existing token pipeline (Style Dictionary, Figma export).** Audit only; propose changes
  as inputs to that pipeline. Never hand-edit generated files.
- **No designer available.** Extract the de-facto palette from the audit, propose the
  clustering with counts, and mark every colour decision as provisional pending review.
- **`superpowers` installed.** Use `superpowers:verification-before-completion` before
  claiming the exit criteria are met, and `superpowers:writing-plans` for a multi-sprint
  refactor.

## References

- `references/naming-and-tiers.md` — the full naming grammar, the complete semantic token set, worked examples, and the anti-patterns with the failure each one causes.
- `references/theming.md` — dark and high-contrast recipes, flash-of-wrong-theme prevention with and without SSR, per-theme completeness checking.
- `references/contrast-validation.md` — manifest format, thresholds, the maths, and CI wiring.
- `scripts/check-token-contrast.mjs` — dependency-free validator (Node ≥ 20).
