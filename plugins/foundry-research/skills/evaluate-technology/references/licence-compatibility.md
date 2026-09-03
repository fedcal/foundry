# Licence compatibility

**This is engineering triage, not legal advice.** It tells you which combinations are routine,
which need a lawyer, and which questions to bring them. Always verify against the licence text
itself; summaries — including this one — are secondary sources and are treated as tier S6 under
the research source ladder.

## The three things you must establish, in order

1. **What licence is this, exactly?** The SPDX identifier read from the repository's `LICENSE`
   file at the version you intend to use. Package-registry metadata is frequently wrong or
   stale, and a `license` field in a manifest is a claim, not a licence.
2. **What triggers the obligation?** Distribution of a binary, distribution of source, use over
   a network, or nothing at all.
3. **How far does it reach?** The whole combined work, only the modified files of that project,
   or only that project's own distribution.

Everything else — patent grants, attribution mechanics, trademark carve-outs — follows from
knowing those three.

## Obligation shapes

| SPDX id | Family | Trigger | Reach | Express patent grant | Notes |
|---|---|---|---|---|---|
| `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` | permissive | distribution | attribution only | no | BSD-3 adds a non-endorsement clause |
| `Apache-2.0` | permissive | distribution | attribution + NOTICE + state changes | yes, with patent-retaliation termination | the NOTICE file must be propagated; teams routinely forget |
| `MPL-2.0` | weak copyleft | distribution | **per file** — modified MPL files must be offered as source | yes | the combined larger work may stay proprietary |
| `EPL-2.0` | weak copyleft | distribution | per module | yes | may offer a secondary-licence option to GPL |
| `LGPL-2.1`, `LGPL-3.0` | weak copyleft | distribution | the library, plus the user's ability to relink | 3.0 yes | static linking imposes real obligations; dynamic linking is the intended path |
| `GPL-2.0-only`, `GPL-2.0-or-later` | strong copyleft | distribution | whole combined work | no express grant | `-only` vs `-or-later` is a material difference; read the header |
| `GPL-3.0-only`, `GPL-3.0-or-later` | strong copyleft | distribution | whole combined work | yes | includes anti-tivoisation installation-information requirements |
| `AGPL-3.0-only`, `AGPL-3.0-or-later` | network copyleft | **use over a network** (§13) | whole combined work | yes | a business-model decision for SaaS, not a footnote |
| `CDDL-1.0`, `CDDL-1.1` | weak copyleft | distribution | per file | yes | widely regarded as GPL-incompatible; if both appear, escalate |
| `0BSD`, `Unlicense`, `CC0-1.0` | public-domain-equivalent | none | none | no | `CC0` is discouraged for code by some policies; check the project's own rules |
| `CC-BY-4.0`, `CC-BY-SA-4.0` | content licences | distribution | attribution / share-alike | no | **not designed for software**; if source code carries one, that is a finding |
| `SSPL-1.0`, `BUSL-1.1`, `Elastic-2.0` and similar | source-available | varies, often service-provision | varies, can be very broad | varies | **not OSI-approved open source**; commercial-use conditions apply |

## The direction that catches people

Compatibility is not symmetric. The single most common mistake in dependency selection:

- **Apache-2.0 code may be combined into a GPL-3.0 work.**
- **GPL-3.0 code may not be combined into an Apache-2.0 work and redistributed under
  Apache-2.0.**

The same asymmetry applies whenever a stronger copyleft is downstream of a weaker one. Copyleft
flows outward, never inward. A team that vendors a GPL utility into a permissively licensed
product has changed the licence of the product, whether or not anyone noticed.

Second most common mistake: **GPL-2.0-only and Apache-2.0 are not compatible**, while
GPL-3.0 and Apache-2.0 are. The `-only` / `-or-later` suffix decides it, and it is stated in the
file headers, not in the `LICENSE` file.

## Licence drift

Projects relicense. When they do, older versions remain under the old terms and newer versions
under the new. Always record:

```
candidate   : <name>
version     : <version you intend to use>
licence     : <SPDX id> (read from LICENSE at tag <tag>, retrieved YYYY-MM-DD)
drift       : relicensed at <version> from <old SPDX> to <new SPDX> | none found
```

Check drift with:

```bash
git log --follow --format='%cs %h %s' -- LICENSE COPYING LICENSE.txt | head -20
```

A relicensing event in a candidate's history is a governance signal as much as a legal one: it
tells you the owner is willing and able to change the terms again.

## Transitive obligations

Your obligation is the union of every dependency's obligation. Generate the inventory with the
ecosystem's own tooling and **record the command** so the result is reproducible:

```bash
npm ls --all --omit=dev --json          # then extract "license" fields
mvn license:aggregate-add-third-party    # maven license plugin
./gradlew :dependencies                  # plus a licence plugin
go-licenses report ./...                 # go
cargo license                            # rust
pip-licenses --format=markdown           # python
```

Then check three things the tooling will not tell you:

1. **Missing licences.** A dependency with no detectable licence is not permissively licensed
   by default — it is unlicensed, which means no rights are granted at all. That is a blocker.
2. **Multi-licensed dependencies.** `MIT OR Apache-2.0` means you choose; record which you chose.
   `MIT AND CC-BY-4.0` means both apply.
3. **Bundled and vendored code.** A `vendor/`, `third_party/` or minified bundle inside a
   dependency carries its own licences that the manifest does not list. Grep for licence headers.

## Business-model interactions

Questions the licence table cannot answer, which must go to the legal vertical with your SPDX
findings attached:

- Are we distributing at all, or only operating a service? AGPL and SSPL turn on this.
- Do we ship an on-premises build, an appliance, a container image, or a mobile binary?
  Each is distribution, and mobile app-store terms can conflict with GPL-family terms.
- Do we modify the dependency, or only consume its published interface?
- Do we accept outside contributions, and under a CLA or a DCO? This decides whether you could
  relicense your own project later.
- Is a trademark separate from the licence? Permissive code with a restrictive trademark policy
  can still block the distribution you had in mind.

## Recording the result

Emit one `fact.v1` of `type: constraint` per obligation, through `mcp__plugin_foundry-core_foundry__memory_write`:

```
title  : <dependency> requires NOTICE propagation in every binary distribution
body   : Apache-2.0 §4(d). Applies to <artifacts>. Enforced by <build step>.
source : external:<url to LICENSE at the pinned tag>
tags   : [licence, apache-2.0, distribution]
```

Then, in the ADR, put anything that constrains the business model into
`consequences.negative[]` in plain language. "Uses the SSPL" is not a plain-language
consequence; "we may not offer this as a managed service without either a commercial licence or
publishing our entire service stack" is.

## Hygiene worth adopting regardless of the decision

- Put an SPDX identifier in every source file header, and follow the REUSE specification for
  licence and copyright metadata. It makes the next evaluation cheap.
- Generate an SBOM (SPDX or CycloneDX) in CI and attach it to releases. Licence questions then
  become queries rather than archaeology.
- Fail the build on a new dependency whose licence is not on the project's allow-list. Licence
  drift in a transitive dependency is otherwise invisible until an audit.
