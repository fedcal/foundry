<!--
Definition of Done lives here so it is checked where the work is, not in a document
nobody opens. Items that can be automated should become required status checks; what
remains below is what a machine cannot verify.
-->

## What and why

Closes #

One paragraph: what changes for a user or an operator, and why now. Not a list of commits —
the diff already says what changed.

## Acceptance criteria satisfied

<!-- Copy the criteria from the issue and tick each one. Untickable criteria mean the item
     was not ready, which is worth saying out loud in review. -->

- [ ] AC1 —
- [ ] AC2 —
- [ ] AC3 —

Requirement id(s): REQ-

## How this was verified

<!-- Name the tests. "Tested locally" is not verification. -->

| Criterion | Verified by |
|---|---|
| AC1 | `path/to/test.spec.ts` — `"name of the test"` |
| AC2 | |

Manual verification performed (if any), with the exact steps:

## Definition of Done

- [ ] All acceptance criteria demonstrably pass
- [ ] Automated tests added for the new behaviour; CI green
- [ ] No new lint, type or security-scan findings above the agreed severity floor
- [ ] User-facing changes documented (README / changelog / in-product copy)
- [ ] The new behaviour is observable in logs or metrics **when it fails**
- [ ] Review comments resolved, not merely acknowledged

## Risk and rollback

- **Blast radius if this is wrong:**
- **Feature flag:** name and intended state at merge, or `none`
- **Rollback:** exact steps. "Revert the PR" is only valid when no migration or data change is
  involved — say which applies.
- **Migration:** reversible? Tested against a copy of production-shaped data?

## Breaking changes

- [ ] No breaking change to a published contract
- [ ] Breaking — deprecation window, version bump and consumer notification described below:

## Screenshots / recordings

<!-- For user-visible changes. Before and after. -->

## Notes for the reviewer

Where you want attention, and anything you are unsure about. Naming your own uncertainty is the
single highest-value line in a PR description.
