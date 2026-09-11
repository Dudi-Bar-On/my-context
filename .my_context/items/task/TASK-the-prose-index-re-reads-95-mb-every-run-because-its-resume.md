---
id: TASK-the-prose-index-re-reads-95-mb-every-run-because-its-resume
type: task
title: the prose index re-reads 95 MB every run because its resume point runs past the archive row
status: active
severity: soft
always: false
summary: Refreshing the conversation search index costs two seconds and a hundred megabytes every time instead of almost nothing, because it remembers a position slightly ahead of the one it compares against.
summary_of: 70750c759c12ccf3
scope:
  - src/core/conversation-search.ts
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:4"
  - "state:todo"
  - perf
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/skew-body.md"
source_anchor: null
source_checksum: 17f2f030f51876e9
valid_from: 2026-09-11
valid_until: null
checksum: 89dc846ce5ef4f7d
plan: recall
seq: "4"
state: todo
priority: "1"
---

# the prose index re-reads 95 MB every run because its resume point runs past the archive row

> MEASURED 2026-09-11 on this workspace, on the live archive, by the lane that wired
> `buildSearchIndex` up for the first time.
>
> THE NUMBER. Steady state - nothing appended, nothing changed - costs 1.8-2.1 s and reads
> 95.7 MB, every single run. The module's own header says an unchanged transcript should cost
> one comparison and a grown one should cost its TAIL. Three transcripts fall to a WHOLE
> re-read instead, for ever, and they are exactly the three that are alive.
>
> WHY. `buildSearchIndex` writes `prose_sources.bytes = from + walked.bytesRead` - where the
> walk actually REACHED, which is the true end of file at the moment it read. The freshness
> comparison next run reads `source.bytes` from the `conversations` / `subagents` ROW, which is
> where the ARCHIVE's own scan reached. A live transcript grows between the archive scan and
> the prose walk, so `prose_sources.bytes` ends up LARGER than the row:
>
>   595db3b1-a48   prose 94,427,863   row 94,425,015   on disk 94,427,863
>   agent-a23525   prose    692,589   row    533,361   on disk    718,706
>   agent-a62208   prose    574,470   row    343,537   on disk    594,715
>
> After that, `source.bytes > previous.bytes` is FALSE, so `appendable` is false, so the source
> is dropped and re-read whole - and the same skew is re-created on every run. It never heals.
>
> THE REPAIR, and it is two lines in `src/core/conversation-search.ts`: clamp the walk to the
> row the archive actually holds, `cap: Math.min(cap, source.bytes - from)`, so the prose index
> can never run ahead of the row that is its source of truth for what the archive has read.
> `sourcesOf`'s own header already says a transcript the archive has not scanned is not part of
> the archive yet; this makes the walk obey it. The row's byte count is a line boundary in
> practice because the harness appends whole lines, and anything else falls to the whole re-read
> that is always correct.
>
> PROVED BY SIMULATION rather than argued: setting `prose_sources.bytes` back to the row's own
> count for those three sources turned the next three runs into 307 skipped, 0 bytes read, 3-6 ms.
> A real 256 KB append then cost 26 ms.
>
> WHAT IT UNBLOCKS. `plan:recall seq:1` deliberately wired the prose index and the automatic
> anchor pass into `mycontext conversation rebuild` - a command a person types - and NOT into
> `hooks/stop.ts`, because two seconds a turn is not a cost to take on a reader's behalf in
> silence. With this repaired the per-turn cost is a few milliseconds and the hook is the right
> home: the viewer's search would then never be stale, instead of being stale and saying so.
>
> NOT FIXED BY THAT LANE because `src/core/**` was fenced to a concurrent lane for the whole of
> its work.
