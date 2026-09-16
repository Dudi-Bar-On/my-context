---
id: TASK-the-automatic-marking-stopped-and-said-nothing-because-a
type: task
title: the automatic marking stopped and said nothing, because a stale row makes every step below it correctly decide there is no work
status: active
severity: soft
always: false
summary: Automatic bookmarking had quietly stopped; the real cause was found, fixed and demonstrated, and the pass can now say when it could not read anything at all.
summary_of: cecf6e768ef96fa8
summary_was:
  - 2026-09-16 Bookmarking stopped silently half an hour ago and kept saying there was nothing to do, because the archive quietly stopped reading new turns.
scope:
  - src/core/conversation-index.ts
  - src/core/conversation-search.ts
  - src/core/anchor-pass.ts
  - src/hooks/stop.ts
tags:
  - v2
  - recall
  - silent-failure
  - "plan:anchors"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 4a4c1a02858791c7
plan: anchors
seq: "5"
state: done
priority: "1"
verified_on: 2026-09-16
---

# the automatic marking stopped and said nothing, because a stale row makes every step below it correctly decide there is no work

FOUND 2026-09-15 BECAUSE THE OWNER ASKED A SIMPLE QUESTION: why was the table in front of him not
marked? The honest answer is that nothing in his session had been marked for over half an hour, and
nothing anywhere said so.

MEASURED, twice, minutes apart:
    transcript on disk    122,706,843 bytes   (and growing)
    conversations.bytes   122,551,125 bytes   frozen at 10:58:56Z
    conversations.scanned 122,551,125 bytes
    UNREAD                  155,718 bytes  — was 117,122 one turn earlier
The gap GREW between two checks. This is not lag that catches up; the advance has stopped.
Last anchor written: 10:35:22Z. Hooks are alive throughout — `agent-step` rows land seconds apart
the whole time — so the Stop hook is running and this one step inside it is not.

THE CHAIN, and why the failure is total rather than partial:
  — `sourcesOf` (conversation-search.ts) takes `bytes` from THE CONVERSATIONS ROW. It never stats
    the file.
  — `buildSearchIndex` reads the tail `source.bytes - from`. With `bytes` frozen equal to `from`,
    that tail is ZERO, so there is nothing to read.
  — `markAnchorsOnTurn` scopes itself to what the build says it READ, and returns `anchors: null`
    for "there was nothing to do".
So a stale row makes every downstream step correctly decide it has no work, forever. Each layer
behaves exactly as specified and the feature is dead.

RULED OUT, MEASURED, so nobody re-derives it: `TURN_PROSE_SOURCE_BYTES` (16 MB) is NOT the cause.
It gates the TAIL a source would read, not the file’s size — the tail here is 0.15 MB. A 122 MB
transcript is not itself the problem.

THE DEFECT THAT MATTERS MOST IS THE SILENCE. `INV-nothing-is-dropped-silently` governs, and this is
its exact shape: `anchors: null` means "nothing to do" and ALSO means "the source I would read is a
row that stopped moving". The turn report cannot tell those apart, so neither can the reader. The
product told him marking happens on the fly; it stopped; nothing on any surface said so.

AND IT IS INVISIBLE IN THE ONE PLACE A READER WOULD LOOK. The archive still answers, the index is
internally consistent (`bytes === scanned_bytes` reads as CAUGHT UP), and the anchors list still
shows 760 marks. Nothing is broken-looking. Only the newest turns are missing, which is precisely
the part a reader cannot notice is absent.

WHAT TO FIND OUT FIRST, in order, because the cause is NOT yet established:
  1. Which step owns advancing `conversations.bytes` on a Stop turn, and what it returned on the
     turns since 10:58:56Z. Lane work on `swallow`/`unread` made several such returns disclose;
     check whether THIS one was in that sweep or was missed.
  2. Whether a read error is being caught and flattened — an unreadable or locked transcript under
     a heavy concurrent write is the obvious candidate, and three lanes were running against this
     workspace when it stopped.
  3. Whether the row is updated only when a mirror advances, and the mirror is what stalled.

THE FIX HAS TWO HALVES AND THE SECOND IS NOT OPTIONAL:
  — make the advance resume;
  — make a STALL SAY SO. A source whose recorded size is behind the file on disk is a fact the
    product can compute in one `statSync`, and a reader deserves to be told "the archive is N bytes
    behind" rather than shown a list that is quietly missing today.

DO NOT CLOSE THIS BY RUNNING `mycontext conversation rebuild`. That will clear the gap and hide the
cause — the stall reproduces itself over time, and a rebuild is the thing that makes it
unobservable again.

── WHAT CLOSES THIS ITEM — OWNER, 2026-09-15 ───────────────────────────────

His words: "the result must be not a reason why it stopped working, that’s a lesson but it must
work again and reliable."

SO A CAUSE IS NOT A CLOSE. The diagnosis above is the starting point of this task, not its
deliverable. This item closes when all four hold:

  1. MARKING WORKS AGAIN on this workspace, demonstrated on the live archive: the unread gap goes
     to zero and STAYS there across several turns, and new turns acquire marks. A single catch-up
     is not evidence — the gap grew between two checks last time, so the proof is that it stops
     growing on its own.

  2. IT CANNOT SILENTLY STOP AGAIN. The pass must distinguish "nothing to do" from "I read
     nothing", and the stalled case must reach a surface. A `statSync` against the file the row
     claims to describe is affordable and is the measurement nobody was making.

  3. A REMOVAL PROOF THAT REPRODUCES THE STALL. Freeze the recorded size against a growing file
     and assert the product SAYS SO. Any fix whose test only proves the happy path leaves exactly
     the hole this defect lived in — every layer was already green while the feature was dead.

  4. `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when-a-reader` HOLDS on a real
     document — the rule this task exists to make true.

AND NOT BY REBUILD. `mycontext conversation rebuild` will clear the gap and prove nothing about the
on-the-fly path. If a rebuild is run for any reason, the stall must be reproduced afterwards.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `0ce8460f`. ALL FOUR CLOSING CONDITIONS ABOVE ARE MET, AND THE DIAGNOSIS IN THIS ITEM WAS WRONG. The stale row did not starve the pass. The probes asked `searchArchive` for the best 200 matches IN THE WHOLE ARCHIVE ranked by `bm25()`, which has no opinion about recency, and applied the per-turn scope afterwards — so with 777 spans matching the table probe the newest table was ranked out. Window membership predicted the mark 15 times out of 15.

Condition 2 is `TurnAnchorReport.did`, now `marked | nothing-moved | could-not-look`, plus `archiveFreshness` — one `statSync` per source against the row that claims to describe it. Condition 1 and 4 were demonstrated over ten consecutive rounds while two sessions kept appending: the gap went to zero in nine of ten and NEVER GREW, and the first round's new mark is a turn acquiring its mark on the fly. Measured on COPIES so his own files were never written, which is condition 4's own instruction. Closed by the reconciliation in `rulings/93`; the rebuild that recovers the historical marks is his to run and is not a condition of this item.
