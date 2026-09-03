# Detection matrix — mapping probe output to a decision

Run each probe from `SKILL.md` step 1. Match the output to a row. When no row matches, stop and
ask; do not guess a convention into existence.

## Web stack

| Probe output | Decision |
|---|---|
| `spring-boot-starter-web` only | Spring MVC. Proceed. `MockMvc` for slice tests. |
| `spring-boot-starter-webflux` only | Reactive. **Stop.** This skill does not cover WebFlux. |
| Both present | Ambiguous — Spring MVC wins at runtime when both are on the classpath, but the combination is almost always accidental. Emit a `finding.v1` (severity `medium`) and confirm with the caller before proceeding. |

## Architectural style

Look at the directory listing under `src/main/java`.

| Shape | Style | Where the new files go |
|---|---|---|
| `.../web`, `.../service`, `.../repository`, `.../model` | Layered | Controller in `web`, service in `service`, repository in `repository`, DTOs in `web/dto`. |
| `.../<feature>/{api,domain,infra}` repeated per feature | Feature-sliced | Everything inside the feature package. Never add a cross-feature import. |
| `.../domain`, `.../application`, `.../adapter/in/web`, `.../adapter/out/persistence` | Hexagonal | Controller in `adapter/in/web`, use case interface (port) in `application/port/in`, implementation in `application`, repository adapter in `adapter/out/persistence`. **`domain` must not import `org.springframework` or `jakarta.persistence`.** |
| A mix | Follow the **most recently modified** controller's package, and state the choice in the report. Do not introduce a third style. |

Hexagonal purity check, run before you finish:

```bash
grep -rn "^import \(org\.springframework\|jakarta\.persistence\|com\.fasterxml\)" \
  src/main/java/**/domain/ --include=*.java
```

Zero hits required.

## DTO convention

| Probe output | Decision |
|---|---|
| `public record XRequest(...)` / `XResponse(...)` present | Records, one per direction. Match the suffix exactly (`Request`/`Response` vs `Command`/`View` — copy what exists). |
| DTO classes with Lombok `@Value` / `@Builder` | Follow it, but still make them immutable. Do not introduce Lombok if it is absent. |
| Entities returned directly from controllers | This is the defect the skill exists to stop. Introduce DTOs for the **new** endpoint, and emit a `finding.v1` for the existing ones rather than refactoring them in the same change. |

## Mapping

| Probe output | Decision |
|---|---|
| MapStruct `@Mapper` interfaces present | Add a mapper method there. Keep mapping out of the controller. |
| Static `from(...)` factory methods on DTOs | Follow that. A `static XResponse from(XEntity e)` is fine and needs no library. |
| Nothing | Use a static factory on the response record. Do **not** add a mapping library for one endpoint. |

## Error model

| Probe output | Decision |
|---|---|
| `@RestControllerAdvice` extending `ResponseEntityExceptionHandler` | Add a handler method there. Reuse the existing `type` URI scheme. |
| `@RestControllerAdvice` not extending it | Spring's own exceptions are handled inconsistently. Add the extension, or emit a `finding.v1` if the change is out of scope for this task. |
| Custom error body (not `ProblemDetail`) | **Do not mix formats in one API.** Follow the existing format for this endpoint and emit a `finding.v1` proposing a migration to RFC 9457 through `api-deprecation`. |
| Nothing | Create exactly one advice. Flag it in the report as an architectural addition. |

## OpenAPI

| Probe output | Decision |
|---|---|
| `springdoc-openapi-*` on the classpath | Code-first. Annotate the operation; regenerate; diff. |
| A committed `openapi.yaml`/`openapi.json` and a generator plugin | Design-first. Edit the spec **first**, regenerate the interfaces, then implement. |
| Both | Emit a `finding.v1`: two sources of truth. Use whichever the CI pipeline consumes. |
| Neither | The API is undocumented. Emit a `finding.v1`; do not invent a spec file format. |

## Test conventions

| Probe output | Decision |
|---|---|
| `@WebMvcTest` classes exist | Copy their naming and their security-test setup (`@WithMockUser` or a custom annotation). |
| `Testcontainers` + `@ServiceConnection` or a shared abstract base class | Extend the existing base class. Never start a second container. |
| `@SpringBootTest` with H2 | Emit a `finding.v1` (severity `high`): H2 is not the production engine. Write the new test against Testcontainers anyway if Docker is available. |
| No integration tests at all | Introduce the Testcontainers base class as part of this change and say so in the report. |

## Persistence

| Probe | Required outcome |
|---|---|
| `grep -rn 'spring.jpa.open-in-view' src/main/resources` | Must be `false`. If unset, Spring's default keeps the persistence context open for the whole request — set it to `false` and run the tests. |
| `grep -rn 'ddl-auto' src/main/resources` | Must be `validate` or `none`. Anything else outside a throwaway sandbox is a `finding.v1`. |
| `grep -rn 'FetchType.EAGER' src/main/java` | Zero in files you touch. |
