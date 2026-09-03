# Testing recipes and the TDD fallback loop

## When `superpowers` is unavailable

`superpowers:test-driven-development` is the preferred discipline. Without it, run this
reduced loop and say in your summary that you did.

1. **Write the failing test first.** One behaviour, named after the behaviour and not the
   method: `it('emits the user id when the card is activated')`.
2. **Run it. Confirm it fails, and read why.** A test that fails with
   "cannot find module" has not tested anything. It must fail on the assertion.
3. **Write the smallest implementation that passes.** No extra inputs, no speculative
   configuration flags, no abstraction for a second caller that does not exist.
4. **Run the whole file.** Not just the new test — you must see that nothing regressed.
5. **Refactor with the tests green.** Renaming, extracting, tidying. Re-run after each.
6. **Verify the test can fail.** Delete or invert one line of the implementation, re-run,
   confirm red, restore. A test that cannot fail is worse than no test: it grants false
   confidence permanently.

Cover, at minimum, per component: one rendering assertion per state in the state matrix,
one assertion per output, and one boundary case.

## Harness setup per framework

### Karma + Jasmine (CLI default)

```ts
await TestBed.configureTestingModule({
  imports: [UserCardComponent],           // standalone: import it
  // declarations: [UserCardComponent],   // NgModule codebase: declare it
  providers: [provideHttpClientTesting(), provideRouter([])],
}).compileComponents();
```

Run: `npx ng test --watch=false --browsers=ChromeHeadless`.

### Jest (jest-preset-angular or a custom setup)

Read `jest.config.*` for `setupFilesAfterEnv`; the TestBed initialiser lives there, and
duplicating it in a spec breaks the suite. Run the project's script (`npm test`), not a
guessed `npx jest` invocation which may miss the config.

### Vitest

Check `vitest.config.*` for the Angular plugin and the `environment` (`jsdom` vs `happy-dom`).
Some DOM APIs used by focus and layout assertions behave differently between the two — if a
focus test fails only under `happy-dom`, that is an environment artefact, not a bug.

### Spectator / ng-mocks

If either is a dependency, the project has a house harness. Read one existing spec and copy
its structure exactly rather than introducing plain `TestBed` alongside it.

## Query strategy, in priority order

1. `getByRole(role, { name })` — asserts the accessible name for free.
2. `getByLabelText` for form controls — asserts the label association for free.
3. `getByText` for static content.
4. `[data-testid]` when no semantic handle exists (usually a signal the markup is
   under-semantic; consider fixing the markup instead).
5. CSS class selectors — **never**. They couple tests to styling and break on refactors.

## Signal inputs in tests

```ts
fixture.componentRef.setInput('user', user);
fixture.detectChanges();
```

Assigning `fixture.componentInstance.user = user` does not work for `input()` and fails
with a confusing type error or a silent no-op. Required inputs must be set before the first
`detectChanges()`, or the template throws.

## Async and time

- `fakeAsync` + `tick(ms)` for `setTimeout`, debounce and RxJS timers. Ends with
  `flush()` or an explicit `discardPeriodicTasks()` if an interval is still running.
- `await fixture.whenStable()` for promise-based work.
- Marble tests only for operator chains that are genuinely hard to reason about. A marble
  test of a `map` is ceremony.
- Never `setTimeout` inside a test to "wait for" something. Assert on a deterministic signal.

## HTTP

```ts
providers: [provideHttpClient(), provideHttpClientTesting()]
```

Then `TestBed.inject(HttpTestingController)`, flush the expected request, and call
`verify()` in `afterEach` so an unexpected request fails the test loudly.

## Change detection under zoneless

If the app is zoneless, configure the test module with the zoneless provider your capability
probe found. A component that passes under Zone.js and fails under zoneless has state
mutated outside a signal — that is a real production bug that the zoneless test exposed.
Fix the component, not the test.

## Accessibility assertions in unit tests

Cheap, high value, and they stop regressions before an audit:

```ts
it('gives the icon-only button an accessible name', () => {
  expect(screen.getByRole('button', { name: /remove user/i })).toBeTruthy();
});
```

If `jest-axe` or `axe-core` is already a dependency, add a per-component axe assertion.
Do not add the dependency yourself — file it as a gap. Automated checks catch only part of
the picture; the full procedure is the `audit-accessibility` skill.

## What not to test

- Framework behaviour (that `@if` hides content).
- Private methods. Test them through the public surface or they should not be private.
- Snapshot tests of whole templates: they fail on every cosmetic change and are approved
  blindly within two weeks. Assert on the specific text or role that carries meaning.
- Implementation details such as "the service method was called" when what matters is the
  rendered outcome. Assert on outcomes; mock at the network boundary.
