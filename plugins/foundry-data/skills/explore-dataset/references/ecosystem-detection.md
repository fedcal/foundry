# Ecosystem detection and tool equivalence

Detect the stack from files that actually exist in the repository, not from what the team usually
uses. A repository can legitimately hold more than one stack — a Python notebook for exploration
and a Java module that trains a regression tree or mines patterns over the same domain. Profile
with the tool that matches where the dataset is actually consumed downstream.

## Marker files

| Stack | Marker files | What they imply |
|---|---|---|
| Python / pandas / scikit-learn | `pyproject.toml`, `requirements*.txt`, `environment*.yml`, `*.ipynb`, `Pipfile` | pandas/numpy profiling, notebook-driven exploration |
| Java data mining | `pom.xml`, `build.gradle*`, `*.arff`, imports of `weka.*` or `smile.*` in `*.java` | Weka `Instances`/filters, or Smile `DataFrame`, JVM-native profiling |
| R | `DESCRIPTION`, `*.Rproj`, `*.R` | `summary()`, `skimr`, tidyverse-style profiling |
| SQL-only / warehouse | `*.sql`, dbt `dbt_project.yml`, no application code touching the extract | profile with the warehouse's own `ANALYZE`/statistics views before exporting anything |

Run the detection commands from step 1 and record the result verbatim in the profile doc header —
do not summarise "it's a Python project" if a Java module also touches the same table.

## Tool equivalence table

| Task | Python (pandas) | Java (Weka) | Java (Smile) | R |
|---|---|---|---|---|
| Row/column count, dtypes | `df.info()` | `Instances.numInstances()/numAttributes()`, `Attribute.type()` | `DataFrame.nrow()/ncol()`, `schema()` | `str(df)` |
| Summary statistics | `df.describe()` | `Instances.attributeStats(i)` | `DataFrame.describe()` (Smile 4.x; the method was `summary()` in 2.x) | `summary(df)` |
| Missing count | `df.isna().sum()` | `Instances.attributeStats(i).missingCount` | `DataFrame.isNullAt` scan | `colSums(is.na(df))` |
| Correlation matrix | `df.corr(method=...)` | no built-in feature-feature matrix — pairwise `weka.core.Utils.correlation(a, b, n)` over `Instances.attributeToDoubleArray(i)` | `smile.math.MathEx.cor(df.toArray(cols))`, or `MathEx.spearman` per pair | `cor(df, method = ...)` |
| Class balance | `df[target].value_counts(normalize=True)` | `Instances.attributeStats(classIndex).nominalCounts` | tally `df.column(target).stream()` into a map — `DataFrame` has no `groupBy` | `table(df$target) / nrow(df)` |
| Outlier flag (IQR) | `q1, q3 = df[c].quantile([.25,.75])` | `weka.filters.unsupervised.attribute.InterquartileRange` — it derives Q1/Q3 itself; `AttributeStats` exposes no quartiles | manual from column quantiles | `boxplot.stats(df[[c]])$out` |
| Train/test split respecting groups | `GroupShuffleSplit` (scikit-learn) | manual partition by group id before `Instances` split | manual partition by group id | `group_initial_split` (rsample) |

`weka.attributeSelection.CorrelationAttributeEval` looks like the correlation answer and is not:
it is an `AttributeEvaluator` that scores each attribute's Pearson correlation **with the class**,
returning a score per attribute, not a feature-feature matrix. That number belongs to the leakage
check in step 7, not to the redundancy check in step 6 — using it there answers a different
question with the same word.

None of these commands guarantee a specific library version is installed — check what is actually
resolvable in the project's lockfile or dependency tree before assuming an API shape, and state the
version found (not remembered) in the profile doc when it matters to a result.

## When the ecosystem is genuinely mixed

State it explicitly rather than picking one arbitrarily: "profiled in Python because the modelling
pipeline in `src/features/` is Python; the Java module in `datamining/` consumes a downstream
export and is out of scope for this profile." That sentence is the deliverable, not a limitation to
hide.
