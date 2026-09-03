## What this changes

<!-- One paragraph. What is different after this merges. -->

## Why

<!-- The problem. Link the issue if there is one. -->

## Checks

- [ ] `node scripts/validate-assets.mjs` passes
- [ ] `node --test 'plugins/*/test/*.test.mjs'` passes
- [ ] `cd site && npm ci && npm run build` passes (if the site changed)
- [ ] Kernel behaviour changes come with a test that fails without the change

## AUTHORING.md conformance

<!-- For new or modified agents and skills. Delete if not applicable. -->

- [ ] Names concrete files, commands, thresholds or standards — not generic guidance
- [ ] States what it deliberately does NOT cover
- [ ] Exit criteria are measurable
- [ ] Declares `model:` and `effort:` per the routing table
- [ ] Agents declare `## Input contract` and `## Output contract`
- [ ] `SKILL.md` under 500 lines, depth in `references/`
- [ ] Degrades gracefully when an optional dependency is absent
- [ ] No unverified version numbers, prices, action SHAs or legal citations

## Breaking change?

<!-- Changing a contract, a gate's behaviour or a frontmatter requirement is breaking,
     even with no code change. If yes, say what breaks and how to migrate. -->
