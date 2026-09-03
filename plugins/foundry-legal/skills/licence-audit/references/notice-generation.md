# NOTICE and attribution generation

> **Automated technical assessment. Not legal advice.** What a specific licence requires you to
> reproduce, and where, is a legal question. This file describes a defensible default; have counsel
> confirm it for a product you actually ship.

## What attribution requires, in general

Most permissive licences require that the copyright notice and the licence text accompany the
distribution. Two consequences that people miss:

1. **A link is not reproduction.** "See the project's GitHub page" does not reproduce a licence text.
   Include the text.
2. **It must accompany the *distribution*, not the source repository.** A NOTICE file in your git
   repo does nothing for a user who received a container image or an app bundle.

Apache-2.0 adds a distinct obligation: if an upstream Apache-2.0 component ships a `NOTICE` file, its
relevant content must be propagated into your distribution's notices. Summarising it is not
propagating it.

## Structure of the generated file

```
THIRD-PARTY SOFTWARE NOTICES
<Product name> <version>
Generated <YYYY-MM-DD> from SBOM <digest or path>

This product includes third-party software. The components below are listed with
their licences. Full licence texts follow.

--------------------------------------------------------------------------------
MIT License
--------------------------------------------------------------------------------
  component-a 1.2.3   Copyright (c) 2021 A. Author
  component-b 4.0.0   Copyright (c) 2019-2024 B. Corp

<full MIT licence text, once>

--------------------------------------------------------------------------------
Apache License 2.0
--------------------------------------------------------------------------------
  component-c 2.1.0   Copyright 2020 C Foundation

<full Apache-2.0 licence text, once>

Upstream NOTICE content:
  component-c:
    <verbatim upstream NOTICE content>

--------------------------------------------------------------------------------
Dual-licensed components — elected option
--------------------------------------------------------------------------------
  component-d 3.3.0   available under "MIT OR Apache-2.0"; elected: MIT
```

Rules:

- **Group by licence, then alphabetically.** One licence text per licence, not per component.
- **Copyright lines verbatim** from the component's own files. Do not reconstruct them from the
  package author field — that field is frequently wrong and is not the copyright notice.
- **Elections recorded** for every dual-licensed component. An unrecorded election is a gap, because
  the obligations differ between the options.
- **Generation date and SBOM reference** in the header, so the file can be regenerated and diffed.
- **Deterministic ordering**, so a regeneration produces a reviewable diff rather than noise.

## Special cases

| Case | Handling |
|---|---|
| Assets (fonts, icons, images) | separate section; OFL requires the licence text and respects reserved font names — record whether the build subsets or renames the font |
| Data and datasets | separate section; share-alike data licences may propagate to outputs |
| Model weights | separate section; record use restrictions, not just the licence name — these are frequently not OSS |
| GPL/LGPL components in a distributed artefact | attribution is **not** sufficient; a written offer or provision of corresponding source is required. Flag prominently rather than burying it in the notices file. |
| Components with a custom licence text | reproduce it in full; do not map it to the nearest SPDX identifier |
| Public domain dedications | list the component; no text required, but listing costs nothing and avoids questions |

## Where it must be delivered

Decide per conveyance, and verify the delivery rather than assuming it:

| Conveyance | Delivery point | How to verify |
|---|---|---|
| Container image | a file inside the image, at a documented path | `docker run --rm --entrypoint sh img -c 'cat /NOTICE'` |
| Binary / installer | a file installed alongside the binary, or an `--licenses` flag | run the installed artefact |
| Mobile app | a "Third-party licences" screen reachable from settings | open it on a device or emulator |
| Web application | a `/licenses` page or a footer link | fetch the URL |
| npm/PyPI/Maven package | included in the published archive | `npm pack` then inspect; `unzip -l` the wheel or jar |
| SaaS only | usually no distribution obligation, but an AGPL component changes this entirely | re-read the conveyance determination |
| Model weights | a notices file alongside the weights, plus the model card | check the release assets |

## Verifying the build did not strip it

The most common attribution failure is a build step discarding what the repository correctly
contains. Check the artefact after every change to the build:

```
# JS bundles: banners preserved?
grep -c '@license' dist/*.js

# jars: shading keeps NOTICE?
unzip -l app.jar | grep -iE 'notice|license'

# container: anything at all?
docker run --rm --entrypoint sh image:tag -c 'find / -iname "NOTICE*" -o -iname "LICENSE*" 2>/dev/null | head'
```

Wire one of these into CI as an assertion. An attribution file that regresses silently is worse than
none, because the audit that found it was clean will be cited later.

## Regeneration discipline

- Regenerate on every dependency change, not on every release — dependency changes are when the
  content changes.
- Commit the generated file so the diff is reviewable.
- Keep the generation command in the repository so anyone can reproduce it, and record it in the
  header of the generated file.
- Never hand-edit the generated file. If a correction is needed, fix the input or the generator; a
  hand edit will be lost at the next regeneration and nobody will notice.

## What this does not produce

- Compliance with GPL/LGPL corresponding-source obligations — a notices file does not satisfy them.
- A written offer for source, where one is required.
- An SBOM. The SBOM is the input; the notices file is a human-readable derivative and does not
  replace the machine-readable artefact that CRA-style controls and customers ask for.
- Any statement about whether your use of a component is permitted at all. Attribution is the easy
  obligation; permission is the hard one.
