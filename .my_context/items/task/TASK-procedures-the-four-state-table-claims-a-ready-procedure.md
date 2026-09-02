---
id: TASK-procedures-the-four-state-table-claims-a-ready-procedure
type: task
title: "Procedures: the four-state table claims a ready procedure injects an index line, and has no row for the fifth stage"
status: active
severity: soft
always: false
summary: A reference table on the screen makes two claims the product does not honour, and is missing a row for one of the stages.
summary_of: c7c18602bf9244a5
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:proc"
  - mockup
  - "plan:walk"
  - "seq:96"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 1444bce98e3e1c3c
plan: walk
seq: "96"
state: done
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/proc.js and src/core/select.ts on 2026-08-29"
---

# Procedures: the four-state table claims a ready procedure injects an index line, and has no row for the fifth stage

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.ch` -- **Procedures**, `<section data-p="proc">`. The one-shot lifecycle: steps performed once and then done. Three cards -- a STATIC four-state table with `pr.why`, a LIVE card per procedure the corpus holds (`GET /api/procedures` + `GET /api/procedure/:id`), and `pr.write`'s three paragraphs about who may tick a box. `nav.ch` is "Change -- composed, never run" and this screen keeps it exactly: nothing here writes, `src/ui/proc-model.ts`'s routes are read-only, there is no POST in `ctx` at all, and the one line it composes goes to a clipboard.

WHAT IT OWES: **the static table, which is the design of record's own transcription, makes two claims the product contradicts.** Both are recorded in `screens/proc.js`'s header and neither is in a task.

**1. `pr.idx` puts "index line only" against the `ready` row, and no `ready` procedure has ever reached an index line.** `isEligible` in `src/core/select.ts` admits `active` only, so a `ready` procedure reaches neither the injected block nor an index line, and `injection()` answers `not injected (status "proposed")`. `src/ui/proc-model.ts` says so in its own words -- "IT IS THE MOCKUP THAT IS WRONG" -- and serves BOTH the table's sentence, as the `ready-is-not-injected` disclosure, and the true per-item verdict.

THE SCREEN HANDLES THIS HONESTLY AND CANNOT RESOLVE IT. The table is drawn as designed, the card's chip is drawn as measured, and the disclosure explaining the gap is rendered underneath -- so on a `ready` procedure the table and the chip disagree ON SCREEN, by construction, with a paragraph between them saying so. That is the correct behaviour for a screen and the wrong resting state for a product: the design of record asserts an injection rule the selector does not implement.

**2. `pr.states` says "Four states, and exactly one of them injects" and there are five.** `STAGES` in `src/ui/proc-model.ts` is `proposed, ready, active, done, abandoned`. The fifth is not an invention of the code: `pr.aband`, drawn on this very screen, says "Abandoned rather than finished is `superseded`". So the screen already names the state in prose and has no row for it in the table above.

The card does not drop it -- it prints the stage as its own chip text, so an abandoned procedure reads `abandoned` on screen whether or not the table has a row. What is missing is the ROW, and with it a meaning string and an injection string, neither of which `pr.` declares.

WHAT THE WORK IS: a mockup edit, and it is the owner's under `DEC-claude-drafts-the-mockup-and-the-owner-approves`. Correct the `ready` row's injection cell to what `isEligible` actually does, add the fifth row with `pr.` keys for its meaning and its verdict, then let `screens/proc.js` transcribe the corrected table and `test/ui/proc-screen.test.ts` hold all five rows against the mockup's `<tr>`s as it already holds four. It needs a screenshot, and it belongs in the same mockup session as plan:walk seq:3.

DO NOT close half of it. Adding the fifth row while leaving `pr.idx` wrong leaves the screen contradicting itself in the same place, with one more row of it.
