---
id: MEAS-the-floor-for-finding-a-different-word-for-the-same-idea-2
type: measurement
title: the floor for finding a different word for the same idea, measured with no model
status: active
severity: soft
always: false
summary: Most of what makes searching this project frustrating is not about meaning, and the parts that are can be reached without any language model.
summary_of: 51ef8c8c3dd29290
scope:
  - src/core/search.ts
  - src/core/conversation-search.ts
  - scripts/measure-search-floor.ts
  - reports/2026-09-15-the-search-floor.md
tags:
  - v2
  - search
  - measurement
  - d77
origin: human
source_file: reports/2026-09-15-the-search-floor.md
source_anchor: null
source_checksum: 1a50b418d46c61ea
valid_from: 2026-09-15
valid_until: null
checksum: aa3f7435bc2c3c3b
---

# the floor for finding a different word for the same idea, measured with no model

> The floor, measured on 2026-09-15 by `scripts/measure-search-floor.ts`, which reads the corpus,
> the archive index and the audit log and writes nothing. Re-run it; every number below is its
> output and nothing here is typed by hand.
>
> THE HEADLINE. Searching by meaning, on this corpus, is mostly NOT a meaning problem. Of everything
> that fails today, the parts a model would be needed for are the smallest share.
>
> WHAT FAILS TODAY, with real queries and owner-authored ground truth. 42 items carry the owner's
> VERBATIM request in their `request` field — his words on one side, an agent's wording of the same
> idea on the other, recorded by the product itself and labelled by nobody. Nineteen of the 42 quote
> his request back inside their own body, so every 8-word window of a request is DELETED from the
> item it points at before scoring; unmasked the set reports MRR 0.937 and the fixture earns it.
> Masked:
>   - the shipped filter, given the whole request: the item it produced comes back 3 times in 42.
>   - the shipped filter, given the five most distinctive words of that request: 0 times in 42.
>   - the same five words as independent terms, BM25-ranked over the same fields: rank 1 ten times,
>     top 5 twenty-one times.
>   - adding summary, tags and id, weighted: rank 1 fifteen, top 5 twenty-four.
>   - adding a 30-line conflation key: rank 1 sixteen, top 5 twenty-five, MRR 0.476.
>
> SO THE FLOOR IS: 0/42 to 16/42 at rank 1 and 25/42 in the top five, with no model, no dependency
> and nothing leaving the machine. Everything above the floor is a ranking question the product has
> never had to answer, because `filterItems` deliberately does not rank.
>
> THE FOUR CANDIDATES, EACH MEASURED.
>   - TITLE AND SUMMARY AS WELL AS BODY is not about weighting, it is about COVERAGE. 165,676
>     characters of summary sit on 1,252 of 1,252 items and `search --text` cannot read one of them;
>     neither can it read the 28,204 characters of `request`, which is the one field written in his
>     vocabulary rather than an agent's. Worth +0.073 MRR on the ground truth, the largest single
>     gain measured, and it costs three field names.
>   - STEMMING is worth +0.024 MRR on top of that. It is smaller than it looks because substring
>     matching ALREADY gives prefix matching in one direction: `phase` finds `phases` for free. The
>     gap is the other direction, so the repair belongs on the QUERY.
>   - AN ALIAS TABLE HE CONTROLS has a measurable job of 58 words: of 2,237 English words he typed
>     in three or more separate prompts, 85 reach nothing after fields and stemming, 27 of those are
>     within edit distance 2 of a word the corpus does use (MISSPELLING, not meaning) and 58 are
>     reached by nothing mechanical. 58 rows is a table a person can write and keep.
>   - THE RELATION GRAPH AND TAG VOCABULARY AS QUERY EXPANSION MEASURED NEGATIVE, and this was the
>     most promising of the four on paper. 150 relation rows over 110 of 1,252 items; 80 of them
>     (53%) are supersession, which points AT retired knowledge. With supersession dropped and
>     `needs:` resolved through plan/seq there are 215 usable edges touching 236 items — 81% of the
>     corpus has no edge at all. Score propagation moves MRR by -0.010 to +0.001 depending on
>     weight, and of the 6 targets the lexical pass does not return at all the graph reaches 1. The
>     idea is not wrong; this graph is too sparse to carry it, and the finding is about the corpus
>     rather than about search.
>
> THE LARGEST SINGLE MISS IS NOT ABOUT MEANING AT ALL. `text` is ONE contiguous substring on both
> surfaces: `filterItems` calls `String.includes`, and `searchArchive` quotes the query into one
> FTS5 phrase. So a two-word query fails whenever the corpus does not put those two words next to
> each other. Measured on the archive over 1,363 two-word phrases he actually typed: 447 (32.8%)
> return anything as a phrase, 1,363 (100%) as two AND-ed terms — median 3 spans against median 32,
> which is the precision this buys with.
>
> HEBREW, MEASURED BEFORE ANYTHING WAS OFFERED. Fixture: 1,301 Hebrew strings from the shipped UI
> table plus the Hebrew lines in the corpus, 3,547 word types, indexed in memory under both
> tokenizers. He types a word with a particle glued on its front and the text writes the bare word —
> 3,927 such queries: FTS5 trigram finds 51 (1.3%), FTS5 unicode61 finds 1 (0.03%). Trigram is 51x
> better and still fails. Stripping ONE front particle off the QUERY finds all 3,927, assumes no
> word boundary, and costs precision: 1,146 word types in this fixture begin with a particle letter
> and have a remainder that is itself a word.
>
> THE ASCII GUARD ON THE STEMMER IS NOT LOAD-BEARING, and that is a removal proof rather than a
> story: guarded it rewrites 0 of 3,547 Hebrew word types, and with the guard deleted, 0. No Hebrew
> word ends in `s`, `ed`, `ing` or `ly`. It stays as insurance for any future rule that trims by
> LENGTH, which would maul Hebrew immediately.
>
> D77'S OWN FIGURES, RE-TAKEN. 10,470 prose spans and 1,252 items today against the recorded 10,445
> and 1,247 — right as of the day they were taken, grown since. Brute-force cosine over 11,722
> vectors in plain JS: 4.5-5.2 ms at 384 dims (recorded 4.3), 8.1-8.4 at 768 (recorded 9.3), 15.6-19.7
> at 1536 (recorded 27.2). The first two reproduce; the third reproduces well UNDER the recorded
> figure, so that number is conservative and the conclusion it supports is unaffected.
>
> WHAT THIS DOES NOT TELL YOU. Ground truth is 42 pairs, which is small, and every pair is a REQUEST
> that produced an item rather than a search somebody ran — there is no log of real searches, because
> no surface audits one. "Reach" over his vocabulary counts whether a word finds anything, never
> whether what it finds is right. And the corpus grows under the script's feet: two runs an hour
> apart do not produce identical numbers.
>
> ## The run this is written from
>
> ```
> == 1. THE D77 FIGURES, RE-TAKEN ==
>   prose spans      10470        (D77: 10,445)
>   items            1253         (D77: 1,247)
>   vectors it implies 11723      (D77: 11,692)
>   VERDICT: right as of the day they were taken; the archive and the corpus have grown since.
>   brute-force cosine over 11723 vectors, plain JS Float32Array, median of 25:
>      384 dims  5.6 ms   (D77: 4.3 ms)
>      768 dims  11.0 ms   (D77: 9.3 ms)
>     1536 dims  22.6 ms   (D77: 27.2 ms)
>   VERDICT: 384 and 768 reproduce. 1536 reproduces well UNDER the recorded figure, so the
>            recorded number is conservative and the conclusion it supports is unaffected.
>
> == 2. FIELD COVERAGE — what `search --text` can and cannot see ==
>   SEARCHED      title 96570   body 2766149   observations 25296   extra 36298
>   NOT SEARCHED  summary 165817 chars, on 1253/1253 items
>   NOT SEARCHED  request 28204 chars, on 42/1253 items — HIS OWN VERBATIM WORDS
>   NOT SEARCHED  tags 47112 chars (--tag is exact-match and --text never reads them)
>   FINDING: the one field written in the owner's vocabulary rather than an agent's is the
>            one field the text filter cannot read.
>
> == 3. SET V — REACH over the owner's own vocabulary ==
>   2237 English words of 4+ letters that he typed in 3 or more separate prompts.
>   "reach" = the word finds at least one item. It is not a claim that the item is the right one.
>   L0  shipped — one substring, shipped fields  136 find nothing   (93.9% reach)
>   L1  + query split into terms, AND-ed         136 find nothing   (93.9% reach)
>   L2  + punctuation folded on both sides       136 find nothing   (93.9% reach)
>   L3  + summary, request, tags and id read     120 find nothing   (94.6% reach)
>   L4  + conflation key on the query             84 find nothing   (96.2% reach)
>   of the 84 words still unreached at L4:
>     15 are within edit distance 1 of a word the corpus does use — MISSPELLING, not meaning
>     12 are within edit distance 2
>     57 are reached by nothing mechanical — this is the alias table's actual job
>   repairs a trigram-nearest pass would make (sample): architectural ~> architecture, becouse -> because, behavior -> behaviour, clarity ~> polarity, colapse -> collapse, companion ~> compaction, decompose ~> compose, decomposed ~> composed
>   residual (sample): aabb, abobe, abuse, adbcfe, adebca, aebb, aedf, afffaa, afraid, alot, analytics, anecdote, apologise, appropriate
>
> == 4. SET R — does the RIGHT item come back ==
>   42 owner-authored (request, item) pairs, taken from the `request` field the product
>   itself wrote. Every 8-word window of a request is DELETED from the item it points at, so an
>   item cannot be found by its own copy of the question.
>   -- the whole request as the query --
>   R0 shipped: one substring, no ranking          @1  3   @5  3   @10  3   anywhere  3/42   MRR 0.071
>      UNMASKED control (the leak, for scale)      @1 38   @5 41   @10 41   anywhere 42/42   MRR 0.937
>   R1 BM25 over the shipped fields                @1 22   @5 35   @10 37   anywhere 42/42   MRR 0.655
>   R2  + summary, tags and id, weighted           @1 24   @5 36   @10 38   anywhere 42/42   MRR 0.685
>   R3  + conflation key                           @1 24   @5 35   @10 38   anywhere 42/42   MRR 0.688
>   -- the 5 most distinctive words of the request, which is what a person types --
>   R0 shipped: those 5 words as one substring     @1  0   @5  0   @10  0   anywhere  0/42   MRR 0.000
>   R1 BM25 over the shipped fields                @1 10   @5 21   @10 25   anywhere 36/42   MRR 0.379
>   R2  + summary, tags and id, weighted           @1 15   @5 24   @10 27   anywhere 37/42   MRR 0.452
>   R3  + conflation key                           @1 16   @5 25   @10 29   anywhere 36/42   MRR 0.476
>
> == 5. THE CORPUS'S OWN RELATION GRAPH AND TAG VOCABULARY, AS QUERY EXPANSION ==
>   relation rows 150 over 110/1253 items;  80 of them (53%) are supersession, which points AT retired knowledge.
>   usable undirected edges once supersession is dropped and `needs:` is resolved through
>   plan/seq: 215, touching 236/1253 items.
>   plan: cohorts 49;  distinct tags 645
>   measured on SET R, against R3 as the base:
>   base (R3)                                      @1 16   @5 25   @10 29   anywhere 36/42   MRR 0.476
>   + relation-graph propagation, a=0.35           @1 16   @5 25   @10 29   anywhere 37/42   MRR 0.466
>   + relation-graph propagation, a=0.10           @1 16   @5 25   @10 29   anywhere 37/42   MRR 0.477
>   + plan: cohort propagation, b=0.20             @1 16   @5 25   @10 29   anywhere 38/42   MRR 0.477
>   RESCUE: of 6 targets the lexical pass does not return at all, the graph reaches 1.
>
> == 6. HEBREW — measured before anything is offered ==
>   fixture: 1301 Hebrew strings from the shipped UI table + 21 Hebrew lines from corpus items = 1322.
>   3547 Hebrew word types. THE QUESTION: he types a word with a particle glued
>   on its front (ו ה ב כ ל מ ש) and the text writes the bare word. 3927 such queries:
>     FTS5 trigram    finds 51/3927  (1.3%)
>     FTS5 unicode61  finds 1/3927  (0.0%)   <- the word-boundary tokenizer, 51x worse
>     trigram + stripping ONE front particle off the query: 3927/3927  (100.0%)
>   PRECISION COST, stated rather than hidden: 1146 Hebrew word types in this fixture
>   begin with a particle letter AND have a remainder that is itself a word, so stripping is
>   additive recall bought with spurious hits, not a free win.
>   REMOVAL PROOF on the ASCII guard: guarded, it rewrites 0/3547 Hebrew word types; with the guard deleted, 0/3547.
>   VERDICT: the guard is NOT load-bearing for these suffix rules — the damage it prevents is zero,
>            because no Hebrew word ends in `s`, `ed`, `ing` or `ly`. It stays as insurance for any
>            future rule that trims by LENGTH, which would maul Hebrew immediately.
>
> == 7. THE ARCHIVE — the same split, on the surface he asked about by name ==
>   1363 two-word phrases he actually typed (both words 5+ letters), sampled by
>   stride from 13622, run against the real prose index, read-only:
>     as ONE quoted phrase, which is what `searchArchive` sends: 447 of 1363 return something (32.8%), median 3 spans
>     as two AND-ed terms:                                      1363 of 1363 return something (100.0%), median 32 spans
>   READ THE SECOND NUMBER WITH ITS MEDIAN. AND-ing terms reaches everything precisely because
>   it reaches too much; it is only usable because `matchProse` already orders by bm25, and
>   `filterItems` on the CORPUS side has no such ordering and refuses to grow one on purpose.
>   The phrase reading is RIGHT for a fragment somebody half-remembers and WRONG for a
>   description; nothing on any surface lets a reader pick, and nothing says which they got.
> ```
>
> That block is the whole of the evidence; re-run `node scripts/measure-search-floor.ts` and it is
> reproduced, against whatever the corpus and the archive hold on the day you run it.

## Observations
- [supersession] Replaces MEAS-the-floor-for-finding-a-different-word-for-the-same-idea: Same measurement, correctly sourced. The first capture passed --file a path under .scratch/, which is gitignored, so the item was permanently bound to a snapshot source that does not exist in a fresh clone — the same scar TASK-the-guard-that-excludes-lanes-from-reaping-the-server-rests carries, where a lane passed a heredoc temp path. Nothing on edit clears source_file, so supersession is the only route back.

## Relations
- supersedes [[MEAS-the-floor-for-finding-a-different-word-for-the-same-idea]]
- derived_from [[TASK-measure-what-finds-a-different-word-for-the-same-idea]]
