# Notebook-to-modules checklist

Each item names something that hides comfortably in a notebook and needs a deliberate decision the
moment it is extracted — leaving the decision implicit is how a "successful" extraction ships a
subtly different pipeline than the one that was evaluated.

## Hidden state

- **Out-of-order cell execution.** The notebook's true execution order (from the cell numbers) may
  not match its top-to-bottom reading order. Verify by running top-to-bottom in a clean kernel
  before trusting any extracted logic reflects what actually produced the evaluated result.
- **Variables defined once, reused across many cells.** A module needs each function to take
  explicit inputs; a variable set in cell 4 and silently relied on in cell 30 becomes an implicit,
  invisible parameter if not made explicit during extraction.
- **A manually edited output cell** (someone hand-fixed a number or a plot without re-running the
  cell that produced it). This is the single most common cause of "the notebook doesn't reproduce"
  found in step 2 — diff the current output against a fresh run and treat any mismatch as a defect
  to explain, not a discrepancy to ignore.

## Magic commands and notebook-only conveniences

- `%matplotlib inline`, `%%time`, shell-escape cells (`!pip install ...`) — none of these exist
  outside the notebook kernel. Replace inline installs with the pinned dependency manifest from
  step 4; replace ad hoc timing with proper logging/metrics if the timing matters in production.
- Inline plotting used for exploration — drop it from the production path, or move it behind an
  explicit debug flag if a visual check is genuinely needed operationally.

## Inline constants and one-off fixes

- Magic numbers typed directly into a cell (a threshold, a column index, a file path) — pull them
  into named configuration, and check whether the value was itself something learned during
  exploration (a threshold picked by eyeballing a chart) that needs to be re-derived properly or
  explicitly documented as a domain decision, not just relocated unexamined.
- A manual row fix or exclusion applied ad hoc in a cell ("drop this one row, it looked wrong") —
  either turn it into a documented, general data-quality rule applied consistently, or confirm it
  genuinely was a one-off already excluded upstream and does not need to survive extraction at all.

## Data loading

- A notebook frequently reads from a local file path or a personal database connection string.
  Extraction must replace this with a configurable, environment-appropriate data source — and the
  extracted code must fail loudly, not silently return empty data, when that source is unavailable.
- Caching cells (`if not os.path.exists(cache_file): ...`) hide whether a given run used fresh or
  stale data. Make the cache behaviour explicit and controllable in the extracted module, not an
  accidental side effect of what happened to already be on disk.

## Model and artifact loading

- A model object left in memory from a training cell, referenced later in the same notebook. The
  extracted serving path must load the model from its saved artifact, exactly as it will in
  production — never assume the in-memory object and the saved artifact are identical without
  verifying it once explicitly.

## After extraction

Re-run the extracted modules against the same input the notebook used and confirm the output
matches within a stated tolerance before treating the extraction as complete — this is the
reproducibility test from step 4, and it is the check that catches anything on this list that was
missed.
