# Manual checks — the part automation cannot do

Each section gives the exact procedure, the record format, and the success criterion the
result maps to. Fill the record sheets; they are the audit's evidence.

---

## 1. Focus order sheet (SC 2.4.3, 2.4.7, 2.4.11, 2.1.1, 2.1.2)

Load the page fresh. Click the URL bar, then press `Tab` and record every stop until focus
leaves the document.

| # | Element | Accessible name (as announced) | Indicator visible? | Obscured? | Matches visual order? |
|---|---|---|---|---|---|
| 1 | `a.skip-link` | "Skip to main content" | yes | no | yes |
| 2 | ... | | | | |

Verdicts:

- Any row where the visual position jumps backwards or into an unrelated region → **SC 2.4.3**.
- Any row with no visible indicator → **SC 2.4.7 Focus Visible (AA)**, severity `high`.
- Any row where a sticky header, banner, toast or chat widget **entirely** hides the focused
  element → **SC 2.4.11 Focus Not Obscured (Minimum) (AA)**. Repeat the walk with the page
  scrolled to 50% — this failure is invisible from the top of the page.
- Any element reachable by mouse but absent from the sheet → **SC 2.1.1 Keyboard (A)**,
  `critical`.
- Any point where `Tab`, `Shift+Tab` and `Escape` all fail to move focus out →
  **SC 2.1.2 No Keyboard Trap (A)**, `critical`, always.

Additional keyboard checks:

- Composite widgets (tabs, menus, listboxes, grids, trees) are **one** tab stop with arrow-key
  navigation inside. A tab list where every tab is a separate tab stop contradicts the ARIA
  APG Tabs pattern and is reported against the pattern plus SC 2.4.3.
- `Escape` closes every dialog, popover and menu, and returns focus to the trigger.
- Single-character shortcuts (`/` for search, `j`/`k` navigation) must be disableable,
  remappable, or active only on focus — **SC 2.1.4 Character Key Shortcuts (A)**.
- Custom controls respond to `Enter` **and** `Space` where the native equivalent does.

---

## 2. Screen reader script

Name the exact pairing and versions in every finding's `failureScenario`. Record the
**actual announced text**, verbatim. Never paraphrase, never invent.

### Key commands you will need

| Action | NVDA (Firefox) | VoiceOver (Safari) | JAWS (Chrome) |
|---|---|---|---|
| Start / stop | `Ctrl+Alt+N` / `Insert+Q` | `Cmd+F5` | launch / `Insert+F4` |
| Read next item | `Down arrow` | `VO+Right` | `Down arrow` |
| Headings list | `Insert+F7` → Headings | Rotor `VO+U` → Headings | `Insert+F6` |
| Landmarks list | `Insert+F7` → Landmarks | Rotor → Landmarks | `Insert+Ctrl+R` |
| Links list | `Insert+F7` → Links | Rotor → Links | `Insert+F7` |
| Form fields list | `Insert+F7` → Form fields | Rotor → Form controls | `Insert+F5` |
| Next heading / next form field | `H` / `F` | `VO+Cmd+H` | `H` / `F` |
| Toggle browse / focus mode | `Insert+Space` | (interaction mode `VO+Shift+Down`) | `Insert+Z` |

VoiceOver `VO` = `Ctrl+Option`. On iOS use swipe-right to advance and the rotor by twisting
two fingers; on Android TalkBack, swipe right and use the reading-controls gesture.

### Per-page script

1. **Full read-through** in browse mode from the top. Flag anything announced as
   "clickable", "button" with no name, "graphic" with a filename, "link" with a raw URL, or
   any raw ID string. → SC 1.1.1, 2.4.4, 4.1.2.
2. **Headings list.** Does the outline alone describe the page? One `h1`, no skipped levels,
   headings that describe their section. → SC 1.3.1, 2.4.6.
3. **Landmarks list.** `banner`, `navigation`, `main`, `contentinfo` present; duplicates
   distinguished by accessible name. → SC 1.3.1, 2.4.1.
4. **Links list out of context.** Any "click here", "read more", "here" or bare URL fails
   **SC 2.4.4 Link Purpose (In Context) (A)** in practice even where technically excusable —
  report it and let the team decide.
5. **Form fields list.** Every control has a name. Tab to each and record:
   name, role, required state, described-by help text. → SC 3.3.2, 4.1.2.
6. **Label in Name.** For each control with a visible label, the announced name must contain
   that visible text. A button reading "Send" that announces "Submit form" fails
   **SC 2.5.3 (A)** and breaks voice control. Grep aid:
   `grep -rn "aria-label=" src/ --include=*.html | head -40` — then compare each against the
   visible text next to it.
7. **Dynamic updates.** Trigger each of: a toast, a validation summary after a failed submit,
   a search result count, a loading→loaded transition, an auto-save confirmation. Each must
   be announced **once**, without moving focus. Silence → **SC 4.1.3 Status Messages (AA)**.
   Announced twice → an over-eager live region; also a finding.
8. **Custom widgets.** For each, compare against its ARIA APG pattern: required roles, all
   states (`aria-expanded`, `aria-selected`, `aria-checked`, `aria-current`, `aria-invalid`),
   and the full keyboard map. Record which states are missing.
9. **Route change.** Navigate with the screen reader running. The new page must be
   identifiable: title updated (**SC 2.4.2**), focus moved to the new content
   (**SC 2.4.3**), and ideally announced via a live region (**SC 4.1.3**). Announcing none
   of the three is the most common SPA failure and is at least `high`.
10. **Modal dialog.** Open it: is it announced, is focus inside, is the background inert, does
    `Escape` close it, does focus return to the trigger? → SC 2.4.3, 4.1.2, APG Modal Dialog.

### Recording format

```
AT: NVDA 2024.x + Firefox 1xx (Windows 11)
Page: /checkout/payment
Step: Tab to card number field
Expected: "Card number, edit, required, 16 digits, no spaces needed"
Actual:   "edit, blank"
Fails:    WCAG 2.2 SC 3.3.2 Labels or Instructions (A); SC 4.1.2 Name, Role, Value (A)
```

---

## 3. Reflow and zoom procedure (SC 1.4.10, 1.4.4, 1.4.12)

**Reflow (1.4.10, AA).** Two equivalent methods; use either, record which:

- Set the browser window / devtools viewport to **320 × 256 CSS px**.
- Or set the viewport to 1280 × 1024 and browser zoom to **400%**.

Requirement: content and functionality remain available with scrolling in **one** direction
only. Walk the whole page: is anything clipped, overlapping, off-screen, or requiring
horizontal scrolling to read a line of text? Are all controls still reachable?

Legitimate exceptions (must be claimed explicitly): data tables, maps, diagrams, video,
interactive canvases, and toolbars where the 2D layout is essential to meaning.

Angular-specific offenders: fixed-width `mat-dialog` panel classes, `min-width` on table
cells, horizontally laid-out toolbars without wrapping, and side navigation that does not
collapse.

**Resize text (1.4.4, AA).** Increase text size to 200% using the *text-only* setting where
the browser offers one (Firefox: Settings → Zoom → Zoom text only). Look for clipping in
buttons, chips, badges and fixed-height cards.

**Text spacing (1.4.12, AA).** Apply the override stylesheet:

```css
* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-block-end: 2em !important; }
```

Nothing may be lost or overlap. `height` on a text container fails; `min-height` passes.

**Orientation (1.3.4, AA).** On a touch device, rotate: the content must not be locked to
one orientation unless that orientation is essential.

---

## 4. Target size (SC 2.5.8, AA)

Minimum 24 × 24 CSS px, or an exception. Measure with the console snippet in `SKILL.md`
step 5, and record actual numbers.

Spacing exception: a target smaller than 24 px passes if a 24 px-diameter circle centred on
it does not intersect the circle of any other target. Verify geometrically, not by feel.

Other exceptions: an equivalent control of sufficient size exists elsewhere on the page; the
target is inline within a sentence or block of text; the size is set by the user agent and
not modified by the author; a particular presentation is essential.

Note: 24 px is the AA minimum. 44 px is the AAA level and a common design-system norm —
recommend it, but never report a 30 px target as an AA failure.

---

## 5. Contrast maths (SC 1.4.3, 1.4.11) — no dependency required

```js
const srgb = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum  = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg);
  return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)); };

ratio([117, 117, 117], [255, 255, 255]);   // 4.61 -> passes 4.5:1 body text
```

Thresholds:

| Content | Minimum |
|---|---|
| Body text | 4.5:1 |
| Large text: ≥ 24 px, or ≥ 18.66 px bold | 3:1 |
| UI component boundaries, focus indicators, meaningful graphics (SC 1.4.11) | 3:1 |
| Disabled controls | exempt — but if it *looks* disabled and is not, that is a different failure |

Check every state: default, hover, focus, active, visited, placeholder, and error. Placeholder
text and the focus ring are the two most frequently failing surfaces. Over a gradient or
image, measure the **worst-case** pixel under the text, not the average.

Colour alone (SC 1.4.1): required-field markers, validation states, chart series, status
chips and links inside body text must carry a second cue — an icon, a text label, a pattern,
or an underline.

---

## 6. Forms, errors and authentication (SC 3.3.x)

- Submit an empty form: are errors identified in text (**3.3.1**), is a correction suggested
  where the rule is known (**3.3.3**), and is focus or an announcement directed to them?
- Does the error message name the field and give a valid example? "Invalid input" fails 3.3.3
  in substance even where it technically identifies an error.
- Is entered data preserved after a failed submit? Losing it is a **3.3.4** problem for legal,
  financial and data-modifying transactions, and a usability failure everywhere else.
- Is any information requested twice within the same process? → **SC 3.3.7 Redundant Entry (A)**.
- Can the user **paste** into password, one-time-code and card fields? Blocking paste breaks
  password managers and fails **SC 3.3.8 Accessible Authentication (Minimum) (AA)** in effect.
- Is there any cognitive function test (puzzle, transcription, memory) with no alternative?
  → **SC 3.3.8**.
- Is help available consistently in the same relative place across pages?
  → **SC 3.2.6 Consistent Help (A)**.
- Does changing a control's value automatically submit, navigate or change context?
  → **SC 3.2.2 On Input (A)**.

---

## 7. Motion, timing and media

- Any time limit adjustable, extendable or turnable off? → **SC 2.2.1 (A)**. Session timeouts
  need a warning and an extension mechanism.
- Anything auto-playing, scrolling, blinking or updating for more than 5 s has a pause /
  stop / hide control? → **SC 2.2.2 (A)**.
- Nothing flashes more than three times per second → **SC 2.3.1 (A)**.
- Does the UI honour `prefers-reduced-motion`? Not a Level AA requirement (2.3.3 is AAA), but
  report parallax and large transitions without it as `low`.
- Prerecorded video has captions (**1.2.2, A**) and audio description (**1.2.5, AA**);
  live video has captions (**1.2.4, AA**).
