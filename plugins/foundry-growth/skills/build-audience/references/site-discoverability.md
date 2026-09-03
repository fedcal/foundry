# Discoverability of a project site, as engineering

Every check below is either a command whose output you read, or a file you opened. Nothing here is
a belief about what an engine "likes". A discoverability finding that cannot be reduced to an exit
status, a count or a header value does not go in `docs/growth/audience-plan.md`.

Two rules bind this whole file:

1. **Never assert how a specific search engine currently ranks, renders or crawls.** Those rules
   change, are engine-specific, and are the single largest source of confidently wrong advice in
   this domain. If a statement about an engine is load-bearing, fetch that engine's own current
   documentation at plan time and write `source: <url>, checked: YYYY-MM-DD` next to it. If you
   cannot fetch it, the statement does not appear.
2. **Fix what is broken for a human reader first.** Every check below has a reader-facing reason.
   A check that only exists to please a crawler is folklore and is listed in the refusal section.

## Where to run the checks

Two surfaces, and the difference matters:

- **The built output, before deploy.** For this repository: `cd site && npm run build`, then run
  the local checks against `site/dist/`. A broken canonical is cheapest to catch here.
- **The deployed origin, after deploy.** Headers, redirects and status codes exist only here. A
  page that is perfect in `dist/` and returns `404` in production is a production problem.

Record, per check: the command, its output, the surface it ran against, and the date.

## Local checks against the built output

```bash
DIST=site/dist                                   # this repository; adjust per project

# 1. every built page has exactly one canonical link (RFC 6596)
find "$DIST" -name '*.html' | while read -r f; do
  n=$(grep -c 'rel="canonical"' "$f"); [ "$n" = 1 ] || echo "canonical=$n  $f"
done

# 2. duplicate <title> across the site — must be zero
find "$DIST" -name '*.html' -exec sed -n 's:.*<title>\(.*\)</title>.*:\1:p' {} + \
  | sort | uniq -d

# 3. pages with no meta description
find "$DIST" -name '*.html' | while read -r f; do
  grep -q 'name="description"' "$f" || echo "no description  $f"
done

# 4. the artifacts that must exist at the built root
ls -l "$DIST/robots.txt" "$DIST/sitemap-index.xml" "$DIST/sitemap-0.xml" 2>&1

# 5. how many URLs the sitemap actually lists
grep -o '<loc>' "$DIST"/sitemap*.xml | wc -l
```

Pass conditions: canonical count `= 1` on every page; duplicate titles `= 0`; pages without a
description `= 0`; `<loc>` count within 10% of the page count from check 1. A mismatch between
page count and `<loc>` count is normally a sitemap integration that silently stopped emitting.

**Check 4 is conditional on where the site is served.** `robots.txt` is read from the origin root
(RFC 9309), so a site published under a path prefix — this repository sets `base: '/foundry'` in
`site/astro.config.mjs` — cannot ship one from its own build, and there is none in `site/public/`.
Read the base out of the build config, and where the origin root is not yours, record
"`robots.txt` not under this project's control at `<origin>`" instead of a pass or a failure. The
sitemap has no such constraint: it is served under the base and named from `robots.txt` where one
exists.

## Live checks against the deployed origin

```bash
SITE=https://example.org                         # the project's real origin

# reachability and status of the crawl-control artifacts
for p in / /robots.txt /sitemap-index.xml; do
  printf '%s ' "$p"; curl -sS -o /dev/null -w '%{http_code}\n' "$SITE$p"
done

# robots.txt content: read it, do not assume it
curl -sS "$SITE/robots.txt"

# sitemap referenced from robots.txt (sitemaps.org protocol 0.9)
curl -sS "$SITE/robots.txt" | grep -i '^sitemap:'

# redirect chains on any URL that ever moved: one hop, 301, to a 200
curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$SITE/<old-path>"

# transport and caching headers a reader feels
curl -sSI "$SITE/" | grep -iE 'content-type|content-encoding|cache-control|etag|last-modified|strict-transport-security'
```

Pass conditions: `/`, `/robots.txt` and the sitemap all return `200`; `robots.txt` contains no
`Disallow: /` for a path you want read; `robots.txt` names the sitemap; every moved URL resolves in
**one** `301` hop to a `200`; `Content-Type` carries `charset=utf-8`; compression is negotiated.

### `Disallow: /`

A `robots.txt` carried over from a staging deploy blocks the whole site while every page still
renders perfectly in a browser: there is no error to notice, and a quarter of publishing budget is
spent before anyone looks. Check it on the deployed origin, on every deploy target, and record the
literal file contents in the plan — not a claim that it "looks fine". Crawl-control semantics are
RFC 9309.

## Bilingual and multi-region sites

This repository ships `site/src/content/docs/en/` and `site/src/content/docs/it/`, which makes
`hreflang` a real check rather than a theoretical one.

- Every translated page carries an `hreflang` annotation for **each** language, **including a
  self-reference**.
- Annotations must be **reciprocal**: if `/en/x/` points at `/it/x/`, then `/it/x/` points back at
  `/en/x/`. Reciprocity is checkable from the two documents, which is why it is here. What a
  specific engine does with a non-reciprocal set is that engine's own documented behaviour — if the
  plan leans on it, fetch that documentation and stamp `source: <url>, checked: YYYY-MM-DD`. The
  reader-facing reason stands without any engine: a one-way annotation is a language switcher that
  sends people somewhere that will not send them back.
- A language variant that does not exist gets no annotation. Pointing at a page that 404s or that
  silently serves the other language is worse than omitting the annotation.

```bash
# reciprocity spot-check on one page pair
curl -sS "$SITE/en/x/" | grep -o 'hreflang="[^"]*" href="[^"]*"'
curl -sS "$SITE/it/x/" | grep -o 'hreflang="[^"]*" href="[^"]*"'
```

Pass condition: for each sampled pair, both directions present, plus both self-references.

## URL stability, which is the asset

Links earned by published pieces are the compounding part of the whole plan, and a restructure
without redirects discards all of them at once.

- Before any URL change, list the URLs that already have inbound links (the referrer report, the
  server log, the search console export) and write the redirect map first.
- One `301` per moved URL, to the final destination, not into a chain.
- Never delete a page that a published piece links to. Redirect it or replace it in place.
- Verify after deploy with the `curl` redirect command above, for **every** entry in the map, and
  paste the output into the plan.

Pass condition: zero entries in the redirect map returning anything other than `301` to a `200`,
and zero chains longer than one hop.

## Page structure a reader and a parser both need

- One `<h1>` per page, and heading levels that descend without skipping. This is the document
  outline; it is also WCAG 2.2 SC 1.3.1 Info and Relationships and SC 2.4.6 Headings and Labels.
- `<title>` that identifies the page on its own, out of context, because it is what appears in a
  tab, a bookmark and a result listing. WCAG 2.2 SC 2.4.2 Page Titled.
- `lang` attribute on `<html>` matching the actual language of the page — WCAG 2.2 SC 3.1.1
  Language of Page — and correct per language variant, which bilingual sites routinely get wrong
  by templating one value for both.
- Descriptive link text. "Click here" fails WCAG 2.2 SC 2.4.4 Link Purpose (In Context) and is
  also the reason a link is never quoted by anyone else.
- `alt` text on every informative image; empty `alt=""` on decorative ones. WCAG 2.2 SC 1.1.1.
- Content readable with JavaScript disabled where the page is prose. `curl -sS "$SITE/x/" | grep
  -c '<article'` returning 0 on a documentation page means the text exists only after hydration.

Accessibility conformance target is **WCAG 2.2 Level AA**. Treat a failure as a defect for the
reader first. If the failure is structural to the documentation site rather than a single page,
hand it to `foundry-research`, which owns the docs information architecture.

## Feed and machine-readable surfaces

- An RSS or Atom feed (Atom is RFC 4287) with a `<link rel="alternate" type="application/atom+xml">`
  in the page head, so readers who do not use the platform you post on can still follow the work.
  This is the second channel, after the email list, that survives a platform decision.
- Verify the feed parses and its item count is greater than zero:
  `curl -sS "$SITE/rss.xml" | grep -c '<item\|<entry'`.

## Speed, measured rather than asserted

Measure with a real tool (Lighthouse, a field-data export such as CrUX, or the hosting provider's
own timings) and quote **that tool's current thresholds from its own output**, with the date. The
thresholds are revised by their owners; a threshold recalled from memory is exactly the kind of
stale external assertion this whole vertical refuses.

Two things you can check without any tool, because they are properties of the artifact:

```bash
# total transfer weight of the landing page and its immediate assets
curl -sS -o /dev/null -w 'html bytes: %{size_download}\n' "$SITE/"
# fonts and images shipped in the build, largest first
find site/dist -type f \( -name '*.woff2' -o -name '*.png' -o -name '*.jpg' -o -name '*.svg' \) \
  -printf '%s %p\n' | sort -rn | head -10
```

Record the numbers. If one image outweighs every other asset on the page combined, that is the
finding — write it down with its byte count and its path, and it is usually fixable in an hour.

## Refused, by name

These are excluded from the plan, and the reason is stated when a caller asks for them:

| Refused | Why |
|---|---|
| Keyword density targets, keyword stuffing | Degrades the page for the reader you already have; no engine documents a density target |
| `<meta name="keywords">` | No engine documents it as an input and nothing about the page can be verified from it; its presence signals the plan was written from folklore |
| Doorway pages, pages written for a query the project cannot answer | The visit bounces, and the page becomes a maintenance liability |
| Bulk machine-generated pages published as authored content | Fabrication at scale, and the reason the site loses reader trust first |
| Bought links, link exchanges, private blog networks | Paid endorsement without disclosure; also an advertising-claims question → `foundry-legal` |
| Hidden text, cloaking, serving different content to crawlers | Deception, and detectable |
| "Best time to post", "the algorithm rewards X", follower thresholds | Unverifiable external assertions that go stale; fetch the platform's current page or say nothing |
| Scraping contact addresses off a site to announce a post | Personal data without a lawful basis → `foundry-legal:privacy-engineer` |

## The result table to copy into the plan

```
check | surface (dist/ or origin) | command | observed | pass/fail | date
```

A check with no observed output is recorded as **unverified**, never as passing. An unverified
discoverability claim is worth exactly as much as an unverified benchmark: nothing.
