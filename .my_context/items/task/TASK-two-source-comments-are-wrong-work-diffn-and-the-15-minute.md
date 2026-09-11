---
id: TASK-two-source-comments-are-wrong-work-diffn-and-the-15-minute
type: task
title: "two source comments are wrong: work.diffn and the 15-minute idle exit"
status: active
severity: soft
always: false
summary: "Both halves shipped and were never recorded: the idle sentence was deleted on 2026-09-03 and the word-level wording was reworded by owner ruling on 2026-09-04."
summary_of: 35433973cff59ab8
summary_was:
  - "2026-09-11 Two descriptions no longer match reality: a stale note about a timeout, and on-screen text describing a comparison that works differently."
scope: []
tags:
  - v2
  - "state:done"
  - "plan:rulings"
  - "seq:49"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 00e0a9aa0d880880
state: done
plan: rulings
seq: "49"
verified_on: 2026-09-04
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

CLOSED 2026-09-12 by the lane that took plan:rulings as a cluster. BOTH HALVES HAD ALREADY SHIPPED, and neither had been recorded here, so this item was offering work that was four and nine days old. THE IDLE HALF shipped in commit 39a419dd (2026-09-03, `parity: the ready excuse was false in both clauses, so it is retired`), which deleted the sentence `holding this open still lets the 15-minute idle exit fire (spec 2)` from src/ui/watch-model.ts. No statement of fifteen minutes survives anywhere under src/ except the two that are deliberately historical - src/ui/idle.ts naming the owner ruling that replaced it, and src/ui/server.ts warning a test not to inherit production's window. THE work.diffn HALF was settled by owner ruling 2026-09-04 and is recorded at src/ui/public/screens/work.js under the heading THE DIFF IS LINE-LEVEL: the ruling was to reword the sentence rather than to build a second diff. Both string tables now say line-level - en.js reads `a line-level diff` and he.js reads the same in Hebrew - so strings-parity holds and nothing composes a second comparison. ONE THING IS LEFT AND IT IS NOT THIS ITEM'S: the mockup's own Hebrew copy at docs/design/web-ui-mockup.html still reads word-level. DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap retired the app-to-mockup direction on 2026-08-26, so the mockup is history rather than a specification the app must equal, and strings-parity compares key SETS and not values. It is noted here so the next reader is not surprised by it.
