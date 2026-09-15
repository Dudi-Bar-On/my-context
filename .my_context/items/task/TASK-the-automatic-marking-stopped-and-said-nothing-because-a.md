---
id: TASK-the-automatic-marking-stopped-and-said-nothing-because-a
type: task
title: the automatic marking stopped and said nothing, because a stale row makes every step below it correctly decide there is no work
status: active
severity: soft
always: false
summary: Bookmarking stopped silently half an hour ago and kept saying there was nothing to do, because the archive quietly stopped reading new turns.
summary_of: 0b97492b1c4bd19e
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 4d3fe79c92ea9403
plan: anchors
seq: "5"
state: todo
priority: "1"
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
