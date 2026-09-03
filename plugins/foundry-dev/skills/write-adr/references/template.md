# ADR template (Foundry, MADR-derived)

Copy everything between the two `=== TEMPLATE ===` markers into the reserved file
`docs/adr/NNNN-<slug>.md` and replace every `<…>` placeholder.

The structure is derived from the Markdown Any Decision Records (MADR) shape — status, context,
drivers, options, outcome, consequences — with three Foundry additions that MADR does not have:
the **decision class**, the **scoring table** and the **fitness function**. The wording below is
original to Foundry.

Field-by-field correspondence with `adr.v1` is given in the comment after each heading, so the
markdown and the artifact can never drift.

=== TEMPLATE ===

# <NNNN>. <Verb the object> 

<!-- adr.v1: number (integer, unpadded) + title (<=120 chars). An assertion, never a question. -->

- **Status:** <proposed | accepted | rejected | deprecated | superseded>
- **Date:** <YYYY-MM-DD>
- **Deciders:** <name or role, comma separated>
- **Decision class:** <one-way door | two-way door>
- **Supersedes:** <ADR-NNNN | —>
- **Superseded by:** <— | ADR-NNNN>
- **Review by:** <YYYY-MM-DD | n/a — permanent>

## Context

<!-- adr.v1: context -->

<What is true today, and what changed to force this decision now. Present tense.
No solution vocabulary. Two short paragraphs maximum.
If a reader cannot answer "why now?" after this section, rewrite it.>

Constraints treated as fixed (not decided here):

- <constraint, and who owns it — legal, ops, an earlier ADR number>
- <constraint>

## Decision drivers

<!-- adr.v1: drivers[] -->

Each driver is a quality-attribute scenario ending in a measure with a unit, mapped to its
ISO/IEC 25010:2023 characteristic.

| # | Driver (source → stimulus → response measure) | 25010 characteristic | Weight |
|---|---|---|---|
| D1 | <…, measured as <number><unit>> | <characteristic> | <n> |
| D2 | | | |
| D3 | | | |
| | | **Total** | **100** |

## Considered options

<!-- adr.v1: options[] — minimum 2, and they must differ structurally, not by vendor name -->

### Option A — <name>

<One paragraph: what this actually is, in enough detail that a reader can picture the runtime.>

- **Pros:** <…> / <…>
- **Cons:** <…> / <…>
- **Cost:** build <n> person-days · run <n> <currency>/month · **reverse in 12 months** <n> person-days

### Option B — <name>

- **Pros:** <…> / <…>
- **Cons:** <…> / <…>
- **Cost:** build <n> · run <n> · reverse <n>

### Option C — Keep <what exists today> unchanged

<Always present. If it was never a candidate, say in one sentence why it is structurally
disqualified — that sentence is often the real decision.>

- **Pros:** <…>
- **Cons:** <…>
- **Cost:** build 0 · run <n> · reverse 0

## Scoring

Score 0–5 per driver. 4 and 5 require an evidence pointer in the footnote; an unevidenced 5 is
downgraded to 3 automatically.

| Driver | Weight | A | B | C |
|---|---|---|---|---|
| D1 | <n> | <s> | <s> | <s> |
| D2 | <n> | | | |
| D3 | <n> | | | |
| **Weighted total** | **100** | **<Σ>** | **<Σ>** | **<Σ>** |

Evidence: <D1/A: benchmark command or URL> · <D2/B: vendor SLA clause> · <…>

**Sensitivity:** moving the top weight to the runner-up characteristic <does | does not> change
the winner. Removing every unevidenced score <does | does not> change the winner.

## Decision outcome

<!-- adr.v1: decision -->

We will <chosen option>, because <the driver that dominated, with its measure>.

<If the top two were within 10%: say so, and say that the tie was broken on reversibility.>

## Consequences

<!-- adr.v1: consequences.positive / .negative / .risks -->

**Positive**

- <effect, stated against the driver measure it satisfies>
- <effect>

**Negative**

- We accept <quality characteristic> at <level> in exchange for <characteristic> at <level>.
- <other cost we are knowingly taking on>

**Risks**

| Risk | Detection signal | Mitigation | Owner |
|---|---|---|---|
| <what could make this wrong> | <the metric/alert that fires first> | <action> | <role> |

## Fitness function

The check that fails when this decision is silently violated:

```bash
<exact command, e.g. an ArchUnit test id, an eslint boundary rule, a k6 threshold run, or a grep>
```

Wired into: <CI job name / file path>. Failure means: <what a developer must do>.

## Implementation notes

- Affected components: <paths>
- Migration/rollout: <steps, or the ADR number of the plan>
- Exit path if we are wrong: <the concrete first step of reversal>

## Related

- Supersedes / superseded by: <ADR-NNNN>
- Depends on: <ADR-NNNN>
- Requirements: <requirement ids>
- Memory fact: <fact-NNNN>

=== TEMPLATE ===

## Filling rules that reviewers actually enforce

1. **No question titles.** "Which database?" is a ticket. "Use Postgres as the event store" is a
   decision.
2. **Context must justify the timing.** "We have always wanted to" is not context.
3. **Drivers carry units.** ms, req/s, €, days, %, records. Anything without a unit is an opinion
   and will be argued about forever.
4. **Weights sum to 100, at most three above 15.**
5. **The "keep what exists" option is mandatory** and must be scored honestly.
6. **At least one negative names the sacrificed characteristic.** An ADR with only cosmetic
   downsides was written to justify a decision already taken.
7. **The fitness function is a command, not an intention.**
8. **Nothing is edited after acceptance** except the status line.
