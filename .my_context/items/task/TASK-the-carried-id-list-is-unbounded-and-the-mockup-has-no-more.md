---
id: TASK-the-carried-id-list-is-unbounded-and-the-mockup-has-no-more
type: task
title: the carried id list is unbounded and the mockup has no more affordance for it
status: active
severity: soft
always: false
summary: A list of what a session inherited used to grow without limit and push everything else off screen; it is capped now.
summary_of: cdb1675b8de11278
summary_was:
  - 2026-09-03 A list of what a session inherited grows without limit and pushes everything else off screen; someone must decide whether to cap it.
acknowledged:
  - citation_form@51c0683c742376fa
scope: []
tags:
  - "plan:screens"
  - "seq:1s-e"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 797abde85d80b16f
state: done
plan: screens
seq: 1s-e
---

# the carried id list is unbounded and the mockup has no more affordance for it

Found 2026-08-23 by looking at the built screen over this repository's own corpus (screens plan, seq 1s). preview.carried says N index lines carried from session X, and the mockup draws one carrieditem under it because its sample carries one line. This corpus carries nineteen to twenty-six, so the block draws that many rows and the two graphics below it move most of a screen further down - photographed in reports/2026-08-23-ui3-1s-preview/app-live-middle-1568x779.png. Listing them all is the honest reading: the count and the ids are then the same fact twice, and a truncation with nothing saying so is the silent drop INV-nothing-is-dropped-silently forbids. But the design of record has no plus N more affordance for this list the way the index truncation has one, so there is nothing to copy for the bounded case. What it needs: an owner ruling on whether the carried list is capped and how the remainder is disclosed. Screens must not invent that affordance.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- an owner ruling, not an implementation.

It is now KNOWN to be the same code path plan:screens seq:1s-d and plan:walk seq:26 argue over: `preview.js` · `if (indexLine.carried !== true) continue;` (gone 2026-09-03) loops every index line with carried === true and draws one block each, unbounded. On the fixture that loop draws nothing (IndexSummary.carried is null unless the event is session-start with a resolved root, `read-model.ts` · `ctx.carried = resolveCarry` · ~373), which is why the walk never saw the problem this task describes. On the OWNER S OWN CORPUS it draws nineteen to twenty-six, photographed.

SO THE FIXTURE HIDES IT. That is worth saying plainly: this defect is invisible to every gate in the project and visible on the first real session. Dispatch it with seq:1s-d -- one ruling can answer both, since both ask what the block should say.

ANSWERED 2026-08-26 by the owner: "Same rule as the delivered list." See `DEC-a-record-list-bounds-by-time-a-computed-list-bounds-by`. So: a display cap, ordered by admission order, an exact "N shown of M" because M is already on the wire, and a show-all. The missing `+N more` affordance this task flagged is drafted with the delivered list s, in one sitting, under `DEC-claude-drafts-the-mockup-and-the-owner-approves` -- two surfaces sharing one mechanism must share their wording or the product grows two ways to say "there is more".
