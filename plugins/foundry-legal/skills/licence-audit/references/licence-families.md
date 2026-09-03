# Licence families and high-risk patterns

> **Automated technical assessment. Not legal advice.** Licence interpretation is legal work, and
> reasonable lawyers disagree about several of the questions below — particularly linkage. This file
> describes how to *reason*, and what to escalate. It does not tell you what a licence means in your
> situation.

## Reason from the obligation, not from a matrix

A memorised compatibility matrix produces confident wrong answers because compatibility is not a
property of a pair of licences. It is a property of a pair of licences **plus** the conveyance
**plus** the combination mechanism. Always reconstruct: *what does this licence require, when the
software reaches someone else in this particular way?*

## Families

| Family | Typical members | Obligation when triggered | Triggered by |
|---|---|---|---|
| Public domain / near-zero | Unlicense, CC0, 0BSD, WTFPL | effectively none | — |
| Permissive | MIT, BSD-2/3-Clause, ISC | preserve copyright notice and licence text with the distribution | distribution |
| Permissive + patent | Apache-2.0 | as above, plus propagate upstream NOTICE content, plus a patent grant that terminates on patent litigation | distribution |
| Weak copyleft, file-scoped | MPL-2.0, EPL-2.0, CDDL | modifications to **covered files** must be offered under the same licence; the larger work may remain proprietary | distribution |
| Weak copyleft, library-scoped | LGPL-2.1, LGPL-3.0 | the library remains under its licence and recipients must be able to replace it with a modified version; static linking raises the bar substantially | distribution |
| Strong copyleft | GPL-2.0, GPL-3.0 | the whole work based on the program, when conveyed, must be offered under the same licence with corresponding source | distribution |
| Network copyleft | AGPL-3.0 | corresponding source must be offered to users interacting with it **over a network** | network interaction |
| Source-available (not OSS) | BUSL-1.1, SSPL, Elastic License, Commons Clause, PolyForm | field-of-use, competition or scale restrictions; must be read individually, no family rule applies | varies, read the text |
| Non-code assets | CC-BY, CC-BY-SA, CC-BY-NC, OFL, ODbL | attribution, share-alike, and in the NC case a prohibition that is fatal to commercial use | distribution and often display |
| Model and data licences | RAIL variants, model-specific licences, dataset terms | use restrictions, downstream propagation of restrictions, output ownership terms | varies; often use, not distribution |

Two entries deserve emphasis because they are routinely mis-shelved:

- **SSPL, BUSL and Elastic License are not open source.** They may still be perfectly usable for you,
  but a policy that says "we only use OSS" is being violated, and a customer's policy may reject them.
- **CC-BY-NC in a commercial product** is a hard stop that is very often missed because the asset is
  an icon or a photo that nobody inventoried.

## The eight patterns that create real risk

Hunt in this order. The first three stop releases.

### 1. Strong or network copyleft inside a conveyed proprietary artefact

A GPL or AGPL library linked into a shipped binary, bundled into a container image you distribute, or
embedded in a mobile app bundle. Report `critical` with the component, the linkage mechanism and the
conveyance path.

### 2. AGPL anywhere in a network service

Including as a transitive dependency of a build-time tool that ended up in the **runtime** image.
Check the runtime image, not the source tree. Also check for AGPL components pulled in as plugins or
drivers at runtime.

### 3. Statically linked LGPL in a distributed binary

The relink requirement is what static linking makes hard. Look for statically linked native
dependencies, Go binaries with cgo, Rust builds vendoring C libraries, and bundled `.so`/`.dll` files.

### 4. Apache-2.0 NOTICE dropped by the build

The licence requires propagating upstream NOTICE content. These silently discard it: JS bundlers and
minifiers, `go build`, jar shading (`maven-shade-plugin`, `shadowJar`), multi-stage container builds
that copy only the binary, and native image compilation. **Check the artefact, not the repository.**

```
# extract the artefact and look for what should be there
unzip -l app.jar | grep -i notice
docker run --rm --entrypoint sh image:tag -c 'find / -iname "NOTICE*" 2>/dev/null'
```

### 5. Copyleft and restricted assets

CC-BY-SA images, icon sets, fonts with reserved font names (OFL), share-alike datasets. Nobody
inventories these because they are not in a lockfile. Search `assets/`, `public/`, `fonts/`, `img/`
for files whose provenance is undocumented.

### 6. GPL-2.0-only combined with Apache-2.0

A well-known incompatibility in one direction. Treat any such pair as stop-and-escalate, not a
judgement to make in an audit.

### 7. Licence changed between versions

A dependency relicensed to BUSL or SSPL in a release picked up by a range specifier. Detect by diffing
the licence field across lockfile history:

```
git log -p --follow -- package-lock.json | grep -iE '^\+.*"license"'
```

Report the component, the version at which it changed, and whether you are past that version.

### 8. Code of unknown provenance

See `provenance-checks.md`. Rank it above every copyleft finding: a known copyleft obligation can be
complied with, replaced or licensed around. Unknown provenance cannot be scoped at all.

## Linkage: what to record, what not to conclude

Whether a particular combination creates a "work based on the program" is contested and
fact-specific. Record the mechanism precisely and stop:

| Mechanism | Record as |
|---|---|
| Static linking | linked into the same binary image |
| Dynamic linking | loaded at runtime from a separate file |
| Separate process, pipe or socket | separate program, communicating over an interface |
| Language-level import in an interpreted runtime | loaded into the same process at import |
| Container image sharing | separate binaries in one distributed image |
| Plugin loaded through a documented plugin API | loaded at runtime through an interface |

Then say: *this mechanism is X; whether it creates a derived work under licence Y is a legal question
for counsel.* Do not resolve it. Getting this wrong in either direction is expensive.

## The three options, always presented together

For every conflict, present all three and choose none:

1. **Comply** — release under the copyleft licence, or provide corresponding source, or provide the
   relink means. State what compliance concretely requires here.
2. **Replace** — name at least one candidate replacement with a compatible licence, with a rough
   migration cost.
3. **Licence** — obtain a commercial licence from the copyright holder, where a dual-licensing offer
   exists. Note whether one is known to exist.

A fourth option — accept the risk — exists but is a business decision recorded elsewhere, not a
recommendation this audit makes.
