# Building a labelled retrieval query set

The query set is the only reason any later number means anything. Build it before the index, and
never let the system under test generate it.

## Where queries come from, in order of preference

1. **Search and chat logs** of the system being replaced. Real phrasing, real typos, real
   ellipsis. Sample across time so you catch seasonality.
2. **Support tickets and their resolutions.** The ticket is the query; the resolution names the
   answering document.
3. **Interviews with the people who will use it.** Ask them to describe the last five times they
   needed this information — not what they "would ask a chatbot", which produces polite,
   unrepresentative sentences.
4. **Expert-authored queries**, clearly labelled `expert-authored`. Acceptable when nothing else
   exists; state the limitation in every report.
5. **Model-generated queries from the corpus.** Only as coverage padding, in a separate stratum,
   and never as the basis for a comparison. They measure how well the retriever recovers text a
   model already saw, which is not the task.

## Strata (record one per item)

| Stratum | Example shape | Why it is separate |
|---|---|---|
| `lookup` | "what is the notice period" | The easy majority; hides everything else in an aggregate |
| `identifier` | "error ERR_4021", "part 88-3312-A" | Where lexical retrieval wins and dense retrieval fails |
| `comparison` | "difference between plan A and plan B" | Needs two documents in the context at once |
| `multihop` | "what applies to the supplier named in annex B" | Recall must succeed twice; single-shot retrieval usually fails |
| `temporal` | "current policy", "after the 2024 amendment" | Requires date metadata and filtering, not similarity |
| `negation` | "which regions are not covered" | Embeddings are weak on negation; expect and measure it |
| `unanswerable` | anything genuinely absent from the corpus | Grades abstention; ≥ 15% of the set |
| `paraphrase` | user vocabulary that never appears in the documents | Where dense retrieval earns its cost |

An aggregate score across these strata is not interpretable. Always report the vector.

## Labelling protocol

- Label the **document (and section) ids** that contain the answer, not the answer text and not
  chunk ids. Document-level labels survive a rechunk; chunk-level labels must be redone every
  time you change the splitter, and so they will rot.
- Multiple relevant documents are normal. Record all of them; for `multihop`, record the chain
  and mark which document is required last.
- **Graded relevance** where it is real: `2` = fully answers, `1` = useful context, `0` =
  irrelevant. Needed for nDCG; binary labels are acceptable for recall and MRR only.
- For `unanswerable`, record *why* (out of corpus, out of period, out of tenant). The reason
  drives the correct system behaviour.
- Two labellers on at least a 20-item sample. Disagreement above 20% means the questions are
  ambiguous — rewrite the questions rather than arbitrating the labels.

## File format

`evals/retrieval/<set>.v1.jsonl`, one object per line, committed to the repository:

```json
{"id":"q-014","query":"...","stratum":"temporal","relevantDocs":[{"id":"doc-882#sec-4","grade":2}],"provenance":"support-ticket-4417","addedAt":"2026-01-14","note":"answer only in the 2024 annex"}
```

Frozen means frozen: corrections create `v2`. A metric recorded against `v1` must keep its
meaning, or every historical comparison silently becomes a lie.

## Size and what it can resolve

Fifty items is the floor for a usable signal and it is a coarse instrument: on 50 items a
few-point difference is noise. State the minimum effect your set can resolve **before** running
the comparison, and grow the set when the decision needs a finer instrument. Per-stratum
conclusions need per-stratum counts — a stratum with 4 items supports no conclusion at all, and
reporting one from it is the most common way these sets get misused.

## Keeping it alive

- Every production complaint about a missing or wrong answer becomes a new item, with the
  correct document labelled. This is how the set grows toward your real risk.
- Re-check labels whenever the corpus changes materially: a document deleted or superseded makes
  its items wrong, and a set that silently disagrees with the corpus produces false regressions
  that erode trust in the gate.
- Review the set on the same cadence as the pipeline design doc (≤ 90 days), and record the
  review date in the file header commit message.
