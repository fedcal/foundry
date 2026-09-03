# Foundry documentation site

Astro + Starlight, English and Italian, published to GitHub Pages by
`.github/workflows/docs.yml` on every push to `main` that touches `site/`.

```bash
npm ci
npm run dev      # http://localhost:4321/foundry/
npm run build    # writes dist/, including the Pagefind search index
```

## Structure

```
src/content/docs/en/    English pages   (defaultLocale)
src/content/docs/it/    Italian pages   — same filenames, same sidebar.order
src/components/Footer.astro   footer with federicocalo.dev and the independence notice
src/styles/foundry.css        light and dark palettes, both defined explicitly
```

A missing Italian page falls back to the English one rather than 404ing, and Starlight marks it as
untranslated. That is deliberate: an incomplete translation should degrade, not break.

## Rules for writing pages

- **Document only what exists.** Before describing a command, a flag or an MCP tool, check it in
  the source. Inventing a plausible flag is the worst failure this site can have.
- Italian pages keep the English filename and `sidebar.order`. Only the content is translated.
- Write Italian with full orthography: `è`, `perché`, `così`, `più`. Never ASCII substitutes.
- Internal links carry the base path: `/foundry/en/...`, `/foundry/it/...`. A link written as
  `/en/...` works in `astro dev` and 404s in production.
- Use `.mdx` only when the page imports a component; plain `.md` otherwise.

## Moving to a custom domain

The site is published at `https://fedcal.github.io/foundry` as a project site. To serve it from a
subdomain instead:

1. Add a DNS `CNAME` record pointing your subdomain (for example `docs.federicocalo.dev`) at
   `fedcal.github.io`.
2. Create `site/public/CNAME` containing only that hostname.
3. In `astro.config.mjs`, set `site` to `https://<your-subdomain>` and change `base` to `'/'`.
4. Update the internal links, which currently include the `/foundry` base — a repository-wide
   search for `/foundry/` finds them.
5. Push. GitHub Pages picks up the `CNAME` file from the built artifact and issues a certificate,
   which can take up to an hour on first setup.

Do not add `public/CNAME` before the DNS record resolves: Pages will serve the site on a hostname
that does not exist yet, and the default `github.io` URL stops working in the meantime.
