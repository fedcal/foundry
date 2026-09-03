# Turning cost bands into `impactEur` honestly

`risk.v1` requires a number. A fabricated precise number is worse than a band, because it
gets quoted. Rules:

1. Use **order-of-magnitude bands**, and say in the artifact that they are bands.
2. Every figure has a stated basis: a source, a formula, or an explicit assumption.
3. Where the organisation has real numbers (revenue per hour, contractual penalties, record
   counts, historical incident cost), use those and cite them. They beat any model here.

## Band ladder

| Band | `impactEur` to use | Meaning |
|---|---|---|
| minor | 1 000 | annoyance, absorbed by normal operations |
| moderate | 25 000 | a sprint of unplanned work, a few unhappy customers |
| major | 250 000 | material customer loss, contractual exposure, press coverage |
| catastrophic | 2 500 000 | existential: mass breach, regulatory action, loss of the licence to operate |

Pick the band from the worst of the three CIA columns for the assets crossing the boundary,
then adjust with the components below if real numbers exist.

## Components, when data exists

**Data breach**: `records_in_scope * per_record_cost + notification_cost + forensics +
legal`. Take `per_record_cost` from your own insurer or an industry report you can cite;
do not invent one. Regulatory exposure under GDPR Art. 83 is capped as a percentage of
global turnover — model the realistic enforcement band, not the theoretical maximum, and
mark it as an assumption.

**Downtime**: `hours_of_outage * revenue_per_hour + SLA_credits + recovery_labour`. Use the
contractual SLA credit schedule where it exists; it is a real, computable number.

**Fraud / money movement**: the ceiling reachable before detection —
`transaction_limit * transactions_before_alert`. If detection latency is unknown, that is
itself a finding: put it in `detection`.

**Integrity corruption**: `records_affected * cost_to_verify_and_repair`, plus the cost of
decisions already taken on the bad data. Frequently larger than the breach cost and almost
always underestimated.

**Remediation labour**: `engineer_days * loaded_day_rate`, including the incident, the fix,
the regression tests and the customer communication.

## Anti-patterns

- Averaging across a wide band to produce a false-precision figure (`137 482 EUR`).
- Using the regulatory maximum as the impact for every privacy risk — it makes ranking
  impossible because everything becomes catastrophic.
- Counting reputational damage as a free-form multiplier. If you cannot express it as
  churn or lost pipeline, leave it in the narrative and out of the number.
- Letting `impactEur` be driven by the STRIDE category name rather than the asset.

## Recording the assumption

Put the basis into the risk object where it survives:

```
"detection": "Alert on cross-tenant read; impactEur basis: 40k customer records x 6 EUR/record + 10k notification (band: major, assumption not measured)"
```

If the organisation later measures the real figure, the band is replaced and the ranking is
recomputed. A model whose assumptions are visible can be corrected; one whose numbers appear
from nowhere cannot.
