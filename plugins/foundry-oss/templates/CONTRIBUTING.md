# Contributing to {{PROJECT}}

Thanks for being here. This document is short on purpose — if something is missing, open an
issue and we will fix the document, not blame the reader.

## Before you start

- **Bug?** Open an issue with a reproduction. See [SUPPORT.md](SUPPORT.md) for what we need.
- **Vulnerability?** Do **not** open an issue. Follow [SECURITY.md](SECURITY.md).
- **Usage question?** See [SUPPORT.md](SUPPORT.md).
- **Large change?** Open a discussion or an RFC first — see *When a proposal is required* below.
  Unsolicited large PRs are the most common way effort gets wasted here.

## Set up in one pass

```bash
git clone https://github.com/{{REPO}}.git && cd {{PROJECT}}
{{SETUP_CMD}}
{{TEST_CMD}}
```

Expected: the test suite passes on a clean clone in under {{SETUP_MINUTES}} minutes.
If it does not, that is a bug in this document — please report it.

Requirements: {{LANG}} {{LANG_VERSION}}, {{PKG_MANAGER}}.

## Making a change

1. Branch from `{{DEFAULT_BRANCH}}`.
2. Write the change **and** a test that fails without it.
3. Run locally before pushing:
   ```bash
   {{LINT_CMD}}
   {{TEST_CMD}}
   {{BUILD_CMD}}
   ```
4. Commit using [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
   `type(scope): summary` with types `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`,
   `ci`. A breaking change uses `type!:` **and** a `BREAKING CHANGE:` footer describing the
   migration.
<!-- OPT:DCO -->
5. Sign off every commit — we use the [Developer Certificate of Origin 1.1](https://developercertificate.org/):
   ```bash
   git commit -s -m "fix: ..."
   ```
   Missed it? `git rebase --signoff {{DEFAULT_BRANCH}}` then force-push your branch.
<!-- /OPT -->
<!-- OPT:CLA -->
5. Sign the Contributor Licence Agreement when the bot comments on your first pull request.
   It is required before we can merge; see [GOVERNANCE.md](GOVERNANCE.md) for why.
<!-- /OPT -->
6. Open the pull request. Fill the template — the questions exist because skipping them costs a
   review round trip.

## What review looks like

- First response within about **{{RESPONSE_PR_D}} days**. Best effort by volunteers; if it is
  overdue, a polite bump on the thread is welcome and not rude.
- Comments are prefixed so you know what blocks the merge:
  `blocking:` must change · `question:` answer it · `nit:` optional · `praise:` no action.
- We aim to give all blocking feedback in one pass. Point it out if we drip-feed.
- Merge requires: green CI, one maintainer approval<!-- BAND:B2+ -->, and approval from the
  `CODEOWNERS` for every touched path<!-- /BAND -->.
- We squash-merge and use the PR title as the commit subject, so make it a good one.

## When a proposal is required

Open an RFC (see [GOVERNANCE.md](GOVERNANCE.md)) **before** writing code if the change:

- alters a public API in a way that needs a major release,
- adds or removes a runtime dependency, or raises a minimum toolchain version,
- changes a persisted or wire format,
- changes security behaviour or a default,
- is bigger than about {{RFC_EFFORT_DAYS}} days of work.

No proposal needed for: bug fixes restoring documented behaviour, docs and tests, dependency
patch bumps, and internal refactors with no observable change.

## Labels you will see

`type:*` what it is · `status:*` what it is waiting on · `priority:p0–p3` when we will act ·
`good first issue` verified small and self-contained · `help wanted` we want a contributor.

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licensing of contributions

Contributions are licensed under **{{LICENSE}}**, the licence of this project.
<!-- OPT:DCO -->Your `Signed-off-by` line certifies you have the right to submit under it.<!-- /OPT -->
