# Mapping WCAG criteria to the instruments that reference them

> **Automated technical assessment. Not legal advice.** Which standard, version and level a given
> instrument requires is a legal question, and several instruments have been amended or are subject to
> rulemaking. Confirm the referenced version against the current official text before relying on any
> mapping below. The jurisdiction packs mark the relevant controls `unverifiedCitation` for this
> reason.

## Why the mapping matters

WCAG creates no obligation by itself. It becomes one when an instrument references it — and each
instrument references a **specific version at a specific level**, and adds requirements WCAG does not
contain. Three failures follow from ignoring this:

1. Claiming conformance under an instrument while testing against a different WCAG version.
2. Producing a WCAG-only audit for an instrument that requires more than WCAG.
3. Listing obsolete criteria, or omitting new ones, because the report template is old.

## Version drift — check both directions

| Direction | Risk |
|---|---|
| Tested newer than referenced (2.2 tested, 2.0 referenced) | Usually safe on criteria, but the *claim wording* must name the referenced version, and 2.2 removed SC 4.1.1 Parsing — a 2.0-referencing report expecting it will see a gap that is not one. |
| Tested older than referenced (2.0 tested, 2.1 or 2.2 referenced) | Unsafe. The criteria added in 2.1 (including reflow, text spacing, orientation, pointer gestures, status messages) and in 2.2 (including focus not obscured, dragging movements, target size, redundant entry, accessible authentication) were **not evaluated**. Mark them so. |

Record in the statement: the version tested, the version referenced by each applicable instrument, and
the criteria that are consequently "not evaluated".

## Criteria added in WCAG 2.2

These are the ones missing from reports built on older templates. **The level is not decoration:**
a statement claiming AA conformance must satisfy every Level A criterion as well, so mis-filing a
Level A criterion as AA understates the obligation. Verify each against the published
Recommendation — the conformance level is stated on the criterion's own page — and record the date
you checked.

| SC | Name | Level |
|---|---|---|
| 2.4.11 | Focus Not Obscured (Minimum) | AA |
| 2.5.7 | Dragging Movements | AA |
| 2.5.8 | Target Size (Minimum) | AA |
| 3.2.6 | Consistent Help | **A** |
| 3.3.7 | Redundant Entry | **A** |
| 3.3.8 | Accessible Authentication (Minimum) | AA |

WCAG 2.2 also adds criteria at Level AAA — 2.4.12 Focus Not Obscured (Enhanced), 2.4.13 Focus
Appearance and 3.3.9 Accessible Authentication (Enhanced). They are out of scope for an AA claim;
list them only if the statement claims AAA, and verify the level before you do.

And note: **SC 4.1.1 Parsing is obsolete in WCAG 2.2.** A report still listing it is out of date, which
tells a buyer something about the rest of it.

## Instruments and what they add beyond WCAG

Confirm each against the current text; these are the *kinds* of addition to look for, not verified
citations.

| Instrument | Typically references | Adds beyond WCAG |
|---|---|---|
| EN 301 549 (EU harmonised standard) | WCAG criteria for web content and documents | clauses for non-web software, hardware, real-time communication, biometrics, authoring tools, documentation and support services, and preservation of accessibility information |
| European Accessibility Act, as transposed | the accessibility requirements of the Directive, in practice via EN 301 549 | scope defined by product and service categories rather than by entity type; conformity documentation and retention duties |
| Web Accessibility Directive (EU public sector) | the harmonised standard | a prescribed accessibility statement with a model template, a feedback mechanism and an enforcement route |
| Italian Stanca Law and AgID guidelines | the technical requirements referenced by the guidelines | a declaration produced through the AgID procedure, a self-assessment where required, and an annual review cadence |
| Section 508 (US federal) | the Revised 508 Standards, which incorporate WCAG criteria | software, hardware, documentation and support requirements; an accessibility conformance report expected from suppliers |
| ADA (US) | no criteria in the statute itself; a DOJ rule adopts a WCAG level for Title II entities | scope determination (public entity vs public accommodation); compliance dates that must be confirmed |
| UK public sector accessibility regulations | the accessibility requirement, in practice a WCAG level | a statement in a prescribed model form, including known non-accessible content |
| Canada and Australia | provincial or general anti-discrimination duties, often referencing a WCAG level | accessibility plans, feedback processes and progress reports in some regimes |

**Practical consequence:** if the applicable instrument is EN 301 549 or Section 508, a WCAG-only
audit is structurally incapable of supporting the claim. The clauses without a WCAG equivalent are
"not evaluated", and the statement must say so.

## Surfaces WCAG-only audits miss

Enumerate these explicitly and either evaluate them or exclude them in writing:

| Surface | Why it is missed |
|---|---|
| Desktop application, installer, updater | not a web page; web tooling does not apply |
| Generated PDFs, invoices, exports | produced by a template nobody audits; tagging and reading order are the usual failures |
| Transactional and marketing email | rendered outside your control, and rarely tested at all |
| Native mobile app | platform accessibility APIs differ from the web; needs platform AT testing |
| Kiosk, terminal, hardware | physical criteria in EN 301 549 and Section 508 |
| Real-time communication (voice, video, chat) | captioning and relay requirements |
| Authoring surfaces | if users create content, the authoring tool has its own requirements |
| Documentation and help | frequently a separate site on a separate platform |
| The support channel | required to be accessible under several instruments; almost never tested |
| The accessibility statement page itself | the one page a challenger will certainly check |

## Recording the mapping

Produce one row per applicable instrument before drafting anything:

```
Instrument: EN 301 549
Referenced standard/version/level: [confirm against the current harmonised standard]
Tested against: WCAG 2.2 AA, 2026-08-14
Criteria not evaluated due to version drift: none
Non-WCAG clauses in scope: non-web software (desktop client), documentation, support services
Non-WCAG clauses evaluated: none  ← this is the gap that determines the claim
Consequent claim ceiling: partially conformant, at best
```

The line that matters is the last one. Establish the **claim ceiling** per instrument before drafting,
so the statement is written down to the evidence rather than edited down from an aspiration.
