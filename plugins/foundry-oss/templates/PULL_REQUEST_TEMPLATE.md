<!-- Thanks for the PR. Delete any section that does not apply. -->

## What and why

<!-- One paragraph. What changes for a user of {{PROJECT}}, and what problem it solves. -->

Closes #

## How to verify

```bash
{{TEST_CMD}}
```

<!-- If reviewers need more than the test suite, give the exact steps. -->

## Change class

- [ ] Bug fix (restores documented behaviour)
- [ ] Feature (backwards compatible)
- [ ] **Breaking** — requires a major release
- [ ] Performance
- [ ] Docs / tests / chore only

If breaking, describe the migration in one or two sentences (this text goes into the changelog):

> 

If performance, give before and after numbers and the benchmark command:

> 

## Checklist

- [ ] Tests added or updated, and they fail without this change
- [ ] `{{LINT_CMD}}` and `{{TEST_CMD}}` pass locally
- [ ] Docs updated if behaviour or an interface changed
- [ ] Commits follow Conventional Commits; a break carries `!` and a `BREAKING CHANGE:` footer
<!-- OPT:DCO -->- [ ] All commits signed off (`git commit -s`)<!-- /OPT -->
- [ ] Change is in scope per CONTRIBUTING.md, or an accepted RFC is linked
