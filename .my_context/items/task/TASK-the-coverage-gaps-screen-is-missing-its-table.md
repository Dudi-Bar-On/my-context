---
id: TASK-the-coverage-gaps-screen-is-missing-its-table
type: task
title: the Coverage gaps screen never draws its directory row, and one listed gap is the mockup's alone
status: active
severity: soft
always: false
summary: The coverage table itself is finished, but no corpus has ever had the kind of gap that makes its last row appear, so parts of it stay unseen.
summary_of: f090affd558acd0b
summary_was:
  - 2026-09-03 A few cell-level pieces of the coverage table are still missing, though the table itself has since been built.
acknowledged:
  - body_disagrees_with_meta@37a285a3f21bfd7b
scope: []
tags:
  - "plan:screens"
  - "seq:4s"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 959dbe29f8ea9385
plan: screens
seq: 4s
state: todo
---

# the Coverage gaps screen never draws its directory row, and one listed gap is the mockup's alone

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink.

AS FILED, thirteen kinds were missing:  p.small, table, tbody, th, thead, tr, b, button.icon, span.m, span.v, td, td.m, td.small.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order. VERDICT: STANDS, REDUCED -- and that is the day the filed title stopped describing it, which is why the title above is not the one this task was filed under.

THE TABLE LANDED. Seven of the thirteen this task listed came out: p.small, table, tbody, th, thead, tr, b. The `gaps` entry in KNOWN_GAPS was down to SIX, and by that file's own rule it could not have shrunk unless the gaps closed.

RE-MEASURED 2026-09-03, read straight out of the ledger: the entry is now FOUR kinds -- `gaps: ['button.icon', 'span.m', 'span.v', 'td.m']`. Two more left on 2026-08-31 under plan:walk seq:90, and they were DATA rather than code: `gaps.cat` was `category {m:open_question}`, an `{m:...}` LITERAL, so the key could only name the one category the mockup's demo row happens to show and there was no substitution for any other. It is `category {mv:name}` now and the rows are filled from `/api/help/categories`' `corpus.empty`, which answers NINE over this corpus (measured 2026-08-31 by calling `apiHelp` against `.demo-corpus` directly) -- so this gate's own fixture closed `td` and `td.small`.

WHAT IS ACTUALLY LEFT, and it is a different task from the one this was filed as. Three of the four are the DIRECTORY row's, and they are cell-level kinds inside the table that now exists:
  button.icon   its Compose control - an affordance, not a row
  td.m          its `Where` cell
  span.v        its `{files}` count

Neither corpus holds an ungoverned directory, so the row never draws and all three are still DATA rather than code. `test/ui/gaps-screen.test.ts` builds all three from a body that HAS a gap, which is the proof this ledger cannot carry.

The fourth is not a gap in the app at all. `span.m` did not close and it moved: `lib/i18n.js` builds a `{mv:}` run as `span.m.v` -- the same monospace isolation, carrying a VALUE -- where the mockup froze one category's name into a bare `span.m`. No live corpus produces the mockup's form, and the mockup is history rather than behaviour (`DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`).

Read the four, not the six and not the thirteen. A body that names closed gaps is how a task gets rebuilt from scratch by somebody who trusted it.
