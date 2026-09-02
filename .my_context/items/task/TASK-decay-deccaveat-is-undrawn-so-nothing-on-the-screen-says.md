---
id: TASK-decay-deccaveat-is-undrawn-so-nothing-on-the-screen-says
type: task
title: "Decay: #deccaveat is undrawn, so nothing on the screen says that cold means twenty sessions"
status: active
severity: soft
always: false
summary: Nothing on the staleness chart says that it counts sessions rather than days, so the whole picture can be misread as a calendar.
summary_of: 42dd4820c5fceb2e
scope: []
tags:
  - v2
  - ui
  - mockup
  - tree-parity
  - "plan:walk"
  - "seq:91"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 4e79d5e90dafb5a1
plan: walk
seq: "91"
state: todo
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/decay.js on 2026-08-29"
last_change: "2026-08-29T00:00:00Z"
---

# Decay: #deccaveat is undrawn, so nothing on the screen says that cold means twenty sessions

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.ev` - **Decay**, `<section data-p="decay">`. TWO GRAPHICAL VIEWS and this file draws both of them, both on plates (`#comb` and `#heat` are two of the eighteen views `test/ui/plate-usage.test.ts` covers).

  - **The comb** answers "how long since each item was last delivered", as an ORDINAL IN SESSIONS rather than a date. `/api/decay` gives a binary split at `window` and a `lastUsed` timestamp, which is not that; the ordinal is READ from `/api/sessions`, whose `sessionSummaries(n).map(s => s.sessionId)` is pinned equal to `recentSessions(n)`, and `combRows` indexes the server's own order and joins `series`' `(session, item)` markers onto it. IT IS NEVER RE-SORTED IN THE BROWSER, and that is not tidiness: a tooth's POSITION and a tooth's COLOUR are the same fact read twice, since `report.cold` was computed against `recentSessions(window)`. A browser-side sort is a second spelling of that order, and the day the two disagreed a warm item would sit past the window line with a warm fill and nothing would say which half was wrong.
  - **The heatstrip** is `audit_item.role` joined to `audit.at` - `dec.heatn` says so - and it is drawn from `GET /api/ask/audit`, which takes `since`, `until`, `kind` and `item` and answers records carrying `injected[]` and `spilled[]`. It is NEVER approximated from `/api/decay`'s `series`: the plan refuses that by name, and doing it would make the card contradict the paragraph printed under it, which says the ledger is not its source.

WHAT IS ALREADY HONEST AND MUST STAY THAT WAY. `SESSIONS_LIMIT` is twenty and the comb's axis runs to sixty, so an item whose newest ledger session is older than the twentieth-most-recent has an ordinal the response cannot name - it is "at least twenty" and no more. Such a tooth is NOT placed at a position it might not hold and NOT dropped in silence: `combRows` returns the count and the chart draws it as a `+N` line under the axis, the idiom the ego graph already uses for a cap it could not draw past. On a ledger of twenty sessions or fewer the count is zero and the line is absent, which is this repository's own case today.

WHAT IT OWES: **`#deccaveat`, and it is undrawn.** It is a `<p class="small">` in the design of record whose three sentences the mockup writes as a `HEB ? ... : ...` ternary in its own script, so NO TABLE DECLARES A KEY FOR ANY OF THEM. It is the sentence that tells a reader that "cold" means twenty SESSIONS and not twenty DAYS - and without it the whole comb is readable as a calendar, which is the one thing it is not.

THE BOUNDARY THIS SCREEN KEEPS, AND WHY THE CAVEAT IS ON THE WRONG SIDE OF IT. Every word inside the two graphics is also unkeyed - the tick labels, `never`, `sessions ago`, the badpin annotation, the heatstrip's two axis ends, the chart's accessible name - and those ARE transcribed as English literals, on the boundary `screens/graph.js` set: an unkeyed literal is allowed ONLY where no element can live, inside an SVG `<text>` or in an attribute, because an SVG `<text>` cannot hold an element and `tFlat` is the only sink there. `#deccaveat` is a paragraph in the document, where an element CAN live and `ctx.t()` belongs, so drawing it as an English literal would put untranslated prose in the reading flow of a bilingual screen. That is a different act from naming an axis inside a picture, and this screen refused it rather than blurring the line.

SO THE FIX IS A KEY WITH TWO SLOTS, DECLARED IN THE DESIGN OF RECORD FIRST. `strings-parity.test.ts` holds the key set equal to the mockup's `data-t` set in both directions, so the mockup gains the `data-t` and the sentences, then `en.js` and `he.js` are regenerated, then this screen draws the paragraph. BOTH VALUES ARE ALREADY ON THE CHART'S DATA - the window, and the ledger's own session count - so nothing has to be fetched or computed for it. It belongs in the same one mockup session as `plan:screens seq:10s`; it is not one of that task's nine facts, and this is why it was invisible to every count of them.

DO NOT CLOSE THIS BY MOVING THE SENTENCE INTO THE SVG. Putting it inside a `<text>` to borrow the literal exemption would make an unkeyed English paragraph permanent on the Hebrew page and would move the design of record's own `<p class="small">` out of the document, which is a mockup change made in code.

Filed under plan:walk seq:27. Decay was the largest finding list on the board when that task was written and both of its strongly-naming tasks are now done (walk/68's runtime chart CSS, walk/62's oversizing); what was left had no task and no name.
