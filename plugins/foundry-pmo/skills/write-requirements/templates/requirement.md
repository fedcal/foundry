---
id: REQ-{{nnnn}}
kind: {{functional|non-functional|constraint|regulatory}}
priority: {{must|should|could|wont}}
owner: {{named person}}
status: {{draft|accepted|superseded}}
created: {{YYYY-MM-DD}}
supersedes: {{REQ-nnnn|null}}
---

# REQ-{{nnnn}} — {{title}}

> Title states the capability. No technology, no UI element, no unquantified adjective.

## User story

As a {{specific role — not "user"}},
I want {{capability}},
so that {{outcome for that role}}.

*(Functional requirements only. Omit for constraint, regulatory and most non-functional entries.)*

## Rationale

Why this exists, and what happens if it does not. One paragraph. If nothing happens, reconsider
the priority.

## Acceptance criteria

### AC1 — happy path

```
Given {{concrete prior state}}
When  {{exactly one action}}
Then  {{observable outcome}}
```

### AC2 — rejection path

```
Given {{state that makes the action invalid}}
When  {{the action}}
Then  {{what the actor sees}}, {{what the system records}}, {{resulting system state}}
```

### AC3 — boundary

```
Given {{state at the edge of the accepted range}}
When  {{the action}}
Then  {{outcome, and the outcome one unit beyond the edge}}
```

*(Every `must` requires at least one of each of the three kinds above.)*

## Measurable target

*(Non-functional requirements only.)*

| Slot | Value |
|---|---|
| Metric | {{e.g. p95 server response for GET /orders}} |
| Comparator and value | {{≤ 300}} |
| Unit | {{ms}} |
| Condition | {{200 req/s sustained}} |
| Observation window | {{rolling 1 h}} |
| Measurement method | {{at the load balancer, via <tool>}} |
| Standard cited | {{ISO/IEC 25010:2023 Performance efficiency / WCAG 2.2 SC x.x.x / OWASP ASVS 4.0 V-x.x / GDPR Art. x / RFC nnnn}} |
| Baseline today | {{measured value, or "unmeasured — see task <id>"}} |
| Consequence of missing it | {{alert, error-budget freeze, contractual penalty, or nothing}} |

## Out of scope

What this requirement deliberately does not cover, so the boundary is not renegotiated during
implementation.

- {{...}}

## Assumptions

- {{Each one a thing that, if false, changes this requirement.}}

## Open questions

| Question | Awaiting | Since | Blocks |
|---|---|---|---|
| {{exact question}} | {{named person}} | {{YYYY-MM-DD}} | {{what cannot proceed}} |

*(A requirement with open questions is not `accepted`. Questions open more than 5 working days
are escalated to the risk register.)*

## Traceability

| Link | Reference |
|---|---|
| Design decision | {{adr-nnnn}} |
| Tests | {{test:path#name, tagged @REQ-nnnn}} |
| Work item | {{issue:#nnn}} |
| Released in | {{release:vX.Y.Z}} |
| Compliance control | {{control id, if any}} |

## Glossary terms used

Terms defined elsewhere as `fact.v1` of type `glossary`, so they mean one thing project-wide.

- {{term}} — [[fact-nnnn]]
