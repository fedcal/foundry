# `.spectral.yaml` — the ruleset that enforces this skill

Spectral's built-in `spectral:oas` ruleset checks that a document is a *valid* OpenAPI document.
It does not check that the API is *good*. The rules below encode the decisions in `SKILL.md`, so
a reviewer never has to repeat them in a pull request comment.

Drop this at the repository root and wire `npx @stoplight/spectral-cli lint contracts/**/*.yaml`
into a required CI job. Pin the CLI version from
`${CLAUDE_PLUGIN_ROOT}/references/stack-versions.json`.

```yaml
extends: ["spectral:oas"]

rules:
  # ---------------------------------------------------------------- naming
  foundry-no-verbs-in-paths:
    description: Paths name resources, not actions. Use a sub-resource for non-CRUD operations.
    message: "{{path}}: path segment '{{value}}' looks like a verb"
    severity: error
    given: $.paths[*]~
    then:
      function: pattern
      functionOptions:
        notMatch: "/(get|create|update|delete|cancel|approve|send|process|do)[A-Z_-]?"

  foundry-path-depth:
    description: Nesting deeper than two resource levels exposes the join graph.
    severity: warn
    given: $.paths[*]~
    then:
      function: pattern
      functionOptions:
        notMatch: "^(/[^/]+/\\{[^}]+\\}){3,}"

  foundry-operation-id-required:
    severity: error
    given: $.paths[*][get,put,post,patch,delete]
    then:
      field: operationId
      function: truthy

  # ---------------------------------------------------------------- errors
  foundry-problem-json-only:
    description: Error responses must use application/problem+json (RFC 9457).
    message: "{{path}}: 4xx/5xx must be application/problem+json, found '{{property}}'"
    severity: error
    given: $.paths[*][*].responses[?(@property.match(/^[45]/))].content
    then:
      field: "@key"
      function: pattern
      functionOptions:
        match: "^application/problem\\+json$"

  foundry-error-responses-declared:
    description: Every operation declares at least one 4xx and a 500.
    severity: error
    given: $.paths[*][get,put,post,patch,delete].responses
    then:
      - function: schema
        functionOptions:
          schema:
            type: object
            anyOf:
              - required: ["400"]
              - required: ["401"]
              - required: ["403"]
              - required: ["404"]
              - required: ["409"]
              - required: ["422"]
      - function: schema
        functionOptions:
          schema:
            type: object
            required: ["500"]

  foundry-no-400-for-business-rules:
    description: 400 is for malformed syntax. Business-rule refusals are 422.
    severity: warn
    given: $.paths[*][*].responses['400'].description
    then:
      function: pattern
      functionOptions:
        notMatch: "(?i)(business|rule|invalid state|not allowed|insufficient)"

  # ------------------------------------------------------------ pagination
  foundry-collections-paginated:
    description: A GET returning an array-typed 'items' must accept limit and cursor.
    severity: error
    given: $.paths[*].get
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          properties:
            parameters:
              type: array
              contains:
                anyOf:
                  - properties: { name: { const: cursor } }
                  - properties: { $ref: { pattern: "Cursor$" } }

  foundry-limit-has-maximum:
    description: An unbounded page size is a denial-of-service parameter.
    severity: error
    given: $..parameters[?(@.name=='limit')].schema
    then:
      field: maximum
      function: truthy

  # --------------------------------------------------------- idempotency
  foundry-post-declares-idempotency-key:
    description: Retryable POSTs must declare Idempotency-Key.
    severity: error
    given: $.paths[*].post
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          properties:
            parameters:
              type: array
              contains:
                anyOf:
                  - properties: { name: { const: Idempotency-Key } }
                  - properties: { $ref: { pattern: "IdempotencyKey$" } }

  foundry-mutations-need-if-match:
    description: PUT/PATCH on a resource must require If-Match or last-write-wins loses data.
    severity: warn
    given: $.paths[*][put,patch]
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          properties:
            parameters:
              type: array
              contains:
                properties: { name: { const: If-Match } }

  # ------------------------------------------------------------- schemas
  foundry-no-openapi-30-nullable:
    description: "OpenAPI 3.1 uses JSON Schema 2020-12: nullability is type: [x, 'null']."
    message: "'nullable' is an OpenAPI 3.0 keyword and is ignored in 3.1"
    severity: error
    given: $..[?(@.nullable !== void 0)]
    then:
      field: nullable
      function: undefined

  foundry-no-float-money:
    description: Monetary amounts must not be JSON numbers.
    severity: error
    given: $..properties[?(@property.match(/(amount|price|total|balance)/i))]
    then:
      field: type
      function: pattern
      functionOptions:
        notMatch: "^(number|integer)$"

  foundry-request-bodies-are-closed:
    description: Request schemas set additionalProperties false; response schemas must not.
    severity: warn
    given: $.paths[*][post,put,patch].requestBody.content[*].schema
    then:
      field: additionalProperties
      function: falsy

  foundry-examples-required:
    description: An operation without an example is documentation nobody can use.
    severity: warn
    given: $.paths[*][*].responses[?(@property.match(/^2/))].content[*]
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          anyOf:
            - required: [example]
            - required: [examples]

  # -------------------------------------------------------------- security
  foundry-operation-security:
    description: Every operation declares security explicitly, even public ones (as []).
    severity: error
    given: $.paths[*][get,put,post,patch,delete]
    then:
      field: security
      function: defined

  foundry-401-has-www-authenticate:
    severity: error
    given: $.paths[*][*].responses['401']
    then:
      field: headers.WWW-Authenticate
      function: truthy

  foundry-429-has-retry-after:
    severity: error
    given: $.paths[*][*].responses['429']
    then:
      field: headers.Retry-After
      function: truthy

  # ------------------------------------------------------------ versioning
  foundry-single-major-in-server-url:
    description: Major version lives in the server URL, never per path, never a minor version.
    severity: error
    given: $.servers[*].url
    then:
      function: pattern
      functionOptions:
        match: "/v[0-9]+$"

  foundry-deprecated-needs-sunset:
    description: A deprecated operation must say what replaces it and when it disappears.
    severity: error
    given: $.paths[*][?(@.deprecated == true)]
    then:
      field: description
      function: pattern
      functionOptions:
        match: "(?i)(sunset|removal|removed on|replaced by)"
```

## Severity policy

| Severity | CI behaviour |
|---|---|
| `error` | fails the build. Non-negotiable rules only. |
| `warn` | printed, does not fail. Use for rules with legitimate exceptions (`foundry-path-depth`, `foundry-mutations-need-if-match`). |

Run with `--fail-severity=error`. Do not run with `--fail-severity=warn` "temporarily"; the
temporary state becomes permanent and then someone disables the job.

## Suppressing a rule honestly

Spectral overrides live in the same file and must name the file, the rule and the reason:

```yaml
overrides:
  - files: ["contracts/http/legacy-billing.openapi.yaml#/paths/~1invoices~1recalculate"]
    rules:
      foundry-no-verbs-in-paths: "off"
    # Reason: path is fixed by a partner contract signed 2023; removal tracked in ADR-0031.
```

A suppression without a reason comment and an owning ADR is a defect. Grep for them in review:

```bash
grep -n -A3 "overrides:" .spectral.yaml
```

## AsyncAPI

Spectral also ships an `spectral:asyncapi` ruleset. Extend it in a second file
(`.spectral-async.yaml`) rather than mixing dialects, and add at minimum:

- every `channel` description mentions the partition/ordering key;
- every `channel` description states the delivery semantics (`at-least-once` / `at-most-once`);
- every `operation` has an `action` and a `channel`;
- every message uses the shared envelope trait.

These are prose checks, so implement them as `pattern` rules over `description` — crude, but they
catch the omission, which is the failure mode that actually happens.
