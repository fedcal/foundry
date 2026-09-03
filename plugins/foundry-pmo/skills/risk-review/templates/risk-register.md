# Risk register — {{project}}

> Reviewed {{review_date}} by `foundry-pmo:risk-review`. Previous review: {{previous_review}}.
> Every probability comes from a named calibration band; every impact is the PERT expected value
> of a stated three-point range. Figures marked *partial* name the component that could not be
> computed.
> {{#gh_unavailable}}**Repository signals were unavailable ({{gh_error}}); detection checks
> marked unread rather than "did not fire".**{{/gh_unavailable}}

## Position

| | Now | Previous | Change |
|---|---|---|---|
| Open | {{open}} | {{open_prev}} | {{open_delta}} |
| Mitigating | {{mitigating}} | {{mitigating_prev}} | {{mitigating_delta}} |
| Accepted | {{accepted}} | {{accepted_prev}} | {{accepted_delta}} |
| Closed this period | {{closed}} | — | — |
| Materialised this period | {{materialised}} | — | now tracked as issues: {{materialised_issues}} |
| **Total open exposure** | **{{exposure_expected}}** (range {{exposure_low}}–{{exposure_high}}) | {{exposure_prev}} | {{exposure_delta}} |
| Past `reviewBy` | {{overdue}} | {{overdue_prev}} | {{overdue_note}} |

Escalation thresholds in force ({{threshold_source}}): {{thresholds}}

## Escalated at this review

{{#escalations}}
### {{id}} — {{title}}

| | |
|---|---|
| To | {{escalate_to}} |
| Response needed by | {{response_by}} |
| Crossed | {{threshold_crossed}} |
| Exposure | {{exposure}} (P {{probability}} × impact {{impact}}; range {{impact_range}}) |
| Change since last review | {{exposure_change}} |

**Options**

{{#options}}
- **{{label}}** — cost {{cost}}; effect {{effect}}; gives up {{tradeoff}}
{{/options}}

**Recommendation:** {{recommendation}}
**Requested decision:** {{requested_decision}}

{{/escalations}}

{{^escalations}}
None. No risk crossed a threshold this period.
{{/escalations}}

## Open risks, by exposure

{{#existential_note}}
Risks marked **existential** are listed first regardless of expected value: expected-value
ranking assumes the loss is absorbable, which for these it is not.
{{/existential_note}}

| id | Risk | Cat | P (band) | Impact | Exposure | Δ | Owner | Status | Review by |
|---|---|---|---|---|---|---|---|---|---|
{{#risks}}
| {{id}} | {{title}} | {{category}} | {{probability}} ({{band}}) | {{impactEur}} | {{exposureEur}} | {{delta}} | {{owner}} | {{status}} | {{reviewBy}} |
{{/risks}}

## Detail

{{#risk_details}}
### {{id}} — {{title}} {{#existential}}**[EXISTENTIAL]**{{/existential}}

**Causal chain.**
Because {{because}}, {{event}} may occur {{when}}, which would cause {{consequence}} costing
{{impact_range}}.

| | |
|---|---|
| Category | {{category}} |
| Probability | {{probability}} — band *{{band}}*{{#band_changed}} (was *{{band_prev}}*){{/band_changed}} |
| Impact | {{impactEur}} EUR — PERT of {{o}}/{{m}}/{{p}}{{#partial}} — **partial: {{partial_reason}}**{{/partial}} |
| Exposure | {{exposureEur}} EUR{{#exposure_changed}} — was {{exposure_prev}} ({{exposure_change}}){{/exposure_changed}} |
| Owner | {{owner}} |
| Status | {{status}} |
| Review by | {{reviewBy}} — cadence: {{cadence_reason}} |

**Detection.** {{detection}}
Checked {{review_date}}: {{detection_result}}

**Mitigation** ({{strategy}}). {{mitigation}}
- Owner: {{mitigation_owner}} — by {{mitigation_by}} — tracked as {{mitigation_task}}
- Cost: {{mitigation_cost}}
- Residual after mitigation: P {{residual_probability}}, impact {{residual_impact}}, exposure {{residual_exposure}}
- Worth doing: {{worth_doing}} (exposure removed {{exposure_removed}} vs. cost {{mitigation_cost}})

**Contingency.** {{contingency}}
Activation trigger: {{contingency_trigger}}

**Assumptions behind the numbers.**
{{#assumptions}}
- {{.}}
{{/assumptions}}

{{/risk_details}}

## Accepted risks — re-confirmed this review

| id | Risk | Exposure | Accepted by | Accepted on | Still conscious? |
|---|---|---|---|---|---|
{{#accepted_risks}}
| {{id}} | {{title}} | {{exposureEur}} | {{accepted_by}} | {{accepted_on}} | {{reconfirmed}} |
{{/accepted_risks}}

## Closed this period

| id | Risk | Why closed |
|---|---|---|
{{#closed_risks}}
| {{id}} | {{title}} | {{close_reason}} |
{{/closed_risks}}

> A risk is closed only when its *because* clause is no longer true, or the window in which it
> could occur has passed. Never because it has been quiet.

## Categories with no risks this review

{{#empty_categories}}
- **{{category}}** — {{reason}}
{{/empty_categories}}

## Detection signals that could not be read

{{#unread_signals}}
- {{id}} — `{{command}}` failed: {{error}}. Reported as **unread**, not as "did not fire".
{{/unread_signals}}

## Unscored risks

| id | Risk | What is missing | Who obtains it | By |
|---|---|---|---|---|
{{#unscored}}
| {{id}} | {{title}} | {{missing}} | {{owner}} | {{by}} |
{{/unscored}}

---
Next scheduled review: {{next_review}} — earlier if a detection signal fires.
