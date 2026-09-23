---
id: TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you
type: task
title: typing three dots finds half of what it should, and a hit you cannot see on the page is not a hit
status: active
severity: soft
always: false
summary: Search now folds typographic characters the way SearchCursor does, and every match is painted in the document by the CSS Custom Highlight API under a count that says it counts turns of words over the whole transcript.
summary_of: 47791ef082780466
summary_was:
  - 2026-09-16 Make search match text that is written with typographic characters, and show every match highlighted where the reader is looking.
scope:
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - "plan:semantic"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 42c99ec5f0f85ff6
plan: semantic
seq: "8"
state: done
priority: "1"
---

# typing three dots finds half of what it should, and a hit you cannot see on the page is not a hit

BOTH HALVES SHIPPED, 2026-09-16 (lane AJ). The record is
`reports/2026-09-16-folding-and-highlight.md`.

ONE — THE FOLDING. `src/ui/public/lib/fold.js`, 102 lines of plain JavaScript that the browser
imports and `core/conversation-search.ts` loads with a top-level `await import()`, so the count
computed on the server and the highlight painted in the browser come from ONE matcher.

"Verify it works the same as the original code intended" was discharged by EXECUTION rather than by
reading. `SearchCursor` (@codemirror/search 6.7.2) and the three `@codemirror/state` char helpers
were extracted from the published tarballs into a scratch directory, given the three-line duck-typed
`text` lane AI identified, and run beside this matcher: 24 of 24 synthetic cases and 11,364 real
archive spans x 20 queries — 1,775,487 hits, ZERO differences in `from`, `to` or `precise`, and ZERO
byte mismatches. That run's output is the golden table in `test/ui/fold.test.ts`. Upstream's source
is NOT in the repository; vendoring it would need a licence file and a pin for a library the owner
ruled out. Nothing was added to `package.json`.

What it buys, re-measured on the live index today: `...` reaches 463 spans as a substring, 463
through FTS5, and 1,024 folded — 2.21x. `..` reaches 1,041 folded and 0 through FTS5, which is below
the trigram floor. 817 of 11,364 spans change under NFKD and 791 change LENGTH.

The offsets are carried, never mapped back — a partial match records the ORIGINAL offset it began
at, which is upstream's design and is why there is no arithmetic to get wrong. UTF-8 BYTES are
accumulated on the same walk as the UTF-16 units, so the two cannot disagree.

TWO — EVERY HIT HIGHLIGHTED. `GET /api/conversations/:id/find` scans every prose span of ONE
transcript with the folded matcher (`findInDocument`) and answers in DOCUMENT order, so the tier
`searchArchiveTiered` carries is never consulted here and the archive answer is untouched. FTS5 is
not asked, and not only because it has no `offsets()`: the index holds the text UNFOLDED, so a
two-stage shape would have handed the second stage 463 of the 1,024 spans and lost 561 silently.

`CSS.highlights` paints every match in every drawn row, rebuilt from `live` on every paint. That is
not caution — it was measured: a `Range` into a row the virtualiser evicts does NOT go inert, it
COLLAPSES to (parent, 0) and stays connected, so a kept registry would paint nothing while
`CSS.highlights.has()` still answered true.

THE COUNT COUNTS TURNS OF WORDS in this transcript, from the server's scan, and the line says so
along with how many turns were read out of how many records — the 1.08% gap lane AI's report closes
on. It is turns and not occurrences because the server matches the RECORD's text and the browser
paints the RENDERED text, and Markdown syntax is in one and not the other.

Held by 20 removal proofs, each shown to redden at its own named test. THREE reddened nothing on the
first run and all three are recorded rather than hidden: a document-order fixture built backwards so
the sort under test was a no-op, a bound only ever exercised on the ASCII path, and one guard that
is genuinely not load-bearing and is now labelled as such. Driven in Playwright in both languages,
by hand against this repository's live 133 MB session and by
`e2e/conversations-find.spec.ts` (7 tests x 2 languages).

TWO DEFECTS FOUND BY DRIVING IT AND FIXED: a step landed on the TURN rather than on the match, which
on a turn of tens of thousands of characters put the highlight screens below the fold; and the first
press of Next skipped match 1, because the reader stands on it the moment a query settles.

WHAT REMAINS, and it is the owner's to schedule rather than this lane's to take:
  — the stepper bar is now three lines of groups instead of two (162.8 px with a query typed in
    English, 95.2 px in Hebrew, against 60.8 px idle). Named in the report for his eye.
  — machinery is still unsearchable on this surface. It now SAYS so on every count line, which is a
    disclosure and not a fix; the fix is lane AI's finding 1 and is a different build.

## Request

1 table & report - if required make them 2 different anchor types with 2 distinguished marks, 2 yes, 3 write 40 lines of code - just verify it works the same as the original code intended and every found search result in my viewer should be highlited, 4 clear them
