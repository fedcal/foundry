# `.foundry/economics/budget.json` — the control configuration

Holds the baseline reference, the escalation thresholds and the actual-cost sources. Kept as a
file so thresholds are **agreed once and applied mechanically**, rather than renegotiated by
whoever is presenting the red report.

Commit it. Changes to it are decisions and should appear in the git history with a reason.

## Shape

```json
{
  "baseline": {
    "artifact": ".foundry/blackboard/estimation/cost-engineer.json",
    "approvedOn": "YYYY-MM-DD",
    "approvedBy": "<name/role>",
    "bac": 0,
    "currency": "EUR",
    "contingency": {
      "amount": 0,
      "heldBy": "project | sponsor",
      "insideBac": true
    }
  },
  "cadence": "monthly",
  "cutoffDay": 5,
  "earningRules": {
    "<work-package-id>": "0/100 | 50/50 | milestone | units | level-of-effort"
  },
  "thresholds": {
    "amber": { "cpiBelow": 0, "vacPercentOfBac": 0 },
    "red": { "cpiBelow": 0, "vacPercentOfBac": 0 }
  },
  "escalation": {
    "amber": { "action": "written explanation + dated recovery action", "to": "<role>" },
    "red": { "action": "stop-and-decide: re-baseline, de-scope or fund", "to": "<role>" }
  },
  "actualsSources": {
    "personnel": "<timesheet system / export path>",
    "purchases": "<purchase ledger / export path>",
    "cloud": ".foundry/economics/cost/*.csv",
    "ai": ".foundry/metrics/events.jsonl + .foundry/economics/pricing.json"
  },
  "rebaselines": []
}
```

## Field notes

| Field | Why it matters |
|---|---|
| `baseline.artifact` | The **approved** estimate, not the latest one. Without this, "the budget" silently drifts into meaning "the current forecast" and variance measurement stops existing. |
| `baseline.approvedOn` / `approvedBy` | Someone approved a number on a date. Record who, so the conversation about the overrun has a starting point. |
| `contingency.insideBac` | Decides whether the project looks over budget the first time a risk materialises. Agree it in writing at setup, not during a variance review. |
| `contingency.heldBy` | Sponsor-held contingency means the project must ask. That is a control, and it changes behaviour. |
| `cutoffDay` | Late invoices flip a period from green to red and back. A fixed cut-off makes periods comparable. |
| `earningRules` | Per work package, agreed **before** the first review. Choosing the rule afterwards is choosing the answer. |
| `thresholds` | Zeros here are placeholders, not thresholds. A config full of zeros means the thresholds were never agreed — say so rather than defaulting. |
| `escalation.to` | A role, not a person, so the control survives staff changes. |
| `actualsSources` | An actual whose source is not named is not an actual. |
| `rebaselines` | Append-only. See below. |

## Threshold guidance

Thresholds are `[given]` by the sponsor. Propose, do not invent. When proposing, base them on
something rather than on a round number:

- What size of overrun would actually change a decision here?
- What is the sponsor's tolerance, given the funding available?
- What CPI has this team historically achieved? A threshold below its normal variation fires
  constantly and gets ignored; one above it never fires at all.

Both failure modes destroy the control. A threshold that fires every period is noise; one that
never fires is decoration.

## Re-baseline records

Append-only. Never edit or remove an entry.

```json
{
  "date": "YYYY-MM-DD",
  "oldBac": 0,
  "newBac": 0,
  "reason": "<approved scope change reference>",
  "approvedBy": "<name/role>",
  "originalBaselineStillTracked": true
}
```

`originalBaselineStillTracked` must stay `true`. Reporting against the original baseline in
parallel, for the rest of the project, is what prevents re-baselining from being used to erase
history. A project re-baselined three times with no memory of the original number does not have
a budget; it has a running total.

## Degrading gracefully

If the file does not exist, `budget-tracking` runs in `setup` mode and **proposes** it. It does
not invent thresholds, does not assume a BAC, and does not guess who approves an escalation.
The output of a setup run against a missing config is a populated draft plus the explicit list
of decisions a human must make:

1. What is the approved BAC, and does it include contingency?
2. Who holds contingency?
3. What CPI and VAC levels are amber and red?
4. Who receives an amber escalation? A red one?
5. Where does each category of actual cost come from, and on what cut-off day?
6. What is the review cadence?

Until those six are answered, there is no budget control — only a spreadsheet.
