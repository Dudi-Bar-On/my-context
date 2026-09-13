---
id: TASK-the-largest-client-file-is-seven-movable-units-around-one
type: task
title: the largest client file is seven movable units around one 2370-line closure
status: active
severity: soft
always: false
summary: The biggest file in the UI can be cut into seven separate files; the first cut is done, the next one needs the shared vocabulary moved first, and the largest piece cannot move at all until its state is redesigned.
summary_of: b35b0598f92e31d6
summary_was:
  - 2026-09-13 The biggest file in the UI can be cut into seven separate files, but the largest piece inside it cannot be moved without first redesigning how its state is shared.
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - accretion
  - refactor
  - "plan:accretion"
  - "seq:5"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/lane-item.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5924ef786fea1519
plan: accretion
seq: "5"
state: done
---

# the largest client file is seven movable units around one 2370-line closure

Design of record: `reports/2026-09-13-conversations-js-mapped.md`, written by a lane that read the whole file.

WHAT WAS MEASURED. `src/ui/public/screens/conversations.js` is 7,326 lines -- larger than `src/ui/read-model.ts` at 4,203, and the largest file in this repository. `TASK-the-largest-file-in-the-repository-is-twenty-independent` (`plan:accretion seq:1`) is about `read-model.ts` and its claim does not transfer: that file is about twenty independent handlers with almost no shared state, and this one is a handful of real modules plus ONE OUTSIZED CLOSURE. Its problem is not repetition, it is shared mutable state.

THE SHAPE. Seven movable units and one monolith. The map's table gives the line ranges. What crosses the seams:

  SAFE. `KINDS`, `ANCHOR_KIND_GLYPH`, `READER_ZONE` and every href builder are read-only with one source of truth. `Scroller`, `estimateHeight` and `matchesNode` are already exported and independently tested by `test/ui/transcript-viewer.test.ts`.

  CLEAN. `mountRetrieval` and `mountSecrets` are mounted INTO `mountDocument`'s DOM but share only a passed host and seed.

  THE ONE CROSSING THAT BLOCKS A SPLIT, and it is a third of the file. Every helper inside `mountDocument` -- paint, refill, redraw, applyFilter, onCopy, onSelect, markControl, landOn, nodeAtByte, sayArrived, atTail, the follow poller -- reads and writes the same dozen variables: view, scroller, known, bodies, live, waiting, held, marked, anchorsHere, stickUntil, seenBytes, seenMtime, unseen.

WHAT TO DO, IN THIS ORDER, EACH PROVED BEFORE THE NEXT.

  1. The pure infra -- `Scroller`, `estimateHeight`, `matchesNode` -- into a module of its own, keeping the exports. Re-run `test/ui/transcript-viewer.test.ts`.
  2. Turn and step rendering. Takes parameters, returns DOM, shares nothing.
  3. List, list-filter, archive+anchors, secrets, roster and retrieval as separate files. A scan for straggler closure references is the precondition before each move.

AND `mountDocument` IS NOT ON THAT LIST. Its decomposition is a redesign of how fifteen pieces of mutable state are shared, not a file move, and must be scoped separately -- never bundled with 1-3.

THE CONSTRAINT ON ANY CUT. The file's commentary is load-bearing: it cites owner rulings and measured numbers and argues against alternatives already tried and rejected. A split loses no institutional memory only if the comments move with their code.

WHAT IS ALREADY DONE AND IS NOT PART OF THIS. The two live bugs the map found are fixed and measured: the document's find box now settles like the other three, and the anchors list is paged through `boundedList`. Those belong to `TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and`.

WHAT IS DONE AND WHAT THE PRECONDITION SCAN FOUND, 2026-09-13.

STEP 1 IS DONE. `estimateHeight`, `matchesNode` and `Scroller` are now `src/ui/public/lib/transcript-scroll.js`, re-exported from the screen so no importer changed. `test/ui/transcript-viewer.test.ts` was NOT edited and its 22 assertions stay green; perturbing `LINE_PX` in the new module turns exactly one of them red, which is the proof the arithmetic went across whole.

STEP 2 IS NOT A FILE MOVE EITHER, and the scan is why. Over the rendering block (`saidBody` through `drawWaiting`, the href builders and the lane helpers) the block declares 36 names, and:

  - it reaches OUT for exactly four module-scope names -- `KINDS`, `dayText`, `laneKey`, `sessionFromHash`;
  - the rest of the screen reaches IN for twelve -- `NO_LANES`, `drawTurn`, `drawDeed`, `drawWork`, `drawWaiting`, `laneHref`, `laneIndex`, `laneKind`, `passageLabels`, `rosterFromHash`, `rosterHref`, `sessionHref`.

So a straight move makes a CIRCULAR import: the screen imports the renderer, and the renderer imports four names back out of the screen. The map's "no straggler closure reference was found" holds -- nothing reads a closure variable -- but four module-scope references are not nothing, and `sessionFromHash` is a ROUTER helper that does not belong in a render module.

The order that works is therefore one step longer than the map's: extract the shared vocabulary and format helpers FIRST (the map's own unit at lines 59-310: `KINDS`, `titleNodes`, `dayText`, `READER_ZONE`, the href builders, `laneKey`), leaving the router's `sessionFromHash` and `rosterFromHash` where they are, and only then move the rendering. Two moves, each needing the screen driven in both languages.

AND A CONSTRAINT ON WHERE THE RENDERING MAY GO. `test/ui/screen-literals.test.ts` walks `screens/*.js` and nothing else, and its ledger is keyed by FILE. So string-bearing code may only move to another file under `screens/` -- moving it to `lib/` would take it out of the only gate that sees an unkeyed literal -- and the move will move ledger entries, which the gate reports as one departed and one appeared until the ledger is updated with it.
