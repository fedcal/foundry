# Deciding the version

**Semantic Versioning 2.0.0** and **Conventional Commits 1.0.0**. The version describes the
public API's compatibility — not the size of the change, not how proud anyone is of it.

---

## 1. SemVer, precisely

`MAJOR.MINOR.PATCH`

| Component | Increment when |
|---|---|
| MAJOR | any **incompatible** change to the public API |
| MINOR | backwards-compatible functionality is added |
| PATCH | backwards-compatible bug fixes |

Rules people get wrong:

- **Pre-release identifiers sort *before* the release.** `1.4.0-rc.1 < 1.4.0`. Identifiers are
  compared field by field: numeric fields numerically, alphanumeric fields lexically, and a
  larger set of fields wins when all preceding fields are equal.
- **Build metadata (`+<SHA>`) is ignored in precedence.** `1.4.0+abc` and `1.4.0+def` are the same
  version. Never encode meaning in it.
- **`0.y.z` guarantees nothing.** Under the specification, anything may change at any time while
  the major version is zero. Many teams follow a convention where a `0.y` bump signals breaking
  and `0.0.z` signals safe — that is a convention, not the spec. If your consumers rely on it,
  write it down; otherwise they are guessing.
- Staying on `0.y` for years is a decision to have **no compatibility contract**. That may be
  correct for an internal service; say so out loud rather than drifting into it.
- Once a version is published, its content must never change. A mistake becomes `PATCH+1`, never
  a re-published tag.

### What is "the public API"?

Decide this once, per repository, and write it in the README. It is not always the code:

- a library: exported symbols, their signatures and their documented behaviour;
- an HTTP service: the request/response contract, status codes, headers, error shapes;
- a CLI: flags, arguments, exit codes, stdout format if anyone pipes it;
- a container image: environment variables, mount points, ports, the command interface;
- a Terraform module: input variables and outputs.

If it is not in the declared public API, changing it is not a breaking change — and if consumers
depend on it anyway, the fix is to declare it, not to argue.

---

## 2. Conventional Commits mapping

```
<type>[optional scope][!]: <description>

[body]

[BREAKING CHANGE: <what broke and how to migrate>]
```

| Commit | Bump |
|---|---|
| `fix:` | PATCH |
| `feat:` | MINOR |
| `!` after the type/scope, or a `BREAKING CHANGE:` footer | MAJOR |
| `perf:` | none by default; often worth a PATCH — decide once, per repository, and be consistent |
| `docs:`, `chore:`, `test:`, `refactor:`, `ci:`, `style:`, `build:` | none |

Enforce the format at the boundary, not by asking nicely:

- squash-merge workflows: lint the **PR title**, because that becomes the commit message;
- merge-commit workflows: lint **every** commit.

The changelog is only as good as the weakest merge that reached the default branch.

---

## 3. The API diff overrides the commits

Commit prefixes are written by humans in a hurry. A `feat:` that removes a response field is a
MAJOR change whatever the prefix says. Run a real compatibility check and let it win:

| Ecosystem | Tool category |
|---|---|
| Java | binary/source compatibility checker (japicmp, revapi) bound to the build |
| Go | `gorelease` against the previous tag |
| Rust | `cargo-semver-checks` |
| HTTP API | an OpenAPI diff tool comparing the previous published spec with the new one |
| Database-facing service | migration review: is every change additive? |

Wire it into CI so the check runs on every PR, not only at release time — a breaking change
discovered at release time has already been merged and possibly deployed.

**Conflict resolution:** the tool's verdict wins. If the tool says breaking and the commits say
minor, either the change is genuinely breaking (bump MAJOR) or the tool has a false positive
(record the suppression, with a reason, in the repository).

---

## 4. Deriving the version

```bash
LAST=$(git describe --tags --abbrev=0)
RANGE="$LAST..HEAD"

echo "== range: $RANGE =="
git log "$RANGE" --pretty='%h %s'

echo "== breaking =="
git log "$RANGE" --pretty='%h %s%n%b' | grep -E '^(BREAKING CHANGE:|[a-z]+(\(.+\))?!:)' || echo none

echo "== features =="
git log "$RANGE" --pretty='%h %s' | grep -E '^\S+ feat(\(.+\))?:' || echo none

echo "== fixes =="
git log "$RANGE" --pretty='%h %s' | grep -E '^\S+ fix(\(.+\))?:' || echo none
```

Then apply, in order:
1. any breaking signal (commit **or** API diff) → MAJOR;
2. otherwise any `feat:` → MINOR;
3. otherwise any `fix:` → PATCH;
4. otherwise **there is nothing to release** — say so and stop. Cutting an empty release to hit a
   date produces a tag nobody can explain later.

Print the previous version, the signals, and the computed next version before doing anything
irreversible. **Never assert a version number from memory.**

---

## 5. Pre-releases

Use them when the artefact needs real-world exposure before the compatibility promise applies:

```
<NEXT-VERSION>-rc.<N>
<NEXT-VERSION>-beta.<N>
```

- Pre-release tags are still immutable — `rc.1` is never re-published as different bytes.
- Package managers must not resolve a pre-release by default; verify your ecosystem's behaviour.
- Have an exit rule: "after `<N>` days with no `<SEVERITY>` bug, `rc.N` is promoted to the final
  version **with the same digest**". Promotion is a retag, not a rebuild.

---

## 6. Monorepos

Two coherent options. Pick one; mixing them is what produces unexplainable version histories.

**Independent versions.** Tag `<package>/v<VERSION>`, derive each package's bump from the commits
touching its paths.
*Pros:* consumers only see changes that affect them.
*Cons:* cross-package compatibility must be tracked explicitly, and "which versions work
together?" becomes a real question needing a real answer.

**Locked versions.** One version for everything; every package releases together.
*Pros:* trivially answerable compatibility.
*Cons:* consumers see MAJOR bumps for packages that did not change, which trains them to ignore
version numbers.

Deriving a per-package bump:

```bash
LAST=$(git describe --tags --abbrev=0 --match '<PACKAGE>/v*')
git log "$LAST"..HEAD --pretty='%h %s' -- packages/<PACKAGE>/
```

---

## 7. Common mistakes

| Mistake | Consequence |
|---|---|
| Version asserted from memory | The tag does not match the changelog or the artefact |
| Bumping MINOR for a breaking change "because it is small" | Consumers break on an upgrade they were told was safe |
| Re-publishing a tag after a mistake | Anyone who pinned it gets different bytes with the same name; the audit trail is destroyed |
| Deleting a bad tag | Breaks every consumer pinned to it; publish a patch and yank instead |
| Encoding meaning in build metadata | It is ignored in precedence; two "different" versions compare equal |
| Tagging a commit CI never built | The artefact and the tag describe different code |
| Cutting an empty release to hit a date | A tag with no content and no explanation |
