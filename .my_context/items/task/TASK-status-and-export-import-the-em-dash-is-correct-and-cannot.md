---
id: TASK-status-and-export-import-the-em-dash-is-correct-and-cannot
type: task
title: "Status and Export / import: the em dash is correct and cannot say why"
status: active
severity: soft
always: false
summary: Two screens draw a dash where a number would go and cannot say why it is missing, though the reasons behind them are entirely different.
summary_of: 2d10a17146f7ada0
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:89"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: bad699241318edda
plan: walk
seq: "89"
state: todo
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/status.js and port.js on 2026-08-29"
last_change: "2026-08-29T00:00:00Z"
---

# Status and Export / import: the em dash is correct and cannot say why

WHAT THE TWO SCREENS ARE, so they can be built without opening the mockup.

**Status** (`nav.ev`, `<section data-p="status">`) is section 4's recorded EXCEPTION: a table, kept as a table, claiming nothing more. It is NOT the landing screen - `st.sub` says so in the mockup's own words, and the shell already routes `#/` to the injection preview - it is where the header's corpus counts lead. Its verdict is the warning glyph, the only one in `nav.ev` that is, and that glyph is the concession drawn. FIVE ROWS, and `st.four` is the sentence that binds them: "There are four unfinished-work queues, not one." Counts sit on bare glass rather than on a plate, deliberately: `test/ui/plate-usage.test.ts` names the eighteen graphical views the plate rule covers and excludes this table by name, because nothing here is a mark whose position or size carries meaning.

**Export / import** (`nav.ch`, `<section data-p="port">`) draws the composed export command, the audit-kind chips that do and do not travel, the import history, and the import buckets.

THE DEFECT IS ONE SHAPE AT TWO SITES, AND BOTH MODULES CALL IT THEIR LOUDEST OPEN QUESTION. Each draws an EM DASH where a number would be. The em dash is the design of record's own mark for "no value here" - it draws one for the doctor finding that names no item - so the row is honest as far as it goes. WHAT THE EM DASH CANNOT SAY IS **WHY**, because no string table declares a key for the reason, and the two reasons are completely different from each other.

  - **Status, `st.staged` and `st.ingest`.** Two of the four queues the screen exists to name, and `/api/status` answers neither. THAT IS A BOUNDARY RULING, NOT A MISSING FIELD. The counts come from `listStaging` (`lesson/derive.ts`) and `listSessions` plus `pendingAnchors` (`ingest/session.ts`), and `lesson/derive.ts` imports `createItem` from `core/mutate.ts` - so serving them would put the MUTATION SURFACE into this read-only server's runtime import graph for the first time and turn `test/ui/no-writes.test.ts` red. The endpoint reported that rather than doing it. Both rows are drawn anyway, with the dash, because three of five rows would delete two of the four queues from a screen whose only sentence is that there are four of them, and would delete them silently - the failure `INV-nothing-is-dropped-silently` names.
  - **Export / import, every import bucket cell.** There is no `/api/port` request that takes an artefact and there is NO POST anywhere in this UI, so there is no state of this build in which those cells hold data. The column HEAD stays, because the column is the design of record's and the day an import surface exists it fills.

WHAT IS OWED, AND IT IS THREE SEPARABLE THINGS:

  1. **A KEY THAT SAYS WHY A DASH IS A DASH.** Declared in the design of record FIRST - `strings-parity.test.ts` holds the key set equal to the mockup's `data-t` set in BOTH directions, so a key added to `en.js` and `he.js` alone fails in the direction that names it. It belongs in the same one mockup session as `plan:screens seq:10s`; it is NOT one of that task's nine facts, and the difference matters: those nine are values the engine COMPUTES and cannot word, these are values that DO NOT EXIST and whose absence cannot be worded. One dash needs "this server will not read it"; the other needs "there is nothing to read yet". Two keys, not one, unless the owner rules a single sentence covers both.
  2. **For Status: a read-only path to the two counts, or a written ruling that the boundary outranks the rows.** Either `listStaging` and the ingest pending-anchor count get a read-only route that does not drag `core/mutate.ts` in, or it is recorded that these two queues are permanently uncountable from the browser and the key from (1) is the whole remedy. `plan:rulings seq:50` - the no-writes ban only sees writers its table already names - is the neighbouring work and is NOT a substitute: deriving the ban's membership does not make `lesson/derive.ts` importable.
  3. **For Export / import: nothing beyond (1), until an import surface exists.** The dash there is correct and will stay correct; the key is the whole fix. Do not build an import POST to close this task - that is a different decision and not this one.

WHAT NEITHER SCREEN OWES, so nobody re-opens it. Status is served `version`, `profile`, `items.byCategory`/`byStatus`/`byOrigin`, `reviewQueue.always`, `reviewQueue.globalLayerDrafts` and the `health` tally, and draws none of them: the plan's Step 3 sketch drew three as extra tables, the mockup draws none, and they are left unread rather than promoted into columns nothing asked for. Export / import likewise reads and does not draw `manifest.json`'s row, the hand-maintained `rebuilt` rows, the dropped item join, and `history.importedDir` - the last because `port.hist` already spells the destination inside its own `{m:}` run and drawing both would put one path on screen twice in two spellings.

Filed under plan:walk seq:27. Status's only open claiming task is `repaint/7b` (the counts table on bare glass, which is a decision rather than a defect); Export / import's are `walk/5` and `walk/4`, both about the PROPOSED annotation. Neither screen had a task saying what it is or what it owes.
