# Source of truth for reference documentation

## The ladder

Exactly one artifact is authoritative. Everything else is derived from it or is a finding.

| Rank | Artifact | Drift distance | Notes |
|---|---|---|---|
| 1 | The code and its type signatures | zero | cannot disagree with itself; the reason typed languages get better reference for free |
| 2 | In-source annotations — Javadoc, TSDoc/JSDoc, Python docstrings, Rust `///`, Go doc comments, protobuf comments | one review away | reviewed in the same pull request as the change, which is what keeps them true |
| 3 | Machine-readable contract **generated from** code — OpenAPI emitted by the framework, compiled protobuf descriptors, JSON Schema exported from the model | one build step | authoritative provided the generation runs in CI |
| 4 | Hand-maintained contract file | unbounded | authoritative **only** with contract tests enforcing it against the implementation |
| 5 | Prose tables in markdown or a wiki | unbounded, undetectable | not a source of truth; this is the artifact being replaced |

**Rank 4 without contract tests collapses to rank 5.** A hand-written `openapi.yaml` that
nothing verifies is prose in YAML syntax.

## Code-first vs. spec-first

Both are legitimate. What is not legitimate is not knowing which one you are doing.

### Code-first

Annotations in the implementation produce the contract.

- **Strength:** the contract cannot describe an endpoint that does not exist, because it is
  derived from the routes that do.
- **Weakness:** the contract inherits the implementation's accidents. Internal field names,
  leaked serialisation details and undocumented nullability all become public API by accident.
- **Required gate:** regenerate in CI and diff (gate A). Plus a review rule that treats a
  contract diff as an API change requiring explicit approval.
- **Required discipline:** review the generated contract, not just the code. Otherwise the API
  is designed by whoever last renamed a field.

### Spec-first

The contract is written first and generates server stubs, clients and mocks.

- **Strength:** the API is designed rather than emitted; consumers can start before the server
  exists.
- **Weakness:** the implementation drifts from the spec it was scaffolded from, and nothing
  notices, because the spec is no longer regenerated.
- **Required gate:** contract conformance tests running the real implementation against the
  spec (gate B).
- **Required discipline:** the spec is versioned, reviewed and released like code, with a
  breaking-change gate.

### Choosing when a project has three competing artifacts

The common mess: annotations in the code, a hand-edited `openapi.yaml`, and a wiki page. Resolve
it, do not document around it.

1. Diff all three against the actual routes served by a running instance. Whichever is closest
   to reality is the de facto source of truth, regardless of what anyone intended.
2. Pick the target architecture based on who consumes the API:
   - External consumers, SDKs, or partners → **spec-first**. The contract is a product.
   - Internal-only, one team, fast iteration → **code-first**. Lower ceremony, adequate.
3. Delete the losers in the same pull request that adds the gate. Leaving a stale artifact in
   place guarantees someone will read it — search engines do not know which file you demoted.
4. Add a redirect or a one-line stub at the old location pointing at the new one, rather than a
   404, for anything that was publicly linked.

## Per-ecosystem notes

These describe the shape of each ecosystem's tooling, not specific versions. Verify the exact
tool and its flags against the project's own build configuration, and pin whatever you use.

| Ecosystem | Typical source of truth | Generation shape | Common trap |
|---|---|---|---|
| Java / Kotlin | Javadoc/KDoc + framework annotations | Javadoc HTML; OpenAPI emitted by the web framework | annotations describing the DTO, not the wire shape after a custom serialiser |
| TypeScript | exported types + TSDoc | TypeDoc; JSON Schema from runtime validators | `any` and index signatures silently erase the reference |
| Python | type hints + docstrings | Sphinx/autodoc or an equivalent; OpenAPI from the framework | dynamic route registration invisible to the generator |
| Go | doc comments | the toolchain's own doc command | unexported types leaking through exported function signatures |
| Rust | `///` doc comments with doctests | the toolchain's doc command | doctests are the strongest example verification in any ecosystem — use them |
| gRPC / protobuf | `.proto` files and their comments | descriptor-driven generators | comments omitted from generated code, so the contract carries them but the SDK does not |
| CLI | the argument parser definition | `--help` capture, or a generator over the parser | help text drifting from behaviour when flags are handled outside the parser |
| Config / env vars | the schema object that validates them | schema-to-markdown generation | env vars read ad hoc with `getenv` and never declared anywhere |

The config/env-var row deserves attention: environment variables are the most commonly
hand-documented and most commonly wrong reference surface in any project. Make the validation
schema the source of truth, then generate the table:

```bash
# find env vars read outside the declared schema
grep -rnoE '(process\.env\.[A-Z0-9_]+|os\.getenv\("[A-Z0-9_]+"|System\.getenv\("[A-Z0-9_]+")' src/ \
  | sed -E 's/.*[.("]([A-Z0-9_]+).*/\1/' | sort -u
```
Anything in that list and not in the schema is undocumented configuration, which is
undocumented behaviour.

## Fields a generator cannot invent

Write these into the annotations, never into the generated output:

- What a parameter **means** and what constrains it, beyond its name and type.
- Defaults, read from the code rather than remembered.
- **Every** error status the operation can return, with the error schema and its cause.
- Authentication scheme, required scope or permission.
- Rate limits, quotas and the response when exceeded.
- Idempotency and retry safety.
- Pagination mechanism, limits, and ordering guarantees.
- Deprecation: machine-readable marker, replacement, removal version. Never "soon".
- Stability level, if the project has one (experimental / stable / frozen).

## The rule this all serves

> Reference documentation is generated from the source of truth and verified against the
> running system. It is never hand-maintained.

Every exception to this rule that a project grants itself becomes wrong within one release
cycle, and nobody finds out until a consumer files an issue. Record the exception as a
`finding.v1` rather than a convention.
