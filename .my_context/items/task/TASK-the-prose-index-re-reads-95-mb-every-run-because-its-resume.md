---
id: TASK-the-prose-index-re-reads-95-mb-every-run-because-its-resume
type: task
title: the prose index re-reads 95 MB every run because its resume point runs past the archive row
status: active
severity: soft
always: false
summary: "Refreshing the conversation search index costs nothing when nothing has changed: the walk now stops where the archive itself stopped, turning a hundred-megabyte re-read on every run into no reading at all."
summary_of: 392db2d4c79ea420
summary_was:
  - 2026-09-11 Refreshing the conversation search index costs two seconds and a hundred megabytes every time instead of almost nothing, because it remembers a position slightly ahead of the one it compares against.
acknowledged:
  - task_unverified@6a5a1d76c0376ada
scope:
  - src/core/conversation-search.ts
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:4"
  - "state:done"
  - perf
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/skew-body.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 0e19e1619bd9cc04
plan: recall
seq: "4"
state: done
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

> CLOSED 2026-09-11. The repair is one clamp in `buildSearchIndex`: the walk's budget is
> `Math.max(0, Math.min(appendable ? cap - from : cap, source.bytes - from))`, so it stops at
> the archive row instead of at the true end of file. The proposed `cap: Math.min(cap,
> source.bytes - from)` was right in substance; it needed the `appendable` arm of the existing
> expression kept, and a floor at 0 for a transcript shorter than its row.
>
> MEASURED BEFORE AND AFTER, the same way both times - four consecutive `buildSearchIndex`
> runs against a `VACUUM INTO` snapshot of `.my_context/.index.db`, whose rows point at the
> real transcripts, so his index was never written to. 316 sources.
>
>   before  run 2  bytesRead 103,345,406  ms 2,066   (5 live transcripts re-read WHOLE)
>   before  run 3  bytesRead 103,347,979  ms 2,060
>   after   run 2  bytesRead           0  ms     4   (316 skipped)
>   after   run 3  bytesRead           0  ms     3
>
> An index ALREADY in the skewed state heals in one run: 102,500,659 bytes and 3,909 ms once,
> then 0 bytes and 6 ms. A real append, after the archive scan caught up, cost 1,594,380 bytes
> and 24 ms.
>
> WHAT IS PINNED: two tests in `test/core/conversation-search.test.ts`, both asserting BYTES
> READ and never elapsed time. One grows a transcript after the archive scanned it and requires
> the prose row to come out level with the archive row and the next run to be a skip reading 0
> bytes - and requires the deferred tail to be indexed once the archive does scan it, so the
> clamp defers rather than drops. The other seeds a prose row already ahead, the state every
> existing workspace is in, and requires one re-read and then a skip. Ten removal proofs, one
> per assertion, all red at their own line.
>
> THE STOP HOOK WAS NOT MOVED, and the recommendation is to wait: this index is now 4 ms and
> 0 bytes a turn and would be affordable there, but the same measurement found
> `TASK-the-archive-s-own-scan-re-reads-96-mb-on-every-turn-for-the` - the scan that hook
> ALREADY runs costs 96.7 MB and 421 ms a turn, for the same class of skew one layer down.
