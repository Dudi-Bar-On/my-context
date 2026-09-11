---
id: TASK-the-archive-s-own-scan-re-reads-96-mb-on-every-turn-for-the
type: task
title: the archive's own scan re-reads 96 MB on every turn, for the same reason the prose index did
status: active
severity: soft
always: false
summary: About one assistant turn in three re-read the whole live transcript, because the size the scan recorded and the point it actually reached were taken a moment apart; the read now stops where the size says, and the rest waits for the next turn.
summary_of: 3c4a887ce97a1342
summary_was:
  - 2026-09-11 Every assistant turn re-reads the whole live transcript — a hundred megabytes — because the scan records reaching further than the size it noted a moment earlier, and never recovers.
scope:
  - src/core/conversation-index.ts
tags:
  - v2
  - recall
  - perf
  - archive
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/archive-skew-body.md"
source_anchor: null
source_checksum: 199abfac0d3ee1cf
valid_from: 2026-09-11
valid_until: null
checksum: 2f7fd97adae348e1
state: done
verified_on: 2026-09-11
---

# the archive's own scan re-reads 96 MB on every turn, for the same reason the prose index did

> > MEASURED 2026-09-11 on this workspace, on the live archive, by the lane that closed
> > `TASK-the-prose-index-re-reads-95-mb-every-run-because-its-resume`. It is the SAME defect
> > one layer down, in the scan the Stop hook runs on every assistant turn.
> >
> > THE NUMBER. `rebuildConversations` re-reads the owner's whole live session transcript —
> > 96,689,033 bytes, 421 ms for the run — on every turn in which that transcript has grown,
> > which is every turn. With the one row levelled it reads 5,967 bytes and the run takes 80 ms.
> > Measured the same way both times, on a `VACUUM INTO` snapshot of `.my_context/.index.db`
> > whose rows point at the real transcripts, so nothing was written to his index:
> >
> >   as it stands           sessions bytesRead 96,689,033   scanned 1   ms 421
> >   scanned_bytes levelled sessions bytesRead      5,967   scanned 0   ms  80
> >
> > WHY. The row's `bytes` is the size from the DIRECTORY LISTING's stat; its `scanned_bytes` is
> > where the read that followed actually reached. A transcript being appended to grows between
> > the two, so the read reaches PAST the stat and the row is written with
> > `scanned_bytes > bytes`. Condition 2 of the append-only path is
> > `previous.scannedBytes === previous.bytes` — a guard against a row capped at
> > `MAX_SCAN_BYTES`, which is the case it was written for — and a scan-ahead row fails it, so
> > the session falls to a whole re-read, which re-creates the skew. It never heals. The live
> > row today:
> >
> >   595db3b1-a481   bytes 96,683,066   scanned_bytes 96,683,780   on disk 96,689,033
> >
> > 714 bytes of skew buying a 96.7 MB read, every turn, for ever. Of 314 subagent rows, 0 were
> > scan-ahead when measured — the session transcript is the one that grows while it is being
> > scanned.
> >
> > WHERE IT IS PAID. `stopConversationRefresh` in `src/hooks/stop.ts` runs
> > `rebuildConversations` once per assistant turn (lanes excepted — it returns `null` when
> > `agent_id` is set). So this is not a cost on a command somebody typed; it is on the turn.
> >
> > THE LIKELY REPAIR, and it is NOT yet tested — the lane that measured this was scoped to
> > `conversation-search.ts` and did not touch the scan. Either record `bytes` as the position
> > the scan reached rather than the earlier stat, or clamp the read to the stat the way
> > `buildSearchIndex` now clamps to the row. `truncatedScan` is `scannedBytes < bytes` and must
> > keep meaning what it means, so whichever is chosen has to keep a genuinely capped scan
> > reporting itself as short.
> >
> > WHAT IT BLOCKS. It is the standing argument about what the Stop hook may carry. The prose
> > index is now 4 ms and 0 bytes in steady state and would be affordable there; this scan is
> > 421 ms and 96.7 MB and is already there. Any decision about adding to that hook should be
> > taken after this, not before.

## Relations
- discovered_by [[TASK-the-prose-index-re-reads-95-mb-every-run-because-its-resume]]
