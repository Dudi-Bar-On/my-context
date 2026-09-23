---
id: MEAS-the-floor-for-finding-a-different-word-for-the-same-idea
type: measurement
title: the floor for finding a different word for the same idea, with no model at all
status: superseded
severity: soft
always: false
summary: Most of what makes searching this project frustrating is not about meaning, and the parts that are can be reached without any language model.
summary_of: d1b84dbca61a2457
scope:
  - src/core/search.ts
  - src/core/conversation-search.ts
  - scripts/measure-search-floor.ts
tags:
  - v2
  - search
  - measurement
  - d77
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: 2026-09-15
checksum: 6b0b74f75a61de32
---

# the floor for finding a different word for the same idea, with no model at all

The floor, measured on 2026-09-15 by `scripts/measure-search-floor.ts`, which reads the corpus,
the archive index and the audit log and writes nothing. Re-run it; every number below is its
output and nothing here is typed by hand.

THE HEADLINE. Searching by meaning, on this corpus, is mostly NOT a meaning problem. Of everything
that fails today, the parts a model would be needed for are the smallest share.

WHAT FAILS TODAY, with real queries and owner-authored ground truth. 42 items carry the owner's
VERBATIM request in their `request` field — his words on one side, an agent's wording of the same
idea on the other, recorded by the product itself and labelled by nobody. Nineteen of the 42 quote
his request back inside their own body, so every 8-word window of a request is DELETED from the
item it points at before scoring; unmasked the set reports MRR 0.937 and the fixture earns it.
Masked:
  - the shipped filter, given the whole request: the item it produced comes back 3 times in 42.
  - the shipped filter, given the five most distinctive words of that request: 0 times in 42.
  - the same five words as independent terms, BM25-ranked over the same fields: rank 1 ten times,
    top 5 twenty-one times.
  - adding summary, tags and id, weighted: rank 1 fifteen, top 5 twenty-four.
  - adding a 30-line conflation key: rank 1 sixteen, top 5 twenty-five, MRR 0.476.

SO THE FLOOR IS: 0/42 to 16/42 at rank 1 and 25/42 in the top five, with no model, no dependency
and nothing leaving the machine. Everything above the floor is a ranking question the product has
never had to answer, because `filterItems` deliberately does not rank.

THE FOUR CANDIDATES, EACH MEASURED.
  - TITLE AND SUMMARY AS WELL AS BODY is not about weighting, it is about COVERAGE. 165,676
    characters of summary sit on 1,252 of 1,252 items and `search --text` cannot read one of them;
    neither can it read the 28,204 characters of `request`, which is the one field written in his
    vocabulary rather than an agent's. Worth +0.073 MRR on the ground truth, the largest single
    gain measured, and it costs three field names.
  - STEMMING is worth +0.024 MRR on top of that. It is smaller than it looks because substring
    matching ALREADY gives prefix matching in one direction: `phase` finds `phases` for free. The
    gap is the other direction, so the repair belongs on the QUERY.
  - AN ALIAS TABLE HE CONTROLS has a measurable job of 58 words: of 2,237 English words he typed
    in three or more separate prompts, 85 reach nothing after fields and stemming, 27 of those are
    within edit distance 2 of a word the corpus does use (MISSPELLING, not meaning) and 58 are
    reached by nothing mechanical. 58 rows is a table a person can write and keep.
  - THE RELATION GRAPH AND TAG VOCABULARY AS QUERY EXPANSION MEASURED NEGATIVE, and this was the
    most promising of the four on paper. 150 relation rows over 110 of 1,252 items; 80 of them
    (53%) are supersession, which points AT retired knowledge. With supersession dropped and
    `needs:` resolved through plan/seq there are 215 usable edges touching 236 items — 81% of the
    corpus has no edge at all. Score propagation moves MRR by -0.010 to +0.001 depending on
    weight, and of the 6 targets the lexical pass does not return at all the graph reaches 1. The
    idea is not wrong; this graph is too sparse to carry it, and the finding is about the corpus
    rather than about search.

THE LARGEST SINGLE MISS IS NOT ABOUT MEANING AT ALL. `text` is ONE contiguous substring on both
surfaces: `filterItems` calls `String.includes`, and `searchArchive` quotes the query into one
FTS5 phrase. So a two-word query fails whenever the corpus does not put those two words next to
each other. Measured on the archive over 1,363 two-word phrases he actually typed: 447 (32.8%)
return anything as a phrase, 1,363 (100%) as two AND-ed terms — median 3 spans against median 32,
which is the precision this buys with.

HEBREW, MEASURED BEFORE ANYTHING WAS OFFERED. Fixture: 1,301 Hebrew strings from the shipped UI
table plus the Hebrew lines in the corpus, 3,547 word types, indexed in memory under both
tokenizers. He types a word with a particle glued on its front and the text writes the bare word —
3,927 such queries: FTS5 trigram finds 51 (1.3%), FTS5 unicode61 finds 1 (0.03%). Trigram is 51x
better and still fails. Stripping ONE front particle off the QUERY finds all 3,927, assumes no
word boundary, and costs precision: 1,146 word types in this fixture begin with a particle letter
and have a remainder that is itself a word.

THE ASCII GUARD ON THE STEMMER IS NOT LOAD-BEARING, and that is a removal proof rather than a
story: guarded it rewrites 0 of 3,547 Hebrew word types, and with the guard deleted, 0. No Hebrew
word ends in `s`, `ed`, `ing` or `ly`. It stays as insurance for any future rule that trims by
LENGTH, which would maul Hebrew immediately.

D77'S OWN FIGURES, RE-TAKEN. 10,470 prose spans and 1,252 items today against the recorded 10,445
and 1,247 — right as of the day they were taken, grown since. Brute-force cosine over 11,722
vectors in plain JS: 4.5-5.2 ms at 384 dims (recorded 4.3), 8.1-8.4 at 768 (recorded 9.3), 15.6-19.7
at 1536 (recorded 27.2). The first two reproduce; the third reproduces well UNDER the recorded
figure, so that number is conservative and the conclusion it supports is unaffected.

WHAT THIS DOES NOT TELL YOU. Ground truth is 42 pairs, which is small, and every pair is a REQUEST
that produced an item rather than a search somebody ran — there is no log of real searches, because
no surface audits one. "Reach" over his vocabulary counts whether a word finds anything, never
whether what it finds is right. And the corpus grows under the script's feet: two runs an hour
apart do not produce identical numbers.

## Relations
- superseded_by [[MEAS-the-floor-for-finding-a-different-word-for-the-same-idea-2]]
