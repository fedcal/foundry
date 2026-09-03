# Sensitivity, scenarios and switching values

The output of a financial model is not a number. It is **an answer to "what would have to be
true for this to be wrong?"** This file is how you produce that answer.

## 1. One-way sensitivity (tornado)

Vary one input across its plausible range with every other input at base, and record the swing
in the decision metric (normally NPV).

```
swing(input) = NPV(input at high) − NPV(input at low)
```

Rank inputs by `|swing|` descending and plot as horizontal bars — the shape gives the technique
its name. The top bar is where the argument lives; everything below the top three is usually
noise, and saying so saves everyone time.

### Getting the ranges right

The ranges are the analysis. Two rules:

- **Use the same subjective confidence level for every input**, e.g. each input's 10th and 90th
  percentile. Mixing a "worst realistic case" for one input with a "slightly bad case" for
  another produces a tornado that ranks your pessimism, not the model's sensitivity.
- **Do not use ±10% mechanically.** A 10% move in churn and a 10% move in office rent are not
  equally plausible. Ranges come from evidence or from a labelled assumption.

## 2. Two-way tables

Take the top two drivers from the tornado and tabulate the decision metric over their grid.
Shade where the sign changes.

|  | driver B low | B mid | B high |
|---|---|---|---|
| **driver A low** | <<TBC>> | <<TBC>> | <<TBC>> |
| **A mid** | <<TBC>> | <<TBC>> | <<TBC>> |
| **A high** | <<TBC>> | <<TBC>> | <<TBC>> |

This is usually the most decision-useful object in the whole pack, because it shows the
**shape** of the decision boundary rather than a point. Readers who distrust the model still
trust the table, since they can locate their own beliefs on it.

Spreadsheet: build it with a two-variable data table, not by copying values — a hand-copied
table silently goes stale the moment an input changes.

## 3. Switching values — the discipline that matters

For each material input, solve for the value at which the conclusion flips.

```
switching value of x = the x for which NPV(x) = 0
margin of error      = (base value − switching value) / base value
```

Spreadsheet: `Goal Seek` (set NPV cell to 0 by changing the input cell), or solve algebraically
where the relationship is linear.

### Reading the margin of error

| Margin | Reading |
|---|---|
| > 50% | Robust to that input. Stop arguing about it. |
| 20–50% | Worth monitoring; name the leading indicator. |
| < 20% | **Fragile.** The decision effectively rests on this input being right. |
| < 0% | The base case already fails on this input. Say so immediately. |

If several inputs sit below 20%, the case is fragile overall. The correct recommendation is
then **buy information before committing capital**: a pilot, a pre-sale, a letter of intent, a
landing-page test, a paid discovery engagement, a two-week spike. Naming the cheap experiment
that de-risks the biggest assumption is frequently worth more than the entire model.

## 4. Scenarios — coherent bundles, not knobs

A scenario is a **story about the world**, with the inputs that story implies. In a genuine
downside, slower sales *and* longer sales cycles *and* higher churn *and* delayed delivery move
together, because they share causes: a weaker market, a worse product-market fit, a distracted
team.

Building a "downside" by moving one input while holding correlated inputs at base understates
the downside — often severely. This is the same correlation error that breaks bottom-up cost
estimates, appearing on the revenue side.

Build at most three:

| Scenario | Narrative | Drivers that move together | Subjective probability |
|---|---|---|---|
| Base | <<TBC: one sentence>> | — | <<TBC>> |
| Downside | <<TBC: what world are we in?>> | <<TBC>> | <<TBC>> |
| Upside | <<TBC>> | <<TBC>> | <<TBC>> |

```
Expected NPV = Σ P(scenario) × NPV(scenario)
```

Attach probabilities even though they are subjective. A challengeable number beats an
unstated intuition — and the argument about the probability is the argument worth having.

### Scenarios are not a substitute for sensitivity

Three scenarios give three points. Sensitivity gives the surface. Do both: scenarios for
communication, sensitivity for understanding.

## 5. Counting the assumptions that must all hold

If a base case requires nine independent assumptions each with a 90% chance of holding, the
chance all hold is `0.9^9 ≈ 0.39`. State this arithmetic explicitly when the base case has many
independent legs.

Two honest caveats to add whenever you use it:

- The assumptions are usually **not** independent, which cuts both ways — correlated
  assumptions fail together, so the probability of total success is higher than the naive
  product but the downside is far worse than the naive product implies.
- The 90% figures are subjective. The point of the calculation is not the number; it is to
  make visible that a base case is a **conjunction**, and conjunctions get less likely with
  every additional term. This is the arithmetic behind the observation that plans built from
  individually reasonable assumptions are systematically optimistic.

## 6. The closing statement — mandatory

Every business plan ends with this paragraph, filled in:

> The conclusion depends most on **<input>**. It flips from go to no-go if **<input>** is worse
> than **<switching value>**, which is **<margin>%** from the base assumption of **<base>**.
> That assumption is currently **<[ASSUMPTION — confirm] / [given by <who>]>**, and the
> cheapest way to test it before committing is **<specific, concrete, time-boxed test>**.

If you cannot fill this in, the analysis is not finished. A model that cannot name its own
weakest joint has not been interrogated — it has only been built.

## 7. Presenting sensitivity without losing the room

- Lead with the switching value, not the NPV. Decision-makers argue about assumptions, not
  about your arithmetic, and the switching value is where the argument belongs.
- Show the two-way table before the tornado. It is more intuitive to a non-modeller.
- Never present a point estimate with decimal places when the inputs are placeholders.
  Precision that the inputs do not support destroys trust in the parts that are solid.
- If the recommendation flips inside the plausible range, **say the decision is genuinely
  uncertain** and recommend the information-buying experiment. Manufacturing a recommendation
  from an uncertain model is the single most expensive thing an analyst can do.
