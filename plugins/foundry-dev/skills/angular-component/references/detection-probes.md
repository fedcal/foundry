# Detection probes — what each answer means

Every probe below is cheap and definitive. Run them all; interpret with the tables.
Never substitute an assumption for a probe result.

## A. Installed Angular version

```bash
node -p "require('./node_modules/@angular/core/package.json').version"
```

Use the **installed** version, not the range in `package.json`. `^19.0.0` may have resolved
to anything. If the command fails, dependencies are not installed — stop.

## B. Core API availability

```bash
CORE=node_modules/@angular/core/index.d.ts
for s in signal computed effect untracked linkedSignal resource \
         input output model viewChild viewChildren contentChild \
         afterNextRender afterRenderEffect takeUntilDestroyed \
         provideZonelessChangeDetection provideExperimentalZonelessChangeDetection; do
  grep -qE "\b$s\b" "$CORE" && echo "AVAILABLE $s" || echo "MISSING   $s"
done
grep -qE "\btakeUntilDestroyed\b" node_modules/@angular/core/rxjs-interop/index.d.ts 2>/dev/null \
  && echo "AVAILABLE takeUntilDestroyed (rxjs-interop)"
```

`index.d.ts` is the public API surface. If a symbol is not there, importing it will not
compile — that is a definitive answer that no documentation lookup can override.

The zoneless provider has appeared under more than one name across releases. Use whichever
name the probe reports as available; if both are reported, prefer the one without
`Experimental` in it.

## C. Standalone vs NgModule

```bash
echo "NgModule files:      $(grep -rl '@NgModule' src/ --include=*.ts | wc -l)"
echo "explicit non-standalone: $(grep -rl 'standalone: false' src/ --include=*.ts | wc -l)"
echo "components total:    $(find src -name '*.component.ts' | wc -l)"
echo "components with imports[]: $(grep -rlE 'imports:\s*\[' src/ --include=*.component.ts | wc -l)"
grep -rn "bootstrapApplication\|platformBrowserDynamic" src/main.ts
```

| Pattern | Read as |
|---|---|
| `bootstrapApplication` in `main.ts`, 0–1 `@NgModule` files | Fully standalone. Generate standalone. |
| `platformBrowserDynamic().bootstrapModule` + many `@NgModule` | NgModule codebase. Generate a declared component and add it to the nearest module's `declarations`. |
| Both present, mixed counts | Migration in progress. **Ask.** Report both counts. Default, if forced: follow the directory you are generating into. |

Note that the meaning of an absent `standalone` property has changed across Angular
releases. Do not rely on its absence — rely on `bootstrapApplication`, on `imports: []`
inside component decorators, and on what neighbouring files do.

## D. Template control flow

```bash
echo "@if files:    $(grep -rl '@if' src/ --include=*.html | wc -l)"
echo "@for files:   $(grep -rl '@for' src/ --include=*.html | wc -l)"
echo "*ngIf files:  $(grep -rl '\*ngIf' src/ --include=*.html | wc -l)"
echo "@defer files: $(grep -rl '@defer' src/ --include=*.html | wc -l)"
```

Any non-zero `@if` count proves the compiler supports the block syntax in this version.
If the count is zero, prove it before using it: write a throwaway component containing
`@if (true) { x }` and run `npx ng build --configuration development`. A parse error settles
the question; a clean build settles it the other way. Delete the throwaway file afterwards.

Beware false positives: `@if` also appears in Sass and in comments. Restrict to `--include=*.html`
and to inline `template:` strings, and spot-check one match.

## E. Signal input/output adoption

```bash
echo "signal inputs:  $(grep -rlE '=\s*input(\.required)?[<(]' src/ --include=*.ts | wc -l)"
echo "signal outputs: $(grep -rl '= output(' src/ --include=*.ts | wc -l)"
echo "@Input():       $(grep -rl '@Input()' src/ --include=*.ts | wc -l)"
echo "@Output():      $(grep -rl '@Output()' src/ --include=*.ts | wc -l)"
```

Available (probe B) **and** adopted (this probe) → use signal APIs.
Available but not adopted → use signal APIs for new components only if the target directory
has no decorator-based neighbours; otherwise match the neighbours and note the divergence.
Not available → decorators, no discussion.

Never mix `input()` and `@Input()` in the same class.

## F. Change detection

```bash
echo "OnPush components: $(grep -rl 'ChangeDetectionStrategy.OnPush' src/ --include=*.ts | wc -l)"
grep -rnE 'provide(Experimental)?ZonelessChangeDetection' src/ | head
grep -n 'zone.js' angular.json src/polyfills.ts 2>/dev/null
grep -rn 'ngZone: .noop.' src/main.ts 2>/dev/null
```

| Result | Generate |
|---|---|
| Zoneless provider present, `zone.js` absent from polyfills | Zoneless app. Still safe to set `OnPush`; match neighbours. |
| `zone.js` present, most components `OnPush` | Set `OnPush`. |
| `zone.js` present, few components `OnPush` | Set `OnPush` anyway and note that the codebase default is Default — this is an improvement, not a deviation. |

## G. Test framework

```bash
ls karma.conf.js jest.config.ts jest.config.js vitest.config.ts web-test-runner.config.js 2>/dev/null
node -p "Object.keys({...require('./package.json').devDependencies})\
.filter(d=>/jest|karma|jasmine|vitest|@testing-library|spectator|ng-mocks|playwright|cypress/.test(d)).join('\n')"
node -p "JSON.stringify(require('./angular.json').projects[Object.keys(require('./angular.json').projects)[0]].architect.test||{},null,1)" 2>/dev/null
find src -name '*.spec.ts' | head -3
```

Then **read one existing spec** in the target area. It tells you the harness style
(`TestBed.configureTestingModule` vs `render()` from testing-library vs Spectator's
`createComponentFactory`), the mocking approach, and the assertion library. Match it exactly.

Never introduce a second test framework as a side effect of scaffolding.

## H. Storybook

```bash
ls -d .storybook 2>/dev/null && cat .storybook/main.ts 2>/dev/null | head -20
find src -name '*.stories.ts' | head -3
```

Read one existing story file. Match its CSF form (`Meta`/`StoryObj` typing, `args`,
`argTypes`, decorators, `applicationConfig`/`moduleMetadata`). Do not generate a story if
`.storybook/` does not exist, and do not generate one in a project that has Storybook
configured but no stories in the target area — ask.

## I. Styling

```bash
node -p "JSON.stringify(require('./angular.json').schematics||{},null,1)"
find src -name '*.component.scss' | wc -l
find src -name '*.component.css' | wc -l
grep -rl "styles: \[" src/ --include=*.component.ts | wc -l   # inline styles
grep -rn "^\s*--[a-z-]*:" src/styles.scss src/styles.css 2>/dev/null | head
ls src/**/tokens*.scss src/styles/tokens* 2>/dev/null
```

The `schematics` block in `angular.json` may pin `style`, `inlineTemplate`, `inlineStyle`,
`changeDetection` and `skipTests`. When it does, it is the convention — obey it.

If custom-property tokens exist, the generated stylesheet must consume semantic tokens.
Literal hex values in a tokenised codebase are a governance violation (`design-tokens` skill).

## J. Lint rules that will judge the output

```bash
ls eslint.config.js eslint.config.mjs .eslintrc.json .eslintrc.js 2>/dev/null
grep -rn "component-selector" eslint.config.* .eslintrc* 2>/dev/null
grep -rn "prefix" angular.json | head
cat .prettierrc* 2>/dev/null
```

The selector prefix and case style come from `@angular-eslint/component-selector`
(`{ type: 'element', prefix: 'app', style: 'kebab-case' }`) when configured; otherwise from
`angular.json` → `projects.<name>.prefix`. Getting this wrong is the single most common
scaffolding failure.

Also look for rules that will reject otherwise-fine code:
`@angular-eslint/template/prefer-control-flow`, `.../no-empty-lifecycle-method`,
`.../use-lifecycle-interface`, `@typescript-eslint/explicit-member-accessibility`,
`.../consistent-type-definitions`, and any `member-ordering` rule.

## Ambiguity protocol

When probes conflict:

1. Report the raw counts, not an interpretation.
2. State the two candidate conventions and what each implies for the generated file.
3. Ask the human to choose.
4. Persist the choice as a T1 fact (`type: convention`, `scope: project`) through the
   `foundry` MCP `memory_write` tool, so the next invocation does not ask again.

Never resolve ambiguity by picking "the more modern option" silently. Consistency inside a
codebase is worth more than the newest API.
