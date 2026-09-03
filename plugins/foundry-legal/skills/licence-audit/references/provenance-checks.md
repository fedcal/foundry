# Provenance of first-party code

> **Automated technical assessment. Not legal advice.** This file describes how to find code whose
> origin is undocumented. It does not establish that anything was copied improperly, and you must not
> write an accusation about a named person into any artifact. Report fact patterns; escalate.

The dependency audit covers code you declared. This covers code you did not — which is where the
unbounded risk lives, because an undeclared component cannot be scoped, replaced or licensed around.

## 1. Vendored and copied trees

Look in `vendor/`, `third_party/`, `third-party/`, `external/`, `lib/`, `deps/`, `contrib/`,
`static/js/`, and any directory holding minified files.

For each: is there a `LICENSE`, a header, an upstream URL, and a recorded version?

```
# directories that arrived complete, in one commit, with no upstream reference
git log --diff-filter=A --format='%H %ad %s' --date=short -- vendor/ third_party/

# source files with no licence or copyright header
grep -rLiE 'copyright|SPDX-License-Identifier|licen[cs]e' --include='*.{ts,js,py,java,go,rs,c,h,cpp,cs,rb}' src/
```

A vendored tree with a licence and a pinned upstream version is fine — it is a dependency by another
name; add it to the inventory. A vendored tree without those is a finding.

## 2. Minified and bundled files in the repository

A checked-in `*.min.js` or a bundle is opaque to review and frequently carries an embedded licence
banner that the build then strips. Extract the banner:

```
grep -ohE '/\*![^*]*\*/|@license[^\n]*' -r --include='*.min.js' . | sort -u
```

Anything found here belongs in the inventory and usually in NOTICE.

## 3. Snippets with foreign provenance

Signals, none of which is proof:

- a function whose style diverges sharply from the surrounding file (naming, bracing, comment style);
- an idiom or API the rest of the codebase never uses;
- a comment referencing a question-and-answer site, a blog, a gist, or "adapted from";
- a large, self-contained algorithm added in a single commit with a one-word message;
- variable names in a different natural language from the rest of the project.

```
grep -rniE 'stackoverflow|stackexchange|gist\.github|adapted from|based on .*(blog|post)|copied from' \
  --include='*.{ts,js,py,java,go,rs,c,h,cpp,cs,rb}' src/
```

Report as "provenance not documented for `path:line` — review recommended". Never as "this was
copied". You cannot know that, and the artifact may be read by people outside the team.

## 4. AI-generated code

Record two facts and stop:

1. Does the project have a policy on AI-assisted contributions?
2. Is the policy enforced or evidenced anywhere — a commit trailer, a PR checkbox, a CI check?

The legal position on authorship and on training-data provenance varies by jurisdiction and is
actively contested. Report the fact pattern and note that the position is unsettled. Do not assert a
conclusion in either direction.

## 5. Contributor IP

Whether a contribution's IP was assigned depends on contracts you cannot read.

- **Employees**: usually covered by employment agreements, but this varies by jurisdiction and by
  whether the work was done in the course of employment.
- **Contractors**: frequently **not** assigned by default. Absent an express assignment, the
  contractor may retain rights.
- **External contributors**: covered only by a CLA or a DCO, if either exists and is enforced.

Method — identify the human sources, then ask about coverage:

```
git shortlog -sne --all | head -50
git log --format='%ae' --all | sed 's/.*@//' | sort | uniq -c | sort -rn
```

Domains outside the organisation are the population to ask about. Emit the question as an `ask:`
finding directed at legal or HR. Never conclude that a specific person's contribution is unassigned.

## 6. Generated and derived files

- Code generated from a schema or IDL inherits the licence position of the generator's **templates**,
  not the generator, and some generators embed licensed runtime code.
- Protobuf, OpenAPI and GraphQL codegen output, ORM scaffolding, and UI component code copied from a
  design system all carry the upstream terms.
- Check the generator's own documentation for a statement about generated output, and record it.

## 7. Assets

Images, icons, fonts, sounds, sample data and datasets. They are almost never in a lockfile and they
carry real terms — attribution, share-alike, non-commercial.

```
find assets public static -type f \( -name '*.svg' -o -name '*.png' -o -name '*.jpg' \
  -o -name '*.woff*' -o -name '*.ttf' -o -name '*.otf' -o -name '*.mp3' -o -name '*.csv' \) \
  | head -200
```

For each family of assets, record the source and licence, or mark the whole family as unknown
provenance. Fonts deserve individual attention: OFL reserved font names restrict renaming and
redistribution in ways that break when a build subsets or converts them.

## Recording

For each provenance gap emit a `finding.v1` with:

- `severity`: `high` where the code ships in a conveyed artefact, `medium` where it is
  infrastructure-only;
- `failureScenario`: what happens if the upstream owner asserts rights — which release is affected,
  which customers hold it, whether it can be removed without breaking the product;
- `remediation`: identify the upstream and record it, replace it, or obtain a licence — plus the
  concrete step to prevent recurrence (a header-check in CI, an inventory entry, a review rule);
- `confidence`: `low` for style-based signals. Say so plainly. A confident provenance accusation
  based on brace style damages the credibility of the whole report.
