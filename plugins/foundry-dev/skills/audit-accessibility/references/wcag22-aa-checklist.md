# WCAG 2.2 Level A + AA checklist, with Angular failure modes

Every success criterion at Level A and AA. Work top to bottom; record each as pass, fail or
not-applicable. **Recording a pass matters as much as recording a fail** — it is what makes
the audit falsifiable rather than a list of complaints.

Note: **SC 4.1.1 Parsing was removed in WCAG 2.2.** Do not report it. The criteria new in
2.2 are 2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7 and 3.3.8 (plus AAA criteria out of scope here);
they are the ones most often missing from older checklists and from tooling.

**EN 301 549 mapping (web content):** WCAG SC `X.Y.Z` → clause `9.X.Y.Z`. Confirm which
revision of EN 301 549 applies to your project before citing it; revisions differ in the
WCAG version they reference.

---

## 1. Perceivable

| SC | Level | How to test | Typical Angular failure |
|---|---|---|---|
| 1.1.1 Non-text Content | A | Every `img` has `alt`; decorative ones `alt=""`; icon-only controls have a name | `<mat-icon>` inside a button with no `aria-label`; `NgOptimizedImage` used without `alt` |
| 1.2.1 Audio-only / Video-only (Prerecorded) | A | Transcript for audio; transcript or audio track for video | Marketing video embedded with no transcript |
| 1.2.2 Captions (Prerecorded) | A | Captions on prerecorded video with audio | `<video>` with no `<track kind="captions">` |
| 1.2.3 Audio Description or Media Alternative | A | Description or full text alternative | — |
| 1.2.4 Captions (Live) | AA | Live streams captioned | — |
| 1.2.5 Audio Description (Prerecorded) | AA | Audio description track present | — |
| 1.3.1 Info and Relationships | A | Headings/lists/tables/groups are real semantics, not styled `div`s | Card "titles" as `<div class="title">`; form groups without `fieldset`/`legend`; `<table>` without `th scope` |
| 1.3.2 Meaningful Sequence | A | Disable CSS: does reading order still make sense? | `flex-direction: row-reverse`, CSS `order`, `grid-area` reordering visually only |
| 1.3.3 Sensory Characteristics | A | No instruction relies solely on shape, size or position | "Click the button on the right"; "the red field" |
| 1.3.4 Orientation | AA | Rotate the device: content is not locked | CSS locking to portrait; a viewport meta that blocks rotation |
| 1.3.5 Identify Input Purpose | AA | `autocomplete` tokens on fields collecting the user's own data | Reactive forms built without `autocomplete` on name, email, tel, address, cc-* fields |
| 1.4.1 Use of Color | A | Remove colour: is every state still distinguishable? | Validation shown only by a red border; chart series distinguished only by hue |
| 1.4.2 Audio Control | A | Autoplaying audio > 3 s has a stop control | — |
| 1.4.3 Contrast (Minimum) | AA | Measure: 4.5:1 body, 3:1 large text; all states | Placeholder and disabled-but-meaningful text; custom Material theme palettes never measured |
| 1.4.4 Resize Text | AA | 200% text-only zoom, no loss | `px` font sizes inside fixed-height buttons and chips |
| 1.4.5 Images of Text | AA | Text is text, not an image | Banner images with baked-in copy |
| 1.4.10 Reflow | AA | 320 CSS px wide (or 400% zoom): one-direction scrolling only | Fixed-width dialog panel classes; toolbars that do not wrap; `min-width` on table cells |
| 1.4.11 Non-text Contrast | AA | 3:1 for control boundaries, focus rings, meaningful graphics | Pale input borders; a focus ring whose colour was chosen for looks |
| 1.4.12 Text Spacing | AA | Apply the spacing override: nothing lost | `height` (not `min-height`) on text containers |
| 1.4.13 Content on Hover or Focus | AA | Tooltip is dismissible, hoverable, persistent | `matTooltip` on hover only, disappearing when the pointer moves toward it; no `Escape` to dismiss |

## 2. Operable

| SC | Level | How to test | Typical Angular failure |
|---|---|---|---|
| 2.1.1 Keyboard | A | Every action operable by keyboard alone | `(click)` on a `div`, `li`, `mat-card` or `tr` with no `tabindex`/role/key handler |
| 2.1.2 No Keyboard Trap | A | You can always `Tab`/`Shift+Tab`/`Escape` out | Hand-rolled modal with a focus trap and no restore; embedded third-party iframe widget |
| 2.1.4 Character Key Shortcuts | A | Single-key shortcuts disableable, remappable or focus-scoped | Global `HostListener('document:keydown')` binding `/` or `n` |
| 2.2.1 Timing Adjustable | A | Time limits extendable or removable | Session timeout with no warning and no extend |
| 2.2.2 Pause, Stop, Hide | A | Auto-updating content > 5 s can be paused | Auto-rotating carousel; live-polling table with no pause |
| 2.3.1 Three Flashes or Below | A | Nothing flashes > 3×/s | Loading animations, some confetti effects |
| 2.4.1 Bypass Blocks | A | Skip link works and moves focus; landmarks present | Skip link that scrolls but does not focus (missing `tabindex="-1"` on the target) |
| 2.4.2 Page Titled | A | Unique descriptive title, updated on **every** route change | Static `<title>` in `index.html`; `Router` `title` set on some routes only |
| 2.4.3 Focus Order | A | Order is logical; no positive `tabindex` | Focus lost to `<body>` when `@if` removes the focused element; route change leaves focus behind |
| 2.4.4 Link Purpose (In Context) | A | Link text alone or with its context describes the destination | "Read more" repeated in a card grid; bare URLs |
| 2.4.5 Multiple Ways | AA | ≥ 2 ways to reach a page (nav, search, sitemap, breadcrumb) | Deep app section reachable only through one menu path |
| 2.4.6 Headings and Labels | AA | Headings and labels are descriptive | "Details", "Information", "Section 2" |
| 2.4.7 Focus Visible | AA | Visible indicator on every focusable element | `outline: none` in a global reset with no `:focus-visible` replacement |
| 2.4.11 Focus Not Obscured (Min) | AA | Focused element not entirely hidden — retest mid-scroll | Sticky header covering the focused field; cookie banner; chat bubble over the footer CTA |
| 2.5.1 Pointer Gestures | A | Multipoint/path gestures have a single-pointer alternative | Swipe-only carousel; pinch-only zoom on a chart |
| 2.5.2 Pointer Cancellation | A | Action fires on up-event, and is abortable | Handlers bound to `mousedown`/`pointerdown` for destructive actions |
| 2.5.3 Label in Name | A | Accessible name contains the visible label text | `aria-label="Submit form"` on a button reading "Continue" |
| 2.5.4 Motion Actuation | A | Device-motion features have a UI alternative and can be disabled | Shake-to-undo with no button |
| 2.5.7 Dragging Movements | AA | Every drag has a single-pointer alternative | CDK drag-drop reordering with no move-up/move-down control; drag-only file upload; slider with no arrow-key or numeric input |
| 2.5.8 Target Size (Minimum) | AA | ≥ 24×24 CSS px or an exception; measure it | Icon buttons in dense table rows; chip remove "×"; pagination digits |

## 3. Understandable

| SC | Level | How to test | Typical Angular failure |
|---|---|---|---|
| 3.1.1 Language of Page | A | `<html lang>` set and correct | `lang="en"` left in place after i18n switches the app to another locale at runtime |
| 3.1.2 Language of Parts | AA | `lang` on foreign-language passages | Untranslated strings mixed into a localised page |
| 3.2.1 On Focus | A | Focus alone never changes context | Auto-opening a dialog or navigating on focus |
| 3.2.2 On Input | A | Changing a value alone never changes context | `<select>` that navigates on change; auto-submit on the last OTP digit without warning |
| 3.2.3 Consistent Navigation | AA | Repeated navigation is in the same order everywhere | Lazy-loaded feature rendering its own reordered header |
| 3.2.4 Consistent Identification | AA | The same function is named and iconed identically | "Delete" vs "Remove" vs a bin icon for the same action |
| 3.2.6 Consistent Help | A | Help/contact appears in the same relative order across pages | Support widget on some routes only |
| 3.3.1 Error Identification | A | Errors described in text | Red border only; error rendered far from the field |
| 3.3.2 Labels or Instructions | A | Programmatic label on every control; format rules stated up front | Placeholder used as the label; format rule revealed only after failing |
| 3.3.3 Error Suggestion | AA | Correction suggested when the rule is known | "Invalid input"; "Field is required" with no indication which rule failed |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Reversible, checked or confirmed | One-click irreversible delete; payment submitted with no review step |
| 3.3.7 Redundant Entry | A | Same information not requested twice in one process | Billing address re-typed after the shipping address with no "same as" option |
| 3.3.8 Accessible Authentication (Min) | AA | No cognitive function test without an alternative; paste allowed | `(paste)="$event.preventDefault()"` on password or OTP fields; image-recognition CAPTCHA with no alternative |

## 4. Robust

| SC | Level | How to test | Typical Angular failure |
|---|---|---|---|
| 4.1.2 Name, Role, Value | A | Every custom control exposes name, role, state; changes are exposed | `role="button"` without `tabindex` and key handlers; a custom toggle with no `aria-checked`; an accordion with no `aria-expanded` |
| 4.1.3 Status Messages | AA | Status announced without moving focus | Toast rendered with no `role="status"`/`aria-live`; validation summary appearing silently; result count updating silently |

*(4.1.1 Parsing was removed in WCAG 2.2 — do not report it.)*

---

## Static pre-screen

Cheap greps that find a large share of the above before the browser is even open. Each hit is
a candidate, not a verdict — confirm manually.

```bash
# 2.1.1 — interactivity on non-interactive elements
grep -rnE "\(click\)|\(keyup" src/ --include=*.html | grep -vE "<(button|a|input|select|textarea|label)" | head -40

# 2.4.7 — focus indicator removed
grep -rn "outline:\s*\(none\|0\)" src/ --include=*.scss --include=*.css | grep -v focus-visible

# 2.4.3 — positive tabindex
grep -rn "tabindex=\"[1-9]" src/ --include=*.html

# 1.1.1 — images without alt
grep -rnE "<img" src/ --include=*.html | grep -v "alt=" | head -20
grep -rnE "\[ngSrc\]|ngSrc=" src/ --include=*.html | grep -v "alt=" | head -20

# 4.1.2 — ARIA roles hand-rolled
grep -rn "role=\"" src/ --include=*.html | sort | uniq -c | sort -rn | head -20

# 3.3.2 — placeholder standing in for a label
grep -rn "placeholder=" src/ --include=*.html | head -30

# 1.3.5 — missing autocomplete on personal-data fields
grep -rnE "type=\"(email|tel|password)\"" src/ --include=*.html | grep -v autocomplete | head -20

# 3.3.8 — paste blocked
grep -rn "(paste)" src/ --include=*.html

# 2.4.2 — route titles
grep -rn "title:" src/**/*routes*.ts src/**/*-routing*.ts 2>/dev/null | wc -l
grep -rcE "path:\s*'" src/**/*routes*.ts src/**/*-routing*.ts 2>/dev/null

# 1.4.12 — fixed heights on text containers
grep -rnE "^\s*height:\s*[0-9]+(px|rem)" src/ --include=*.scss | grep -viE "icon|avatar|logo|min-height" | head -20

# 2.4.11 / 1.4.10 — sticky and fixed positioning
grep -rn "position:\s*\(sticky\|fixed\)" src/ --include=*.scss | head -20
```

Compare the last pair of commands: if the route count exceeds the `title:` count, some routes
do not set a title and SC 2.4.2 fails for those.

## Angular CDK helpers worth knowing about

Not a substitute for the audit, but they remove whole classes of failure:

- `LiveAnnouncer` (`@angular/cdk/a11y`) — polite/assertive announcements for SC 4.1.3.
- `cdkTrapFocus` / `FocusTrap` — dialog focus containment for SC 2.1.2 and 2.4.3.
- `FocusMonitor` — distinguishes keyboard from mouse focus, so the ring appears for the
  right input modality (SC 2.4.7).
- `InteractivityChecker` — programmatically test whether an element is focusable.
- `cdkMonitorSubtreeFocus` — track focus within a subtree.
- A custom `TitleStrategy` on the `Router` — one place to guarantee SC 2.4.2 on every route.

Using Angular Material does **not** confer conformance: your theme's contrast, the accessible
names you supply, your dialog focus restoration and your route-change handling all remain
yours to verify.
