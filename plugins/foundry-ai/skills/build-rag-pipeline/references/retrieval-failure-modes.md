# Retrieval failure modes, with diagnostics

Work top to bottom. Each entry names the symptom, the check that confirms it, and the fix that
addresses the cause rather than the appearance.

## Ingestion

1. **No text layer.** Symptom: a document class never retrieves. Check: extract one file and
   count characters. Fix: OCR pipeline, or declare the class out of scope. Do not ship a system
   that silently ignores 12% of the corpus.
2. **Layout destroyed by extraction.** Symptom: fluent nonsense in retrieved chunks; tables read
   as interleaved columns. Check: read one extracted table-heavy page. Fix: a layout-aware
   parser for that family; table-specific chunking.
3. **Silent embedding truncation.** Symptom: long chunks retrieve only on their opening topic.
   Check: assert every chunk's token count against the model's measured limit at ingestion. Fix:
   smaller chunks; the assertion stays as a permanent guard.
4. **Boilerplate not stripped.** Symptom: top-k full of navigation, disclaimers, signatures.
   Check: print the 20 most frequent normalised chunk texts. Fix: strip at parse time, then
   deduplicate.
5. **Near-duplicate documents.** Symptom: top-k is five versions of one page. Check: count
   duplicate content hashes; sample a query's top-k for repetition. Fix: collapse versions, keep
   the newest reachable by metadata, add retrieval diversity.
6. **Missing metadata.** Symptom: cannot filter by date, tenant or type; retrofitting requires a
   full reindex. Check: list the columns on the chunk table. Fix: reindex now, with the full
   metadata set, before the corpus grows.

## Embedding and index

7. **Mixed embedding models in one index.** Symptom: erratic quality, some queries catastrophic.
   Check: `SELECT embedding_model, count(*) FROM chunks GROUP BY 1;`. Fix: full reindex; add the
   check to CI. This is an incident, not a defect.
8. **Metric/normalisation mismatch.** Symptom: rankings look arbitrary. Check: embed one string
   twice and assert self-similarity ≈ 1; assert a known-related pair outranks a known-unrelated
   pair. Fix: align normalisation with the configured distance metric.
9. **Query/document prefix applied on one side only.** Symptom: uniformly mediocre retrieval with
   no obvious pattern. Check: read the ingestion and query code paths side by side. Fix: one
   shared encode function used by both.
10. **ANN parameters dropping recall.** Symptom: exact search finds the chunk, the index does
    not. Check: compare against a flat/exact search on a sample of the labelled set. Fix: raise
    `ef_search`/`nprobe` and re-measure latency; accept the trade explicitly.
11. **Post-filtering instead of pre-filtering.** Symptom: selective filters return few or zero
    results. Check: run a query with the most selective filter and count results before and after
    filtering. Fix: pre-filtered search, or over-fetch with the recall loss measured.

## Query side

12. **Vocabulary mismatch.** Symptom: users' words never appear in the documents. Check: the
    `paraphrase` stratum scores far below `lookup`. Fix: hybrid retrieval, synonym/acronym
    expansion built from a real glossary, or an indexed per-chunk summary in user vocabulary.
13. **Identifiers lost.** Symptom: exact codes and part numbers fail. Check: the `identifier`
    stratum against the lexical baseline — if BM25 wins there, dense-only was the wrong design.
    Fix: hybrid with RRF; verify the analyser does not split or lowercase identifiers destructively.
14. **Negation ignored.** Symptom: "regions not covered" retrieves the covered list. Check: the
    `negation` stratum. Fix: this is a known weakness of similarity search — handle it at the
    generation step with the full relevant section retrieved, and say so in the design doc rather
    than pretending the retriever handles it.
15. **Multi-hop treated as one hop.** Symptom: `multihop` stratum near zero. Check: whether the
    second document could ever rank for the original query. Fix: an explicit two-step retrieval
    with an intermediate extraction, or a metadata edge followed deliberately. More k does not fix
    this.
16. **k too small, or too large.** Symptom: recall low at small k; precision and cost bad at
    large k, with the answer diluted among distractors. Check: recall@k and context precision
    swept over k. Fix: raise k *and* rerank; do not do one without the other.

## Ranking and generation boundary

17. **Reranker asked to fix recall.** Symptom: reranking changes little. Check: recall of the
    candidate set before reranking. Fix: recall work upstream. A reranker cannot retrieve.
18. **Citation hallucination.** Symptom: answers cite chunk ids that were not retrieved. Check:
    validate every cited id against the retrieved set — a test, not a review. Fix: constrain
    citations to the provided ids and fail the response on violation.
19. **No abstention.** Symptom: confident answers to unanswerable questions. Check: the
    `unanswerable` stratum. Fix: a score threshold below which the system declines, plus an
    explicit prompt escape hatch, plus eval items that keep it honest.

## Access and lifecycle

20. **Cross-tenant leakage.** Symptom: none, until it is a breach. Check: an automated test that
    a query authenticated as tenant A returns zero chunks with `tenant_key = B`. Fix: a hard
    predicate applied server-side from the session. Never a prompt instruction.
21. **Deletion not propagated.** Symptom: deleted documents still answer questions. Check: delete
    a test document and re-query, including any answer or embedding cache. Fix: tombstones plus a
    tested deletion path; an erasure request that leaves vectors behind is a real breach.
