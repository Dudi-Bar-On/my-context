---
id: TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you
type: task
title: typing three dots finds half of what it should, and a hit you cannot see on the page is not a hit
status: active
severity: soft
always: false
summary: Make search match text that is written with typographic characters, and show every match highlighted where the reader is looking.
summary_of: bbdc63aa77636074
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 9820880e488d8856
plan: semantic
seq: "8"
state: todo
priority: "1"
---

# typing three dots finds half of what it should, and a hit you cannot see on the page is not a hit

THE OWNER RULED, 2026-09-16: "3 write 40 lines of code - just verify it works the same as the
original code intended and every found search result in my viewer should be highlited".

TWO THINGS, and the second is the one he emphasised.

── ONE: FOLD THE TEXT, IN ABOUT FORTY LINES ─────────────────────────

Lane AI recommended vendoring `SearchCursor` from `@codemirror/search` (MIT, ~148 lines) and
the owner chose to WRITE IT instead — read `reports/2026-09-16-search-adopt-or-build.md` §4,
which costs exactly this choice and says the hand-written version is ~40 lines.

WHAT IT BUYS, measured: a reader typing `...` reaches 456 spans today and 1,012 with NFKD
folding, BECAUSE THIS PRODUCT WRITES `…` 3,062 TIMES. The same applies to the quotes, dashes
and spaces a model emits and a keyboard does not.

AND THE HARD PART IS NOT THE FOLDING, IT IS THE ARITHMETIC. One line of `.normalize('NFKD')`
captures the ellipsis win. The other ~40 lines are mapping a match found in NORMALISED text
back to a BYTE offset in the original, and 376 spans in one session CHANGE LENGTH under
normalisation. Get that wrong and every offset after the first folded character is wrong —
silently, because a wrong offset lands mid-record and reports `unreadable` rather than
throwing. BYTE offsets, never character offsets. Hebrew is half this corpus.

"VERIFY IT WORKS THE SAME AS THE ORIGINAL CODE INTENDED" IS A REQUIREMENT AND NOT A NICETY.
`SearchCursor` is MIT and readable; read what it actually does about normalisation and about
mapping back, and show your version reaching the same answers on the same inputs. Where you
deliberately do LESS than it does, say which case you dropped and why it does not arise here.

── TWO: EVERY HIT IS HIGHLIGHTED WHERE HE IS LOOKING ──────────────────

His words: "every found search result in my viewer should be highlited". Today a hit is a row
in a list; he wants to SEE it in the document.

THE OBSTACLE IS THE ONE THAT DISQUALIFIED EVERY EDITOR COMPONENT: THE DOCUMENT IS NOT IN THE
BROWSER. The session is ~133 MB over ~52,000 records and `conversations.js` holds an outline
plus a WINDOWED, explicitly non-monotonic `bodies` cache. So a find that walks the DOM sees
only the rows currently drawn — and a DOM walker in a virtualised scroll reports a wrong count
SILENTLY, which is the defect this project exists to refuse.

Lane AI measured the way out and it needs no library: THE CSS CUSTOM HIGHLIGHT API (Baseline
since June 2025) paints `Range`s without touching the DOM — no wrapper elements, no reflow,
nothing to unwind, and it survives the virtualiser recycling a row. Verify that claim yourself
before building on it, including what happens when a highlighted row is evicted and redrawn.

AND THE COUNT IS PART OF THE FEATURE. A reader needs to know how many there are and where he
is in them. FTS5 CANNOT PRODUCE THAT COUNT — lane AI verified `offsets()` fails with "unable
to use function offsets in the requested context" — so say where the number comes from and
what it is a count OF. A count that silently means "in the rows I have drawn" is worse than no
count at all.

── AND MIND WHAT LANE AF JUST SHIPPED ──────────────────────────

It flagged this for you: `searchArchiveTiered` DE-DUPLICATES ACROSS TIERS, and a find bar needs
DOCUMENT ORDER. So the tier must become a LABEL on a hit rather than its sort key for this
surface. Do not undo the tiers — `semantic/4` is the archive answer and it is proved in both
languages. Read `reports/2026-09-16-the-search-shipped.md` before touching that file.

Held by removal proofs, one per assertion, each shown to redden at its own line. Driven in
Playwright in both languages before anything is reported, because it is a UI change.
