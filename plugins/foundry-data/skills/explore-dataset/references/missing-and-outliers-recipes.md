# Missingness and outlier recipes

## Missingness: test the mechanism, do not just report the percentage

A percent-missing table alone does not tell you whether it is safe to impute, drop, or use
missingness itself as a signal. Test the mechanism before deciding:

1. **MCAR check (missing completely at random).** For each column with missing values, compare
   the distribution of every *other* column between rows where it is missing and rows where it is
   not (a two-sample test per candidate column, or a simple comparison of means/proportions for a
   quick pass). If nothing differs, MCAR is plausible.
2. **MAR check (missing at random given something else).** If step 1 finds a column whose values
   differ systematically between the missing and non-missing groups, missingness is explained by
   that other column — condition on it before imputing (impute within each group of that other
   column separately, not globally).
3. **Missingness on the target (a special case of step 2, with a leakage risk).** If missingness
   correlates with the target, missingness is informative and must not be imputed away silently.
   The target is an observed column, so this is still MAR — conditional on the target — not MNAR;
   name it that way in the profile doc. Add an explicit `<column>_was_missing` indicator feature,
   and re-run the leakage sentence test from step 7 of the main skill on that indicator — it is
   exactly the kind of feature that leaks when the reason a value is missing is that the outcome
   already happened.

**MNAR is not on this list, because it cannot be tested from the extract.** Missing not at random
means missingness depends on the *unobserved* value itself (high earners declining to report
income), and no statistic computed on the rows you have can distinguish it from MAR — the
distinguishing information is precisely what is absent. It is a domain judgement about the
data-generating process, argued from how the data was collected, and its correct output is a
disclosed limitation, not a "tested: MNAR" line. Writing MNAR into the profile doc as a mechanism
that was checked converts an untestable assumption into a false verification.

Record, per column with non-trivial missingness: percent missing, which mechanism was tested and
found, and the resulting handling decision (drop column, drop rows, impute — with the imputation
method named — or keep as a missingness indicator). Where MNAR is suspected, record the domain
argument for it and the limitation it imposes, not a test result.

## Outliers: choose the method per column family, then look at the flagged rows

| Column shape | Method | Caveat |
|---|---|---|
| Roughly symmetric, unimodal numeric | z-score (|z| > 3 as a starting point, state the threshold used) | Sensitive to the outliers it is trying to detect — compute the mean/sd robustly (median/MAD) if the tail is heavy. |
| Skewed numeric (money, counts, durations) | IQR fences (`Q1 - 1.5*IQR`, `Q3 + 1.5*IQR`) on the raw or log-transformed column | Log-transform first if the column cannot be negative and spans orders of magnitude; state whether the fence was applied pre- or post-transform. |
| Bounded by definition (percentages, ratios, ages) | Domain bounds, not a statistical rule | A statistical outlier rule will flag a legitimate value; a domain rule catches the actual data-entry error (age = 999, percentage = 150). |
| Categorical with a long tail | Frequency threshold (collapse categories below N occurrences into "other"), not an outlier rule | This is a cardinality-reduction decision for modelling, not a data-quality flag — say which it is. |

After flagging, **read a sample of the flagged rows by hand** — every dataset produces both real
data-entry errors and genuine rare events under the same statistical flag, and only a human
reading the row (with its other columns for context) can usually tell which. Record the split:
how many flagged rows were errors (removed/corrected) vs. genuine extremes (kept, possibly capped
rather than removed so the model still sees that such cases exist).

## What to record per decision

For every column where an outlier or missingness decision was made: the method, the threshold or
mechanism finding, the count affected, and the action taken. A profile doc that says "outliers
were removed" with no method or count is not reproducible and will be rewritten from scratch by
whoever inherits the dataset next.
