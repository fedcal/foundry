# Naming grammar, tiers and the anti-patterns

## The grammar

```
--<category>-<role>[-<variant>][-<state>]
```

| Part | Values | Example |
|---|---|---|
| category | `color`, `space`, `radius`, `size`, `font`, `elevation`, `motion`, `border`, `z` | `color` |
| role | what it is **for**, never what it looks like | `text`, `surface`, `border`, `action`, `focus-ring` |
| variant | the flavour of that role | `default`, `muted`, `subtle`, `strong`, `primary`, `danger`, `success`, `warning`, `info` |
| state | interaction state | `hover`, `active`, `disabled`, `visited`, `selected` |

Examples: `--color-text-muted`, `--color-action-primary-hover`,
`--color-surface-danger-subtle`, `--space-4`, `--radius-pill`, `--motion-enter`.

Rules:

- **Never encode appearance.** `--color-blue-button` dies the moment the button turns green.
- **Never encode a single component in the semantic tier.** `--color-checkout-header-bg` is a
  tier-3 token wearing a tier-2 name; it forces a new token per component forever.
- **Never encode a theme.** `--color-text-dark` is meaningless once there are three themes.
  The theme selects the value; the token name is theme-agnostic.
- Singular category, no plurals. `--color-…`, not `--colors-…`.
- Kebab case throughout. Mixed conventions in one system are a maintenance tax with no upside.

## Tier 1 — Primitives

Numbered scales only. The number is an ordinal on the scale, not a semantic.

```css
:root {
  /* colour ramps: 50 lightest -> 900 darkest, consistent across every ramp */
  --blue-50: …; --blue-100: …; --blue-500: …; --blue-600: …; --blue-700: …; --blue-900: …;
  --grey-0: #ffffff; --grey-50: …; --grey-900: …; --grey-1000: #000000;
  --red-…; --green-…; --amber-…;

  /* spacing: a 4px base, geometric enough to be memorable */
  --size-0: 0; --size-1: .25rem; --size-2: .5rem; --size-3: .75rem; --size-4: 1rem;
  --size-5: 1.25rem; --size-6: 1.5rem; --size-8: 2rem; --size-10: 2.5rem; --size-12: 3rem;

  /* type scale: numbered, not t-shirt sized — new sizes insert cleanly between numbers */
  --font-size-050: .75rem; --font-size-100: .875rem; --font-size-200: 1rem;
  --font-size-300: 1.25rem; --font-size-400: 1.5rem; --font-size-600: 2rem;
  --font-weight-regular: 400; --font-weight-medium: 500; --font-weight-bold: 700;
  --line-height-tight: 1.25; --line-height-base: 1.5;

  --duration-instant: 0ms; --duration-fast: 120ms; --duration-base: 200ms; --duration-slow: 320ms;
  --ease-standard: cubic-bezier(.2,0,0,1);
  --ease-decelerate: cubic-bezier(0,0,0,1);
  --ease-accelerate: cubic-bezier(.3,0,1,1);
}
```

T-shirt sizes (`sm`/`md`/`lg`) look friendlier and become unusable the first time a value is
needed between `md` and `lg`. Numeric scales leave room.

Keep the ramps consistent: if `blue` has 50–900, every ramp has 50–900, so a semantic token
can be re-pointed from `--blue-600` to `--green-600` without surprises.

## Tier 2 — Semantic

The complete starting set. Fewer than this and components will reach for primitives; many
more and nobody will know which to use.

```css
/* surfaces */
--color-surface-default        /* page background */
--color-surface-sunken         /* recessed areas, wells */
--color-surface-raised         /* cards, menus — in dark themes this carries elevation */
--color-surface-overlay        /* modal scrim */
--color-surface-accent         /* filled primary areas */
--color-surface-danger  --color-surface-warning  --color-surface-success  --color-surface-info
--color-surface-*-subtle       /* tinted background for the same intent */

/* text */
--color-text-default  --color-text-muted  --color-text-subtle
--color-text-on-accent  --color-text-on-danger
--color-text-link  --color-text-link-hover  --color-text-link-visited
--color-text-danger  --color-text-success  --color-text-disabled

/* borders */
--color-border-subtle  --color-border-default  --color-border-strong
--color-border-focus  --color-border-danger

/* actions */
--color-action-primary  --color-action-primary-hover  --color-action-primary-active
--color-action-secondary (+ -hover, -active)
--color-action-danger (+ -hover, -active)
--color-action-disabled

/* focus */
--color-focus-ring  --focus-ring-width  --focus-ring-offset

/* spacing, radius, elevation, motion */
--space-1 … --space-12
--radius-sm  --radius-md  --radius-lg  --radius-pill
--elevation-raised  --elevation-overlay
--motion-enter  --motion-exit  --motion-emphasis
```

Note `--color-text-on-accent`: without it, every component that puts text on a filled
background hard-codes white, and the dark and high-contrast themes break silently.

Note `--focus-ring-width` and `--focus-ring-offset`: focus indicators need to be tokens or
they get removed locally by whoever finds them ugly (WCAG 2.2 SC 2.4.7).

## Tier 3 — Component

Only for genuine divergence, and always defined on the component's own class so a consumer
can override one instance:

```css
.app-badge {
  --badge-bg: var(--color-surface-info-subtle);
  --badge-fg: var(--color-text-default);
  --badge-padding-inline: var(--space-2);
  background: var(--badge-bg);
  color: var(--badge-fg);
  padding-inline: var(--badge-padding-inline);
}
.app-badge--danger { --badge-bg: var(--color-surface-danger-subtle); --badge-fg: var(--color-text-danger); }
```

A tier-3 token that is a pure alias of a semantic token adds a hop and no capability. Delete it.

## Anti-patterns, and the failure each one causes

| Anti-pattern | What breaks |
|---|---|
| `--color-blue-600` used in a component | Dark mode and rebrand require editing components |
| `--color-primary` as the only action token | Hover, active and disabled states get hard-coded; contrast unmeasured |
| `--color-text-dark` / `--color-bg-light` | Meaningless once a third theme exists |
| Four or more tiers | Nobody can predict which tier to use; the system is bypassed |
| Reference chains deeper than 3 | Devtools shows `var(var(var(...)))`; debugging becomes archaeology |
| Same token defined in two files | Value depends on import order; changes appear to have no effect |
| Sass variables for theme values | Compiled away at build time; cannot be themed at runtime |
| Colour tokens only | Spacing and radius drift immediately; the "system" is a palette |
| Tokens with no owner | Nobody removes them; the set grows monotonically |
| `!important` inside token consumption | Signals that the tier boundaries are already broken |
| Naming a token after the first component that needed it | The second component either misuses it or duplicates it |

## Migration naming

While refactoring, keep both names working, mark the old one, and set a date:

```css
:root {
  --color-text-default: var(--grey-900);
  /* @deprecated remove 2026-11-30; use --color-text-default */
  --text-color: var(--color-text-default);
}
```

Then track removal:

```bash
grep -rn "@deprecated" src/styles/ | sed 's/.*remove \([0-9-]*\).*/\1/' | sort | head
grep -rc "var(--text-color)" src/app | awk -F: '{s+=$2} END {print "remaining uses:", s}'
```

Deprecation without a removal date is not deprecation — it is a second permanent name.

## How many tokens is right

If engineers regularly cannot find a token for what they need, the semantic layer is too
small. If they regularly cannot decide between two tokens, it is too large or badly named.
Both symptoms show up as literal values reappearing in component stylesheets — which is why
the adoption rate, measured per category, is the health metric that matters.
