---
title: Publish a Foundry release to GitHub and Pages
trigger: publish, release, pubblicare, deploy docs, ship foundry, tag a version
owner: maintainer
lastVerified: 2026-09-03
risk: high
---

# Publish a Foundry release

## When to use

Publishing a new version of Foundry: pushing to `fedcal/foundry`, tagging, and deploying the
documentation site to GitHub Pages.

## When not to use

Not for documentation-only edits once the repository exists — those deploy automatically through
`.github/workflows/docs.yml` on push to `main`. Not for local experiments: nothing here is
reversible from the public side once someone has fetched it.

## Parameters

| Name | Value |
|---|---|
| `REPO` | `fedcal/foundry` |
| `VERSION` | the version being released, e.g. `v0.1.0` |
| `PAGES_URL` | `https://fedcal.github.io/foundry` |

## Preconditions

Each must be independently confirmed before step 1.

1. `gh auth status` reports an authenticated account with `repo` and `workflow` scopes.
2. `node scripts/validate-assets.mjs` exits 0 with **zero errors**.
3. `node --test 'plugins/foundry-core/test/*.test.mjs'` passes every test.
4. `cd site && npm ci && npm run build` completes.
5. `git status --porcelain` shows only files you intend to publish.
6. The CI credential scan is clean. Run the exact command from the `secrets` job of
   `.github/workflows/validate.yml` against the staged tree, not an approximation of it — a
   different pattern set proves nothing about whether the push goes red.

## Steps

### 1. Confirm the gates pass

```bash
node scripts/validate-assets.mjs
node --test 'plugins/foundry-core/test/*.test.mjs'
(cd site && npm ci && npm run build)
```

Expected: validation prints "All assets conform to AUTHORING.md", tests report `fail 0`, and the
site build ends with "Complete!". **Gate:** if any of the three fails, stop. Do not publish a
repository whose own CI would go red on the first push.

### 2. Initialise the repository and commit

```bash
git init -b main
git add -A
git commit -m "feat: Foundry 0.1.0 — senior-engineering stack for Claude Code"
```

Expected: the commit lists roughly 400+ files. Check `git show --stat HEAD | tail -1`.

### 3. Create the remote

```bash
gh repo create "$REPO" --public --source=. --remote=origin \
  --description "The senior-engineering stack for Claude Code: agents, skills, hooks, MCP, governed memory and deploy practice." \
  --homepage "https://fedcal.github.io/foundry"
```

**Gate:** if the repository already exists, do not force anything. Inspect it first:
`gh repo view "$REPO"`.

### 4. Push

```bash
git push -u origin main
```

Expected: the branch is created and tracked. From this point the content is public and may already
be cached by third parties — see "Point of no return".

### 5. Enable GitHub Pages

```bash
gh api -X POST "repos/$REPO/pages" -f build_type=workflow || \
gh api -X PUT  "repos/$REPO/pages" -f build_type=workflow
```

Expected: JSON containing `"build_type": "workflow"`. The first call fails with 409 if Pages is
already configured; the second call then updates it.

### 6. Watch the workflows

```bash
gh run list --repo "$REPO" --limit 5
gh run watch --repo "$REPO" "$(gh run list --repo "$REPO" --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Expected: `Validate` and `Documentation` both succeed. **Gate:** a red `Validate` on the first push
means the repository is publishing something its own rules reject — fix and push again before
announcing anything.

### 7. Verify the published site

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$PAGES_URL/en/"
curl -sS -o /dev/null -w "%{http_code}\n" "$PAGES_URL/it/"
```

Expected: `200` for both. Pages can take a few minutes to serve the first deployment; a `404`
immediately after the workflow succeeds usually resolves within five minutes.

### 8. Tag the release

```bash
git tag -a "$VERSION" -m "Foundry $VERSION"
git push origin "$VERSION"
gh release create "$VERSION" --repo "$REPO" --title "Foundry $VERSION" --notes-file CHANGELOG.md
```

### 9. Verify the marketplace installs

In a Claude Code session, in a scratch directory:

```
/plugin marketplace add fedcal/foundry
/plugin install foundry-core@foundry
```

Expected: the marketplace lists twelve plugins and `foundry-core` installs. **This is the only step
that proves the artifact works for a user**, and it is the step most likely to be skipped.

## Rollback

| Step | Undo |
|---|---|
| 2 | `git reset --soft HEAD~1` |
| 3 | `gh repo delete "$REPO"` (asks for confirmation) |
| 4 | Nothing reliable. The content is public. |
| 5 | `gh api -X DELETE "repos/$REPO/pages"` |
| 8 | `gh release delete "$VERSION"`, `git push --delete origin "$VERSION"` |

**Point of no return: step 4.** Once pushed, assume the content is permanent — forks, clones,
caches and archives all copy it within minutes. A secret pushed here must be rotated, not deleted.

## Known traps

- **Enable Pages BEFORE the push, not after — the step order below guarantees one red run.**
  The push in step 4 triggers `Documentation` immediately, and `actions/configure-pages` fails
  with *"Get Pages site failed. Please verify that the repository has Pages enabled"* because
  step 5 has not run yet. Observed on the 0.1.0 release: the first run failed in 8 seconds.
  Either run step 5 between step 3 and step 4, or re-run the workflow afterwards
  (`gh run rerun <id> --repo "$REPO"`), which succeeds unchanged. `Validate` is unaffected.
- **`gh repo create --source=<absolute path>` can refuse a valid repository.** It reported
  *"/path is not a git repository. Run `git -C "/path" init`"* while `git -C /path rev-parse
  --is-inside-work-tree` returned `true` — `gh` resolves `--source` against its own working
  directory. Create the repository without `--source`, then attach the remote yourself:
  `git -C "$ROOT" remote add origin git@github.com:$REPO.git`. Avoid `cd` for this: a `cd` in a
  compound command makes the permission layer unable to determine which directory a later
  relative path reads, and it prompts even under a bypass mode. Use absolute paths throughout.
- **Starlight emits no page at the site root, so the repository homepage 404s.** Every locale is
  prefixed, the default one included, so `dist/index.html` is never generated and
  `$PAGES_URL/` — the exact URL passed to `--homepage` — returns 404 while `/en/` and `/it/`
  both return 200. The Definition of done below missed this for a whole release because it
  only checked the two locale roots. Fix with `site/public/index.html`, copied verbatim by
  Astro, holding `<meta http-equiv="refresh" content="0; url=/foundry/en/">`; the base path
  belongs in that URL like in every other internal link.
- **Astro Starlight ≥ 0.39 changed the sidebar API.** Autogenerated groups must be
  `{ label, items: [{ autogenerate: { directory } }] }`; the older `{ label, autogenerate }` shape
  fails the build with "Did not match union". Symptom: `AstroUserError: Invalid config passed to
  starlight integration`.
- **`git` writes to stderr in an empty repository.** Any hook shelling out to `git log` must pass
  `stdio: ['ignore', 'pipe', 'ignore']`, or the error text leaks into the session on first run.
- **`node --test <dir>` does not work like a glob.** Use
  `node --test 'plugins/foundry-core/test/*.test.mjs'`; passing the directory reports
  `MODULE_NOT_FOUND`.
- **`base` matters for Pages project sites.** With `base: '/foundry'`, every internal link must
  include it. A link written as `/en/start/` 404s in production while working in `astro dev`.
- **Some official sources block automated checks** (403 from `hhs.gov`, `iso.org`). A 403 is not a
  dead link, but it is also not verification: annotate it rather than claiming the URL was checked.
- **Writing the documentation from the source is a code review.** Drafting the reference pages
  against the actual implementation surfaced seven defects the test suite did not: an expired
  override still suppressing a gate, facts that failed their own schema, an index that exceeded the
  budget it reported staying inside, an MCP env var nobody read, a profile path that only resolved
  in one layout, and two gates silently disabled by `enforcement: warn`. Budget for fixes after the
  docs pass, not before it.
- **A documentation agent can be confidently wrong.** One reported that
  `${CLAUDE_PLUGIN_ROOT}/scripts/fanout.mjs` did not exist and wrote that claim into the published
  site in both languages. It exists. Verify every "this does not exist" claim against the tree
  before it ships — a false absence is harder to notice than a false presence.
- **`git grep` behind a pipe loses its exit code.** `if git grep -q ... | head -5; then` always
  succeeds. Check the credential scan without a pipe, and `--cached` must come before the pattern
  or git rejects it. Before the first commit `--cached` reads the index, so `git add -A` first.
- **Run the CI credential scan locally before pushing, with the workflow's exact patterns.** Two
  strings tripped it that are not secrets: a synthetic `AKIA…` key in a hook test, and the PKCS#8
  `PRIVATE KEY` header quoted in a reference document. The fix is never to add them to the
  allowlist — every entry there is a permanent blind spot. Assemble test credentials at runtime so
  no literal appears in the file, and document a header as a regex that covers both the typed and
  untyped forms without being a literal match.

## Definition of done

- `Validate` and `Documentation` workflows are green on `main`.
- `$PAGES_URL/`, `$PAGES_URL/en/` and `$PAGES_URL/it/` all return 200. The bare `$PAGES_URL/`
  is the one advertised as the repository homepage and is the one a static-site generator is
  most likely to leave unbuilt — check it first, not last.
- `/plugin marketplace add fedcal/foundry` lists twelve plugins in a real session.
- The release exists with notes, and `CHANGELOG.md` matches the tag.

## Changelog

- 2026-08-27 — Written while preparing the 0.1.0 release. `lastVerified` stays `null` until the
  steps have actually been executed end to end.
- 2026-08-27 — Added four traps found while writing the documentation site against the source:
  the docs pass behaves as a code review, agents can assert a file is missing when it is not,
  piped `git grep` hides its exit code, and `--cached` is empty pre-commit.
- 2026-09-03 — Executed end to end for 0.1.0; `lastVerified` set. Three traps added, all hit
  during the run: the step order makes the first `Documentation` run fail because Pages is
  enabled after the push, `gh repo create --source` rejected a valid repository, and Starlight
  left the site root unbuilt so the advertised homepage 404'd. The Definition of done now
  checks `$PAGES_URL/` as well. Step 9 stays unverified by the maintainer's own hand: `/plugin`
  is an interface command, so the automated path can only confirm that the manifest resolves
  over raw.githubusercontent and that all twelve `plugin.json` files return 200.
