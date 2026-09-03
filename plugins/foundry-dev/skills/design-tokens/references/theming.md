# Theming: dark mode, high contrast, and not flashing the wrong theme

## Theme selection strategy

Support three inputs, in this precedence order:

1. An explicit user choice, persisted (`localStorage`, or a server-side preference if the
   user is authenticated and you have SSR).
2. The OS preference via `prefers-color-scheme`.
3. The product default.

```html
<html data-theme="light" style="color-scheme: light dark">
```

`color-scheme` makes native form controls, scrollbars and the default canvas follow the
theme. Without it, a dark page renders white select dropdowns and white scrollbars.

## Applying the theme before first paint

A theme applied by Angular after bootstrap flashes. Set the attribute in a small inline
script in `index.html`, before any stylesheet that depends on it:

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('theme');
      var system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = saved || system;
    } catch (e) { /* private mode: fall through to the CSS default */ }
  })();
</script>
```

Keep it inline and tiny — an external file introduces a request before first paint, which is
the problem you are solving. If a strict CSP is in force, this script needs a nonce or a
hash; coordinate with whoever owns the CSP rather than weakening it.

**With SSR** the server cannot know the preference. Options, in preference order:

1. Render a theme-neutral shell (no colour-dependent content above the fold) and let the
   inline script set the theme before hydration.
2. Store the preference in a cookie the server can read, and render `data-theme` server-side.
   This is the only approach that eliminates the flash entirely for returning users.
3. Accept a single-frame flash for first-time visitors and document it.

Never toggle the theme from an Angular `effect()` that runs after hydration — that guarantees
a visible flash on every full page load.

## Writing a theme

Override **only** semantic tokens. If a component needs to change, the semantic layer is
incomplete — add the missing role rather than patching the component.

```css
:root, [data-theme='light'] {
  --color-surface-default: var(--grey-0);
  --color-surface-raised:  var(--grey-0);
  --color-text-default:    var(--grey-900);
  --color-text-muted:      var(--grey-600);
  --color-action-primary:  var(--blue-600);
  --elevation-raised: 0 1px 2px rgb(0 0 0 / .08), 0 2px 8px rgb(0 0 0 / .06);
}

[data-theme='dark'] {
  --color-surface-default: #14161c;   /* not #000 */
  --color-surface-sunken:  #0d0f14;
  --color-surface-raised:  #1c1f27;   /* elevation via lightness, not shadow */
  --color-text-default:    #f2f3f5;
  --color-text-muted:      #a5abbb;   /* grey-600 fails 4.5:1 here — re-measured, not inverted */
  --color-action-primary:  #7fa5ee;   /* blue-600 fails here too */
  --color-border-subtle:   #2a2e39;
  --elevation-raised: 0 1px 2px rgb(0 0 0 / .5);
}

[data-theme='hc'] {
  --color-surface-default: #000000;
  --color-text-default:    #ffffff;
  --color-text-muted:      #ffffff;   /* no muted text in high contrast */
  --color-border-subtle:   #ffffff;   /* every boundary visible */
  --focus-ring-width:      3px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* repeat the dark overrides */ }
}
```

The `:not([data-theme='light'])` guard is what lets an explicit user choice beat the OS
preference. Without it, a user who chose light mode on a dark-mode OS gets dark mode anyway.

Duplicating the dark block between the attribute selector and the media query is the price
of supporting both. Generate both from one source if you have a build step; otherwise keep
them adjacent and add a completeness check (below) so they cannot drift.

## Dark mode is not an inversion — the rules

1. **Re-measure every pair.** Run the validator against every theme. A mid-tone that passes
   4.5:1 on white typically lands near 3:1 on a dark surface.
2. **Desaturate saturated hues.** Fully saturated colours on dark backgrounds vibrate and are
   fatiguing. Lighten and desaturate.
3. **Never pure black as a surface.** It maximises halation for astigmatic readers and leaves
   no room below it for a sunken surface.
4. **Elevation is lightness, not shadow.** Shadows are nearly invisible on dark surfaces.
   Higher surfaces are lighter; that is what `--color-surface-raised` is for.
5. **Reduce large white areas.** Pure white body text at full weight on dark is too heavy;
   a slightly off-white and a lighter weight read better.
6. **Images and illustrations need a plan.** Either dark variants, or a neutral plate behind
   them. Logos with white knockouts disappear on light and vice versa.
7. **Charts need a separate palette.** A categorical palette tuned for white backgrounds
   fails 3:1 (SC 1.4.11) on dark for at least one series, every time.

## High contrast and forced colours

- A `hc` theme targeting 7:1 everywhere serves users who need more than AA.
- Separately, respect Windows/browser forced-colours mode:

```css
@media (forced-colors: active) {
  .app-button { border: 1px solid ButtonText; forced-color-adjust: none; }
  .app-focus-ring { outline: 2px solid Highlight; }
}
```

In forced-colours mode the OS replaces your colours. Anything that conveyed meaning through
background colour alone becomes invisible — which is another reason colour must never be the
sole carrier of meaning (SC 1.4.1). Test with at least one forced-colours pass.

## Per-theme completeness check

Every theme must define every semantic token it needs to override, and no theme may rely on
inheriting a value that was only correct for the default theme.

```bash
node -e '
const fs=require("node:fs");
const css=fs.readFileSync(process.argv[1],"utf8").replace(/\/\*[\s\S]*?\*\//g,"");
const scopes={};
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const sel=m[1].trim();
  const names=[...m[2].matchAll(/(--[a-z0-9-]+)\s*:/g)].map(x=>x[1]);
  if (names.length) (scopes[sel] ??= new Set()).forEach; scopes[sel]=new Set([...(scopes[sel]||[]),...names]);
}
const base=[...(scopes[":root"]||scopes[":root, [data-theme='light']"]||[])];
for (const [sel,set] of Object.entries(scopes)) {
  if (!/data-theme/.test(sel)) continue;
  const missing=base.filter(n=>/^--color-/.test(n) && !set.has(n));
  console.log(sel, "overrides", set.size, "| colour tokens not overridden:", missing.length);
  if (missing.length) console.log("  ", missing.join(" "));
}' src/styles/_semantic.css
```

A colour token not overridden in the dark theme is not necessarily wrong — some are
genuinely theme-independent — but every one should be a deliberate decision, so review the
list rather than letting it grow silently.

## Theme switching at runtime in Angular

```ts
type ThemeName = 'light' | 'dark' | 'hc';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #doc = inject(DOCUMENT);
  readonly #current = signal<ThemeName>(
    (this.#doc.documentElement.dataset['theme'] as ThemeName) ?? 'light',
  );
  readonly current = this.#current.asReadonly();

  set(theme: ThemeName): void {
    this.#doc.documentElement.dataset['theme'] = theme;
    this.#current.set(theme);
    try { localStorage.setItem('theme', theme); } catch { /* private mode */ }
  }
}
```

Inject `DOCUMENT` rather than touching the global `document` — the global does not exist
during SSR and will crash the server render. Guard `localStorage` too: it throws in some
privacy modes rather than returning null.

The theme control itself must be reachable and announced: a real `<button>` (or a radio
group for three or more options) with an accessible name that states the current state.
An unlabelled icon toggle fails WCAG 2.2 SC 4.1.2.

## Transitions between themes

Animating a theme swap looks polished and is a trap: transitioning `background-color` on
every element causes a long paint and, for some users, discomfort. If you do it, scope it
tightly and honour the reduced-motion preference:

```css
@media (prefers-reduced-motion: no-preference) {
  .theme-transition, .theme-transition * {
    transition: background-color var(--duration-fast), color var(--duration-fast);
  }
}
```

Add the class, swap the theme, remove the class after the duration. Leaving it on permanently
makes every unrelated colour change animate.
