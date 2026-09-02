---
id: TASK-two-source-comments-are-wrong-work-diffn-and-the-15-minute
type: task
title: "two source comments are wrong: work.diffn and the 15-minute idle exit"
status: active
severity: soft
always: false
summary: "Two descriptions no longer match reality: a stale note about a timeout, and on-screen text describing a comparison that works differently."
summary_of: 456177f89f4b4c65
scope: []
tags:
  - "plan:rulings"
  - "seq:49"
  - v2
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 6551b985e9490883
state: todo
plan: rulings
seq: "49"
---

# two source comments are wrong: work.diffn and the 15-minute idle exit

Found 2026-08-24 by the documentation wave, reported rather than fixed because the files belonged to other agents at the time.

`src/ui/public/strings/en.js` - `work.diffn` tells a reader the diff is WORD-LEVEL. `lineDiff` is line-level. The string is user-facing, so this one is not merely a stale comment: it describes the screen to the person looking at it.

`src/ui/watch-model.ts` ~553 still says "the 15-minute idle exit". `IDLE_MS` became eight hours by owner ruling on 2026-08-23, and every other statement of that number was moved with it - this one was missed.

The string half needs a key change in BOTH tables and the mockup, since `strings-parity` compares the key sets in both directions and the mockup declares them first. That makes it wait on the screen thaw; the comment half does not.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND IT SPLITS. The two halves belong to different owners and only one is a one-line fix.

THE IDLE HALF IS A ONE-LINE FIX, unowned by anything else: watch-model.ts ~553 still says "the 15-minute idle exit"; IDLE_MS became eight hours by owner ruling on 2026-08-23, and every other statement of that number was moved with it. Do it now. It is also one of the six false claims plan:rulings seq:48 found in the README -- the SAME wrong number, in two places, from one ruling nobody swept.

THE work.diffn HALF IS plan:walk seq:16, "the mockup catches up with preview.whyn, and work.diffn needs a ruling". And this task states the reason it needs a RULING rather than an edit, better than seq:16 does: work.diffn is USER-FACING TEXT, not a comment. It tells the reader the diff is WORD-LEVEL and lineDiff is line-level. So it is the screen describing itself wrongly to the person looking at it, and strings-parity holds the key set equal to the mockup s in both directions -- the mockup moves first. It joins the mockup session.
