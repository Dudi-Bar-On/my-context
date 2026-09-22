---
id: TASK-find-the-editor-grade-search-this-project-should-adopt
type: task
title: find the editor-grade search this project should adopt rather than write, and say what taking it would really cost
status: active
severity: soft
always: false
summary: "Measured every adoptable search library against the real corpus: embed CodeMirror's SearchCursor (148 lines, MIT) for find-in-document offsets, embed nothing for the archive, and use the CSS Custom Highlight API instead of a highlighter."
summary_of: 25cf2497172f0eed
summary_was:
  - 2026-09-16 Research which existing open-source search library or UI component could give the viewer a proper editor-style find, and what adopting one would cost.
scope:
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
  - package.json
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 0ab12987daf35457
plan: semantic
seq: "6"
state: done
priority: "1"
---

# find the editor-grade search this project should adopt rather than write, and say what taking it would really cost

ANSWERED 2026-09-16 — `reports/2026-09-16-search-adopt-or-build.md`. The owner ruled mid-lane that
embedded source is not a runtime dependency, which is now recorded in `CONST-zero-runtime-dependencies`,
so the question stopped being *may we* and became *which part, and what do we then own*.

TWO SURFACES, TWO DIFFERENT ANSWERS.

(A) FIND IN THE DOCUMENT I AM READING — ADOPT ONE THING, 123 LINES. Every editor component fails for
a reason that is not size: THE DOCUMENT IS NOT IN THE BROWSER. The session a reader opens is
133,232,086 bytes over 52,292 records; `conversations.js` holds an outline (~140 characters a turn)
and a windowed, explicitly non-monotonic `bodies` cache. Monaco, Ace and CodeMirror all require the
whole document handed over, and a DOM highlighter like mark.js requires the text to be in the DOM,
which under virtualisation it is not — so it reports a wrong count silently.

Monaco and Ace are refused by this project's own vendor gate, not by taste: between them their
shipped builds carry FIVE of the seven FORBIDDEN constructs (`new Worker`, `importScripts`, `eval(`,
`new Function`, `XMLHttpRequest`). Every `@codemirror/*` dist file is clean of all seven but uses
BARE specifiers, which `CONST-node-24-no-build-step` does not permit — the same reason `VENDOR.md`
rejected Web Awesome's `dist/`. CodeMirror publishes no self-resolving build, so the vendor road is
closed and the source road is the only one.

WHAT IS ADOPTABLE IS `SearchCursor` (`@codemirror/search` 6.7.2, MIT, `src/cursor.ts`) — 123 lines
that reach into CodeMirror for exactly five members: `text.iterRange`, `text.length`, `iter.next`,
`iter.value`, `iter.done`. That is a duck-typed interface, so NONE of the 583-line rope, the 480 kB
view or the search panel comes with it. Plus 25 of the 37 lines of `char.ts`. ~148 lines total.

IT BUYS ONE MEASURED THING: NFKD folding with offsets mapped back to the original text. 806 of
11,251 spans change under NFKD, overwhelmingly U+2026 `…` (x3062). A reader who types `...` reaches
456 spans today and 1,012 folded — 2.2x, on a query this product invites by writing `…` everywhere.
IT DOES NOT HELP HEBREW (NFKD does not touch a glued front particle), its offsets are UTF-16 where
this project uses BYTE offsets (53,268 bytes of divergence over one session), and it carries one
parameter property `CONST-node-24-no-build-step` forbids by name.

IT GOES IN `src/core/`, NOT `vendor/`: the text is server-side, and a hand-edited file cannot carry
a SHA-256 pin without weakening the gate for everything already under that heading. It is stage TWO
behind FTS5 — and stage two is necessary because FTS5 HAS NO `offsets()` (verified: *"unable to use
function offsets in the requested context"*). A hit count and a next/previous walk cannot be got
from FTS5 at all.

THE HIGHLIGHT HALF NEEDS NO LIBRARY. The CSS Custom Highlight API highlights Ranges without touching
the DOM — Baseline since June 2025, Interop 2026 — so it cannot perturb the virtualiser the way a
`<mark>` wrapper would. Zero bytes. And the honest answer to *"if ui component exists it's an
advantage"*: THERE IS NO STANDALONE FIND-BAR COMPONENT. Only editor widgets and DOM walkers.

(B) SEARCH THE WHOLE ARCHIVE — EMBED NOTHING, AND HEBREW IS WHY. Five libraries were BUILT over the
real 12.76 MiB prose corpus and measured, not estimated. On three bare Hebrew words the corpus
writes with a particle glued on the front:

  FTS5 trigram (ships)   15 / 6 / 8   at 0.01-0.04 ms, zero JS heap
  substring baseline     15 / 6 / 8
  MiniSearch 7.2.0        4 / 0 / 2   1,793 ms build, +63.8 MiB
  FlexSearch 0.8.212      6 / 0 / 2   2,376 ms build, +84.2 MiB
  Orama 3.1.18            0 / 0 / 0   5,306 ms build, +130.4 MiB
  Lunr 2.3.9              0 / 0 / 0   2,845 ms build, +243.1 MiB
  Fuse.js 7.5.0          30 / 6 / 8   but 827 ms PER QUERY — a linear scan

Every word-boundary JS index is `unicode61` reintroduced through a package, which is the tokenizer
this project already measured at 51x worse. FlexSearch, Orama and Fuse.js are also Apache-2.0, which
adds a NOTICE obligation MIT does not. A library that duplicates FTS5 in JavaScript is a downgrade
dressed as an upgrade.

HOW IT RELATES TO LANE AF: nothing here replaces the tiers and nothing makes them unnecessary. On
the archive box AF's work IS the answer. On the document box `SearchCursor` sits one stage
downstream — AF decides WHICH SPANS, the cursor decides WHICH OFFSETS INSIDE THEM. One thing to
watch: AF de-duplicates across tiers and a find bar needs document order, so the tier must be a
LABEL on a hit and not its sort key.

ORDER OF WORK RECOMMENDED: let AF land; draw the find bar with no library at all (input, count, two
arrows, `CSS.highlights`, `Scroller.top()`); embed `SearchCursor` only if the count line proves it is
wanted. Refusing it costs ~40 lines of subtle offset arithmetic, not the feature — which is the
opposite of the markdown-it ruling, where the hand-written alternative reached 30% against 100%.

AND THE LARGEST HONEST GAP IS NOT A LIBRARY QUESTION: only 1.08% of the scanned archive is
searchable at all (13,376,813 indexed characters against 1,241,841,802 bytes scanned). `kind` is
`{prompt, answer}`; machinery is 47,910 of one session's 52,292 records and is in no index, and no
surface says so.

## Request

ok so discard semantic search by using claude -p, agree it is bad idea, but you must find the best flexible way to implement smart and complex searches on a text file exactly as good editors do, so what i suggest is do a deep research over open source packages available in node if ui component exists it's an advantage and let's use such a solution without much effort.
