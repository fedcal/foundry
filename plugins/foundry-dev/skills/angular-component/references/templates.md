# Component, spec and story templates

Pick the template that matches the generation matrix from `SKILL.md` Step 2.
Replace `app` with the detected selector prefix and adapt naming to the neighbours'
file-naming convention (`user-card.component.ts` vs `user-card.ts` — both exist in the wild;
match what the directory already does).

Every template below assumes the state matrix is real: empty, loading, error, populated.
Delete a state only when the parent demonstrably owns it, and leave a comment saying so.

---

## 1. `standalone-signals` — standalone component, signal inputs/outputs, block control flow

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface UserCardVm {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-user-card' },
  templateUrl: './user-card.component.html',
  styleUrl: './user-card.component.scss',
})
export class UserCardComponent {
  /** The user to render. Required: the component has nothing to show without it. */
  readonly user = input.required<UserCardVm>();
  /** Rendering hint while the parent is fetching. */
  readonly loading = input(false);
  /** Non-null when the parent's fetch failed; the message is already user-facing. */
  readonly errorMessage = input<string | null>(null);

  /** User intent, not a state mutation: the parent decides what "select" means. */
  readonly selected = output<string>();

  protected readonly initials = computed(() =>
    this.user()
      .displayName.split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );

  protected onSelect(): void {
    this.selected.emit(this.user().id);
  }
}
```

```html
@if (loading()) {
  <div class="app-user-card__skeleton" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading user details</span>
  </div>
} @else if (errorMessage(); as message) {
  <p class="app-user-card__error" role="alert">{{ message }}</p>
} @else {
  <button type="button" class="app-user-card__body" (click)="onSelect()">
    <span class="app-user-card__initials" aria-hidden="true">{{ initials() }}</span>
    <span class="app-user-card__name">{{ user().displayName }}</span>
    <span class="app-user-card__email">{{ user().email }}</span>
  </button>
}
```

Notes that are not optional:

- `input.required<T>()` removes every `?.` from the template and every null check from tests.
- The clickable element is a real `<button>`; a `<div>` with `(click)` fails WCAG 2.2 SC 2.1.1.
- `role="alert"` announces the error without stealing focus (SC 4.1.3).
- The skeleton must occupy the same box as the populated state, or it causes layout shift.
- `styleUrl` (singular) exists only in newer Angular; if the probe or the neighbours show
  `styleUrls: ['...']`, use that instead.

### List rendering with `@for`

```html
@for (user of users(); track user.id) {
  <app-user-card [user]="user" (selected)="onSelect($event)" />
} @empty {
  <p class="empty">No users match this filter. <button type="button" (click)="clearFilter()">Clear filter</button></p>
}
```

`track user.id` — a stable domain identity. `track $index` breaks DOM reuse whenever the
list reorders or an item is removed from the middle. `@empty` is the empty state; a list
without one is incomplete.

---

## 2. `standalone-decorators` — standalone, decorator inputs/outputs, structural directives

Use when probe B shows `input`/`output` MISSING, or probe E shows the codebase has not
adopted them.

```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.scss'],
})
export class UserCardComponent {
  @Input({ required: true }) user!: UserCardVm;
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  @Output() readonly selected = new EventEmitter<string>();

  onSelect(): void {
    this.selected.emit(this.user.id);
  }
}
```

`@Input({ required: true })` is not available in every version — probe it
(`grep -n "required" node_modules/@angular/core/index.d.ts | grep -i input`) before using it.
If unavailable, declare `user!: UserCardVm` and assert its presence in `ngOnInit`.

Import only what the template uses. Importing `CommonModule` wholesale when the template
uses one directive is acceptable but noisier than importing `NgIf`, `NgForOf` individually;
match the neighbours.

---

## 3. `ngmodule-legacy` — component declared in an NgModule

```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.scss'],
})
export class UserCardComponent { /* as above */ }
```

Then add it to the nearest feature module — and export it if anything outside that module
renders it:

```ts
@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule],
  exports: [UserCardComponent],
})
export class UserModule {}
```

Forgetting `exports` produces the classic "not a known element" template error at the
consumer. Check who will render the component before deciding.

---

## 4. Container component (route-level)

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserCardComponent } from './user-card.component';
import { UsersService } from './users.service';

@Component({
  selector: 'app-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserCardComponent],
  templateUrl: './users-page.component.html',
})
export class UsersPageComponent {
  readonly #users = inject(UsersService);
  readonly #router = inject(Router);

  // RxJS at the boundary (cancellation, retry), signals in the view.
  protected readonly users = toSignal(this.#users.list$, { initialValue: [] });

  protected onSelect(id: string): void {
    void this.#router.navigate(['/users', id]);
  }
}
```

Where `resource()` exists and the load is parameter-driven, prefer it over hand-rolled
`isLoading`/`error` signals — probe first. The container owns loading, error and navigation;
the presentational child owns none of them.

---

## 5. Spec — Karma + Jasmine (Angular CLI default harness)

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserCardComponent, UserCardVm } from './user-card.component';

const user: UserCardVm = { id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' };

describe('UserCardComponent', () => {
  let fixture: ComponentFixture<UserCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UserCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(UserCardComponent);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
  });

  it('renders the display name', () => {
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('emits the user id when activated', () => {
    const emitted: string[] = [];
    fixture.componentInstance.selected.subscribe((id) => emitted.push(id));
    fixture.nativeElement.querySelector('button').click();
    expect(emitted).toEqual(['u-1']);
  });

  it('announces the error instead of the body', () => {
    fixture.componentRef.setInput('errorMessage', 'Could not load this user.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Could not load this user.');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
```

`componentRef.setInput()` is the correct way to set signal inputs — assigning to the
instance property does not work for `input()` and produces confusing failures.

## 6. Spec — `@testing-library/angular`

```ts
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserCardComponent } from './user-card.component';

it('emits the user id when the card is activated', async () => {
  const selected = jest.fn();          // or jasmine.createSpy()
  await render(UserCardComponent, {
    inputs: { user: { id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' } },
    on: { selected },
  });

  await userEvent.click(screen.getByRole('button', { name: /ada lovelace/i }));

  expect(selected).toHaveBeenCalledWith('u-1');
});
```

`getByRole(..., { name })` asserts the accessible name as a side effect. That is why this
query style is preferred: a component with no accessible name fails the test, not the audit.
The `on:` option for outputs is version dependent — check the installed package's typings
before using it, and fall back to `componentProperties` with a spy if absent.

## 7. Story — Storybook CSF

```ts
import type { Meta, StoryObj } from '@storybook/angular';
import { UserCardComponent } from './user-card.component';

const meta: Meta<UserCardComponent> = {
  title: 'Users/UserCard',
  component: UserCardComponent,
  args: { user: { id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' } },
};
export default meta;

type Story = StoryObj<UserCardComponent>;

export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Error: Story = { args: { errorMessage: 'Could not load this user.' } };
export const LongName: Story = {
  args: { user: { id: 'u-2', displayName: 'Wolfeschlegelsteinhausenbergerdorff Jr.', email: 'w@example.com' } },
};
```

One story per state in the state matrix, plus at least one boundary case (longest string,
zero items, worst-case data). Stories that only show the happy path are decoration.

Match the project's existing story format exactly — the `Meta`/`StoryObj` shape, the
framework package name and the way providers are supplied all vary by Storybook version.

---

## Stylesheet template (token-consuming)

```scss
.app-user-card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-default);
  color: var(--color-text-default);

  &__error { color: var(--color-text-danger); }

  &__body {
    min-block-size: 2.75rem;   /* >= 44px touch comfort; WCAG 2.2 SC 2.5.8 needs >= 24px */
    &:focus-visible { outline: var(--focus-ring-width) solid var(--color-focus-ring); outline-offset: 2px; }
  }
}
```

No literal colours, no magic pixel values, and never `outline: none` without a replacement
indicator (WCAG 2.2 SC 2.4.7). If the project has no token system, use its existing variables
and file a note proposing the `design-tokens` skill.
