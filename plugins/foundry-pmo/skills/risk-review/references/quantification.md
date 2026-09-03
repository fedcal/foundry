# Quantifying risk

## Probability: use bands, never free-hand numbers

Free-hand probabilities cluster at 0.5 and are unauditable. Bands are comparable across risks and
across reviews, which is what makes trend analysis possible.

| Band | Value | Meaning | Rough frequency |
|---|---|---|---|
| Rare | 0.05 | No precedent here or in comparable projects; would surprise a domain expert | 1 in 20 |
| Unlikely | 0.15 | Happened elsewhere; specific conditions here make it improbable | 1 in 7 |
| Possible | 0.35 | Plausible; comparable projects see it occasionally | 1 in 3 |
| Likely | 0.60 | More often than not, absent mitigation; team members expect it | 3 in 5 |
| Almost certain | 0.85 | Early signals already visible; only the timing is uncertain | 5 in 6 |

Record the **band name** in the artifact text, not only the number. Six months later "Possible"
is interpretable; "0.35" is not.

Anything you would call *certain* is not a risk. It is a known cost — put it in the plan.

### Calibration checks

- **Would you bet at these odds?** At probability 0.35 with a 96 000 EUR impact, would you accept
  a wager paying out on the risk occurring? If the number feels wrong to bet on, it is wrong.
- **Base rate first.** How often has this happened across comparable projects? Start there, then
  adjust for what is specific here. Starting from intuition and skipping the base rate produces
  systematically low numbers.
- **Track your record.** Over a year, of the risks scored "Possible", roughly a third should have
  occurred. If almost none did, the whole register is inflated and nobody will act on it. If most
  did, it is deflated and the register provides false comfort. Both are correctable, and neither
  is correctable without keeping score.

## Impact: always a range

```
impact = direct_cost
       + (delay_days × day_rate)
       + revenue_at_risk
       + remediation_cost
       + regulatory_exposure
```

Estimate each component as optimistic / likely / pessimistic, then combine. `impactEur` is the
PERT expected value `(o + 4m + p) / 6` — and the artifact must state that it is a PERT value of a
range, not a measured figure.

### Deriving each component

**Direct cost.** Extra licences, emergency support, expedited shipping, consultants. Usually the
easiest to bound, and usually the smallest term.

**Delay days.** Recompute the critical path with the risk realised and subtract the baseline. Do
not guess "about two weeks" — the graph gives the number, and the graph accounts for whether the
delay is on the critical path at all. A three-week delay to a task with four weeks of slack costs
nothing.

**Day rate.** Fully loaded team cost per calendar day, from a `metric` fact.

> **If you do not have a day rate, report exposure in days only** and say explicitly that the
> euro figure is unavailable. An invented rate silently propagates into every exposure figure and
> into the escalation thresholds that depend on them.

**Revenue at risk.** `affected_transactions × value × duration`, from measured traffic. Never
invent a revenue figure. If the measurement does not exist, mark `impactEur` partial and name the
missing component — a partial number with a stated gap is usable; a fabricated one is not.

**Remediation cost.** Rework hours × rate, plus incident response, plus customer communication,
plus any credits or refunds. Historical incidents are the best source:

```bash
gh issue list --label 'sev:1' --state closed --limit 50 \
  --json number,title,createdAt,closedAt \
  --jq '.[] | {n:.number, hours: (((.closedAt|fromdate)-(.createdAt|fromdate))/3600|floor), title}'
```

**Regulatory exposure.** Only when a competent source states it, and only with the article cited.
Never quote a maximum fine as though it were the expected outcome — statutory maxima are almost
never levied, and quoting one as the impact makes the whole register look unserious. Refer to
`foundry-legal` and record what they say, not what you inferred.

## Exposure and ranking

```
exposureEur = probability × impactEur
```

Report **total open exposure as a range**:

```
Σ (probability_i × optimistic_i)  …  Σ (probability_i × pessimistic_i)
```

Ranking by exposure is right in general and wrong in one important case.

### The existential override

A risk that could end the organisation, revoke a licence, or harm someone must rank first
regardless of expected value. Expected-value ranking assumes you can absorb the loss and play
again; for existential risks that assumption is false, so the arithmetic does not apply.

Mark these `existential` in the title. A 2% chance of a company-ending event has a small expected
value and an unacceptable position, and no spreadsheet should be allowed to average it away.

## Mitigation economics

A mitigation is worth doing when:

```
exposure_before − exposure_after  >  cost_of_mitigation
```

State all three numbers. Two failure modes this catches:

- **Over-mitigation.** Spending 40 000 EUR to remove 10 000 EUR of exposure. It feels responsible
  and it is a net loss. Common with risks that are vivid rather than large.
- **Theatre.** A mitigation that moves neither probability nor impact. "We will monitor it
  closely" is not a mitigation; it is a detection signal, which is a different and also necessary
  thing. Record it as detection and leave the risk unmitigated, honestly.

Residual exposure after mitigation is recorded explicitly. A risk whose mitigation is complete
does not become closed — it becomes a smaller risk, until the *because* clause is no longer true.

## Converting time to money and back

Two directions, both useful:

- **Delay → money**: `delay_days × day_rate` for internal cost, plus `revenue_per_day × delay` if
  the delay defers revenue. State which components you included; "cost of delay" means different
  things to finance and to engineering, and the difference is often a factor of five.
- **Money → time**: when the sponsor thinks in schedule rather than budget, express exposure as
  "equivalent to N days of the whole team". This is frequently more persuasive than a euro figure,
  because a schedule is something they already feel.

Whichever direction you use, show the conversion and its rate. A number whose derivation is
invisible will be argued with rather than acted on.

## Recording uncertainty about the uncertainty

Sometimes you cannot score a risk at all: no base rate, no impact data, no comparable project.
That is a legitimate finding. Record it as:

```
RISK-021 — <causal chain>
probability: UNSCORED — no base rate available
impact:      UNSCORED — requires traffic data from analytics (owner: M. Bianchi, by 5 Sep)
action:      spike to obtain the data — this is the mitigation for now
reviewBy:    2026-09-05
```

An honestly unscored risk with an action to score it is more useful than a confident number
someone invented, because it triggers the work that makes the number real.
