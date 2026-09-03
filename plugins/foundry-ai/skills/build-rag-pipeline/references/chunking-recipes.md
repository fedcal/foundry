# Chunking recipes by document family

A chunker is a parser plus a policy. Choose per family, never one splitter for a mixed corpus.
Every recipe below assumes the three ingestion invariants from the skill: heading path prepended,
length asserted against the embedder's real limit, metadata attached.

## Contracts, policies, regulations

- **Split on the numbering hierarchy** (article → clause → sub-clause), not on characters. The
  numbering *is* the semantic boundary and users cite it.
- Prepend the full path: `Contract 2024/88 > Art. 7 Termination > 7.3`. Users search for
  "termination notice period", and the heading carries half the signal.
- Keep definitions reachable: a clause referring to "the Services" is meaningless without the
  definitions article. Either duplicate the relevant definitions into the chunk metadata or add a
  retrieval rule that always fetches the definitions section alongside a clause hit.
- **Never merge two versions of the same clause into one chunk.** Carry `effective_date` and
  `doc_version` and filter on them; temporal queries are the dominant failure class here.
- Cross-references ("as set out in Annex B") should be stored as a metadata edge so the answering
  step can follow one hop deliberately, rather than hoping both chunks rank.

## API documentation and source code

- **Split on syntactic units**: one function, class, endpoint or schema per chunk, with its
  docstring and signature. A chunk that starts mid-function is unusable to a reader and to a
  model.
- Prepend `module > class > method` and the language. Include the import block only if names are
  ambiguous without it.
- Keep an endpoint's request schema, response schema and error table together, or answers about
  errors will retrieve the endpoint without the error semantics.
- Index the identifier tokens deliberately: method names, error codes and parameter names are
  exactly where lexical search beats dense retrieval. Do not strip punctuation and case in a way
  that destroys `getUserById` or `ERR_TIMEOUT_04`.
- Generated reference documentation is highly repetitive; deduplicate aggressively or top-k fills
  with near-identical boilerplate.

## Support tickets, emails, chat threads

- **One chunk per thread when the thread is short**, one per message when it is long — the unit
  is a coherent exchange, not a turn.
- Strip signatures, disclaimers and quoted history before embedding; they are the highest-volume
  duplicate text in any corpus and they dominate similarity.
- Carry `status`, `resolution`, `product`, `created_at` as filterable metadata. Most real queries
  are "how did we solve X" and want the resolved subset only.
- The resolution message is what answers questions; consider indexing it separately with a
  pointer to the thread, and boosting it.

## Spreadsheets and tables

- **Never let a fixed-size splitter cut a table.** Extract the table as a unit; if it is too
  large, split by row groups and **repeat the header row in every chunk**.
- Serialise each row as `header: value` pairs rather than as a pipe-delimited line. Dense
  embeddings handle labelled pairs far better than positional columns, and the chunk stays
  readable if retrieved.
- Prepend the table caption and the sheet name; a column called `Total` is meaningless alone.
- For numeric analysis, do not use retrieval at all: expose the data through a query tool. RAG
  over a spreadsheet answers "what does the table say" and cannot answer "what is the sum".

## Transcripts (calls, meetings, video)

- Split on topic shifts where speaker-diarised structure allows it, otherwise on fixed time
  windows with modest overlap, and always carry the timestamp range for citation.
- Prepend the meeting title, date and participants; transcripts are full of unresolved pronouns
  and the metadata is the only anchor.
- Consider indexing a per-segment summary alongside the verbatim text: spoken language is verbose
  and embeds poorly, and the summary retrieves better while the verbatim text is what you return.

## Long-form manuals and books

- Two levels: embed the section (small, precise) and return the chapter window (large, complete).
  This "retrieve small, generate large" split is usually the highest-value structural change
  available and it decouples chunk size from context size.
- Carry the page number or anchor for citation; a manual answer without a page reference cannot
  be checked by the user.
- Tables of contents, indexes and glossaries retrieve well and answer nothing — exclude them from
  the index or mark them a distinct type and filter them out.

## Web pages and knowledge bases

- Strip navigation, footers, cookie banners and related-article rails before chunking. They are
  identical across thousands of pages and they are pure top-k pollution.
- Split on `h1`/`h2`/`h3` structure, and treat a page shorter than one chunk as one chunk — do
  not pad.
- Carry `canonical_url` and `last_modified`. Freshness filtering is the most requested feature
  three months after launch, and it is impossible to retrofit without a reindex.

## Overlap policy

Overlap rescues answers that straddle a boundary; it does not fix a bad splitter. Modest overlap
on structural chunks is reasonable insurance. Large overlap inflates index size, duplicates top-k
results and masks the real problem. If overlap materially improves recall, the boundary policy is
wrong — fix the boundary policy.

## Deduplication

Compute a hash of normalised chunk text at ingestion and drop exact duplicates. For near
duplicates (versioned pages, templated tickets), either collapse to the newest version with the
older ones reachable by metadata, or apply diversity at retrieval so top-k cannot be filled by
one document family. Measure the effect on the labelled query set before choosing.
