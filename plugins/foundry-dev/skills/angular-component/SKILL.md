---
name: angular-component
description: Scaffold or refactor an Angular component so it matches the project's real conventions. Detects standalone vs NgModule, signal APIs vs decorators, built-in control flow vs structural directives, the test framework in use and whether Storybook is present, then generates component + spec (+ story) accordingly. Use whenever creating a new Angular component, or when a component must be brought in line with house style. It detects; it never assumes.
user-invocable: true
argument-hint: "<ComponentName> [--path src/app/<feature>] [--kind presentational|container] [--dry-run]"
model: sonnet
effort: medium
metadata:
  foundry.vertical: dev
  foundry.io: "component name + target path -> component, spec, optional story, matching project conventions"
license: Apache-2.0
---

# Scaffold an Angular component to the project's real conventions

`ng generate component` writes what the CLI's defaults say. This skill writes what **this
codebase** says, which is frequently different and always more important.

## When NOT to use this

- The project has an established custom schematic (`schematics/` or a local collection in
  `angular.json` → `cli.schematicCollections`). Use that instead — it is the convention.
- You need a directive, pipe, service, guard or resolver. This skill covers components only.
- You are creating a design-system primitive that must serve multiple applications. That is
  an API design task; take it to `ux-architect` for the token and prop contract first.
- The change is a one-line edit to an existing component. Just edit it.

## Deliberately not covered

Styling decisions beyond wiring up the project's existing pattern, accessibility review
(`accessibility-engineer`), performance budgets (`frontend-performance-engineer`), and
state architecture spanning more than one feature (`solution-architect`). This skill does
not install dependencies and never adds one.

## Step 0 — Refuse to guess

Do not write a single line until every probe below has an answer. If `node_modules` is not
installed, stop and report that: capability detection is impossible and any output would be
a guess. Read `${CLAUDE_PLUGIN_ROOT}/references/stack-versions.json` for Foundry's current
baseline, but the **project always wins** over that file.

## Step 1 — Detection protocol

Run all of these. Record each answer; they become the generation matrix. Full command set
with expected outputs: `references/detection-probes.md`.

```bash
ROOT=$(pwd)
# A. Angular version actually installed (not the range in package.json)
node -p "require('./node_modules/@angular/core/package.json').version" 2>/dev/null

# B. Available core APIs — the only trustworthy capability signal
CORE=node_modules/@angular/core/index.d.ts
for s in signal computed effect linkedSignal resource input output model viewChild contentChild; do
  grep -qE "\b$s\b" "$CORE" && echo "API $s"; done

# C. Standalone or NgModule house style
grep -rl "@NgModule" src/ --include=*.ts | wc -l
grep -rl "standalone: false" src/ --include=*.ts | wc -l
grep -rlE "imports:\s*\[" src/ --include=*.component.ts | wc -l

# D. Template syntax in use
grep -rl "@if" src/ --include=*.html | wc -l
grep -rl "\*ngIf" src/ --include=*.html | wc -l

# E. Signal APIs actually adopted in app code
grep -rl "= input\(\|= input\.required\|= output(" src/ --include=*.ts | wc -l
grep -rl "@Input()" src/ --include=*.ts | wc -l

# F. Change detection default
grep -rl "ChangeDetectionStrategy.OnPush" src/ --include=*.ts | wc -l
grep -rlE "provide(Experimental)?ZonelessChangeDetection" src/ | wc -l
grep -c "zone.js" angular.json 2>/dev/null

# G. Test framework
ls karma.conf.js jest.config.* vitest.config.* web-test-runner.config.* 2>/dev/null
node -p "Object.keys({...require('./package.json').devDependencies}).filter(d=>/jest|karma|jasmine|vitest|testing-library|spectator|ng-mocks/.test(d)).join(' ')"

# H. Storybook
ls .storybook 2>/dev/null && ls src/**/*.stories.ts 2>/dev/null | head -3

# I. Styling convention
node -p "JSON.stringify(require('./angular.json').schematics||{})"
ls src/**/*.component.scss src/**/*.component.css 2>/dev/null | head -3
grep -rl "@use\|@import" src/styles.scss 2>/dev/null

# J. Lint and formatting rules that will judge your output
ls eslint.config.* .eslintrc* .prettierrc* 2>/dev/null
grep -rn "component-selector\|directive-selector" eslint.config.* .eslintrc* 2>/dev/null | head
```

**Selector prefix is not optional.** Read it from the ESLint `@angular-eslint/component-selector`
rule if present, else from `angular.json` → `projects.<p>.prefix`. Using the wrong prefix
fails lint and is the most common scaffolding defect.

**Sample the neighbours.** Read the three most recently modified components nearest the
target path. They encode conventions no config file records: file naming, whether templates
are inline, import ordering, how tests are structured, how inputs are documented.

```bash
find src/app -name '*.component.ts' -newer package.json | head -5
ls -t $(dirname <target-path>)/../**/*.component.ts 2>/dev/null | head -3
```

## Step 2 — Resolve the generation matrix

| Question | Signal | Decision rule |
|---|---|---|
| Standalone? | probe C | If `standalone: false` count is 0 **and** `@NgModule` count is low or only in `app` bootstrapping → standalone. If most components are declared in NgModules → follow that, and file a note (not a refactor) proposing migration. |
| Control flow | probe D | Whichever form has more files wins. If `@if` files > 0, the syntax compiles — prefer it for new code and say so. |
| Inputs/outputs | probes B + E | Use `input()`/`output()` only if the API exists **and** app code already uses it. Otherwise decorators. Never mix both styles in one component. |
| Change detection | probe F | Zoneless providers present → do not set the strategy explicitly unless neighbours do. Otherwise always `ChangeDetectionStrategy.OnPush`. |
| State inside the component | probe B + the `angular-engineer` state decision table | Signals if available; RxJS only for time, cancellation or streams. |
| Test framework | probe G | Generate for what is installed. Never introduce Jest into a Karma project as a side effect of scaffolding a component. |
| Story file | probe H | Generate one only if `.storybook/` exists **and** at least one `*.stories.ts` exists nearby, matching that file's format (CSF version, `Meta`/`StoryObj` typing). |
| Styles | probe I | Match the neighbours' extension and whether styles are inline. If tokens exist (see `design-tokens`), consume semantic tokens — never literal colours. |

If two signals conflict (for example, half the codebase is standalone), **ask** rather than
pick. State the split with counts and let the human decide; record the answer as a T1 fact
of `type: convention` via the `memory_write` MCP tool so the next run does not ask again.

## Step 3 — Choose the component kind

| | Presentational | Container |
|---|---|---|
| Data | Arrives through inputs only | Injects services / reads route |
| Side effects | None | Owns loading, errors, navigation |
| Emits | Outputs describing user intent (`saveRequested`) | Rarely emits |
| Test style | Pure input → rendered output | Mocked service boundary |
| Default | **Prefer this** | Only at route level |

A presentational component that injects `HttpClient` is a defect. A container that contains
markup beyond layout and composition is a defect. Default to presentational; use `--kind
container` only for a component that a route loads.

## Step 4 — Generate

Write the files by hand from the matched template in `references/templates.md` — do not shell
out to `ng generate` and then patch it, which produces CLI-flavoured code with your edits
layered on top. Templates provided there:

- `standalone-signals` — standalone + `input()`/`output()` + built-in control flow.
- `standalone-decorators` — standalone + `@Input()`/`@Output()` + `*ngIf`/`*ngFor`.
- `ngmodule-legacy` — declared component for an NgModule codebase.
- Matching spec files for Karma/Jasmine, Jest, and `@testing-library/angular`.
- Storybook CSF story matching whichever CSF form the project already uses.

Non-negotiable properties of anything you generate:

1. The selector uses the detected prefix and kebab case.
2. `changeDetection: ChangeDetectionStrategy.OnPush` unless the project is zoneless and its
   neighbours omit it.
3. Every `@for` / `*ngFor` has a stable `track` / `trackBy`. Never `$index` for reorderable
   lists.
4. No `any`. Inputs are typed; `input.required<T>()` when the component cannot render without it.
5. Every interactive element is a native element with an accessible name. Icon-only buttons
   get `aria-label`. This is WCAG 2.2 SC 4.1.2 and it is cheaper here than in an audit later.
6. No literal colours, spacing or radii in the stylesheet if a token system exists.
7. Every state the component can be in — empty, loading, error, populated — has markup, or a
   comment stating which parent owns that state. A component with only the populated state is
   incomplete (see `ux-architect`).
8. No subscription without `takeUntilDestroyed()` or the `async` pipe.

## Step 5 — Tests first when the component has behaviour

If `superpowers` is installed, invoke `superpowers:test-driven-development` and follow it:
the spec is written and failing before the component exists. If it is absent, apply the
reduced loop in `references/testing-recipes.md`: write the spec, run it, confirm it fails for
the right reason, implement, re-run.

Minimum spec content for a presentational component:

- Renders with required inputs and shows the expected accessible text.
- Emits each output with the expected payload when the corresponding interaction occurs.
- Renders each declared state (empty / loading / error) under the input that triggers it.

Query by accessible role and name where `@testing-library/angular` is present; otherwise by
`[data-testid]`. Never query by CSS class — that couples the test to styling.

## Step 6 — Verify before claiming done

```bash
npx tsc --noEmit -p tsconfig.json
npx ng lint 2>/dev/null || npx eslint "<generated-paths>"
npx ng test --watch=false --browsers=ChromeHeadless   # or the project's real test command
npx ng build --configuration development
```

Substitute the project's actual commands if it is an Nx workspace or uses a custom builder
(read `project.json` / `nx.json`). If `superpowers` is installed, finish with
`superpowers:verification-before-completion`.

## Exit criteria

1. Every probe in Step 1 has a recorded answer; none was skipped.
2. The generated selector matches the lint rule's required prefix — `ng lint` exits 0.
3. `tsc --noEmit` exits 0 with no new `any`.
4. The spec file exists, runs, and fails when the component's behaviour is removed
   (verify this once by temporarily breaking it).
5. The component's public surface (inputs, outputs) is fully typed, with no optional input
   that the template dereferences unguarded.
6. Zero style properties conflicting with the detected convention (extension, inline vs file,
   token usage).
7. A story exists if and only if the project uses Storybook.
8. `git diff --stat` shows only the intended files — no incidental reformatting of neighbours.

## Degradation

- `node_modules` absent → stop, report, propose `npm ci`. Do not scaffold blind.
- Conflicting conventions → ask, with counts, then persist the answer as a T1 fact.
- Nx or custom builder → translate every `ng` command to the project's real target.
- No `superpowers` → use the reduced loops referenced above and say so in your summary.
- No test framework installed at all → generate the component, skip the spec, and report it
  as a blocking gap rather than installing one.

## References

- `references/detection-probes.md` — every probe, what its output means, and the ambiguous cases.
- `references/templates.md` — the component, spec and story templates per matrix combination.
- `references/testing-recipes.md` — TDD fallback loop, harness setup per framework, query strategy.
