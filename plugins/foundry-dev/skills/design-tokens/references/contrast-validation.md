# Contrast validation: manifest, thresholds, maths and CI wiring

The validator is `${CLAUDE_SKILL_DIR}/scripts/check-token-contrast.mjs` — Node ≥ 20,
standard library only, no install, no network.

```bash
node "${CLAUDE_SKILL_DIR}/scripts/check-token-contrast.mjs" \
  src/styles/tokens.css --manifest src/styles/tokens.manifest.json --json .foundry/scratch/contrast.json
```

Exit code `0` = every declared pair passes on every theme. `1` = at least one failure or one
unresolvable token. `2` = usage error (no CSS file, no manifest).

## Manifest format

Place `tokens.manifest.json` next to the tokens file; the validator finds it automatically.

```json
{
  "thresholds": {
    "text": 4.5,
    "large-text": 3,
    "non-text": 3,
    "enhanced": 7
  },
  "themeThresholds": {
    "hc": { "text": 7, "large-text": 4.5, "non-text": 4.5 }
  },
  "pairs": [
    { "foreground": "--color-text-default",  "background": "--color-surface-default", "kind": "text" },
    { "foreground": "--color-text-muted",    "background": "--color-surface-default", "kind": "text" },
    { "foreground": "--color-text-default",  "background": "--color-surface-raised",  "kind": "text" },
    { "foreground": "--color-text-default",  "background": "--color-surface-sunken",  "kind": "text" },
    { "foreground": "--color-text-on-accent","background": "--color-surface-accent",  "kind": "text" },
    { "foreground": "--color-text-link",     "background": "--color-surface-default", "kind": "text" },
    { "foreground": "--color-text-danger",   "background": "--color-surface-default", "kind": "text" },
    { "foreground": "--color-text-default",  "background": "--color-surface-danger-subtle", "kind": "text" },

    { "foreground": "--color-border-default","background": "--color-surface-default", "kind": "non-text" },
    { "foreground": "--color-focus-ring",    "background": "--color-surface-default", "kind": "non-text" },
    { "foreground": "--color-focus-ring",    "background": "--color-surface-accent",  "kind": "non-text" },
    { "foreground": "--color-action-primary","background": "--color-surface-default", "kind": "non-text" },

    { "foreground": "--color-text-default",  "background": "--color-surface-default", "kind": "enhanced", "min": 7 }
  ]
}
```

`kind` selects the threshold; an explicit `min` on a pair overrides it.
`themeThresholds` raises the bar for a specific theme (typically `hc`).

### Pairs people forget, and that fail most often

- Text on **every** surface, not just the default one: raised, sunken, accent, and every
  `*-subtle` tinted background.
- The focus ring against **each** surface it can appear on, including accent-filled buttons.
  A focus ring that is invisible on the primary button fails SC 2.4.11 in effect and SC
  1.4.11 by measurement.
- Placeholder text. It is text and it must reach 4.5:1, which most default greys do not.
- `--color-text-on-accent` against every accent surface (`primary`, `danger`, `success`,
  `warning`). Warning surfaces are usually amber and white text on amber almost never passes.
- Input borders against the form background (SC 1.4.11).
- Link text against body text — not a WCAG threshold, but if links are distinguished from
  surrounding text by colour alone, SC 1.4.1 requires a second cue (underline).
- Chart series colours against the plot background, and against each other.

## Thresholds and the criteria behind them

| Kind | Ratio | Applies to | Criterion |
|---|---|---|---|
| `text` | 4.5:1 | Body text, labels, placeholders, error text | WCAG 2.2 SC 1.4.3 (AA) |
| `large-text` | 3:1 | ≥ 24 px, or ≥ 18.66 px bold | WCAG 2.2 SC 1.4.3 (AA) |
| `non-text` | 3:1 | Control boundaries, focus indicators, meaningful icons and graphics | WCAG 2.2 SC 1.4.11 (AA) |
| `enhanced` | 7:1 | Optional target; required for a high-contrast theme | WCAG 2.2 SC 1.4.6 (AAA) |

Exempt from 1.4.3: disabled controls, purely decorative text, logotypes, and text that is
part of a picture conveying nothing. Do not exempt something merely because it is small or
secondary — "muted" text is still text.

## The maths

WCAG contrast uses relative luminance, not perceived lightness:

```
L = 0.2126·R + 0.7152·G + 0.0722·B      (each channel linearised)
linearise(c) = c/12.92                  if c <= 0.04045
             = ((c + 0.055)/1.055)^2.4  otherwise
ratio = (max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)
```

Ratios range from 1:1 (identical) to 21:1 (black on white).

Two consequences worth knowing:

- The formula is **not** perceptually uniform. Some pairs that clear 4.5:1 still read poorly
  (notably saturated blues on black), and some that fail are legible. The threshold is the
  legal and testable line; passing it is necessary, not sufficient. Judge readability too.
- **Alpha is not handled** by the formula. A semi-transparent foreground must be composited
  against its actual backdrop before measuring. The validator treats `rgba()` by using the
  RGB channels only — if a token uses alpha over a non-trivial backdrop, compute the
  composited value yourself and declare that as the pair, or the report will be optimistic.

## Non-solid backgrounds

Gradients, images and video behind text cannot be validated from tokens. Measure the
**worst-case** pixel under the text and either (a) declare a token for that worst case and
validate against it, or (b) add a scrim token
(`--color-surface-overlay: rgb(0 0 0 / .6)`) and validate against the composited result.
Record the method used in the manifest as a comment field; automated tools report
`incomplete` here and a human must decide.

## CI wiring

```yaml
- name: Design token contrast
  run: |
    node plugins/foundry-dev/skills/design-tokens/scripts/check-token-contrast.mjs \
      src/styles/tokens.css --json contrast-report.json
```

Or as an npm script the whole team can run locally:

```json
{ "scripts": { "tokens:contrast": "node ./tools/check-token-contrast.mjs src/styles/tokens.css" } }
```

Make it a **required** check. A contrast gate that can be merged past is a contrast gate that
will be merged past, and the failures it catches are exactly the ones that are cheap now and
expensive after an accessibility audit.

## What this gate does not prove

It validates declared pairs of solid token colours. It says nothing about:

- text rendered over images, gradients or video (see above);
- colour used as the only carrier of meaning (SC 1.4.1);
- whether the pair is actually used together in the product — a pair that passes on paper and
  is never used adds no value, and a pair used in the product but absent from the manifest is
  invisible to the gate;
- anything outside colour: focus visibility (SC 2.4.7), target size (SC 2.5.8), reflow.

Keeping the manifest honest is the ongoing cost. Whenever a component introduces a new
foreground/background combination, the manifest gains a pair. Reviewers should check for that
the way they check for a missing test. `audit-accessibility` covers everything this gate
structurally cannot.
