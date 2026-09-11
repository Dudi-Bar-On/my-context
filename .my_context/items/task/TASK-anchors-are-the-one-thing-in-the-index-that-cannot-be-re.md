---
id: TASK-anchors-are-the-one-thing-in-the-index-that-cannot-be-re
type: task
title: anchors are the one thing in the index that cannot be re-derived
status: active
severity: soft
always: false
summary: The 565 conversation bookmarks now live in a plain file that survives the database being deleted, and the one he marked by hand was carried across automatically.
summary_of: 04173c1a95baf31e
summary_was:
  - "2026-09-11 Make the 565 bookmarks durable: the file is the truth, the anchors table is rebuilt from it, and deleting the index loses nothing."
scope:
  - src/core/anchor-file.ts
  - src/core/anchors.ts
  - src/core/conversation-index.ts
  - src/cli/commands/conversation.ts
  - src/hooks/stop.ts
  - test/core/anchor-durability.test.ts
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:6"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/item-body.md"
source_anchor: null
source_checksum: 4c8c4def1164644c
valid_from: 2026-09-11
valid_until: null
checksum: 70c8b3068b20c572
plan: recall
seq: "6"
state: done
priority: "1"
---

# anchors are the one thing in the index that cannot be re-derived

> Anchors landed in the `anchors` table inside `.my_context/.index.db`, and that file
> is gitignored, disposable, and defined as rebuildable: the shape IS the version,
> delete it and it comes back. Everything else in it does come back -- conversations
> and lanes from the transcripts, prose from the transcripts, items from Markdown.
>
> **Anchors are the one thing in that database that cannot be re-derived from
> anything.** They survive a REBUILD, which is asserted, and nothing brings them
> back if the FILE goes. There are 565 of them today, one of which he marked by
> hand.
>
> ## The objection, and the measurement that answered it
>
> He asked whether moving them to a plain file would lose database capability and
> performance, and why not a second SQLite database. Measured on his own 565 rows,
> 2026-09-11:
>
> ```
>                      565 (today)   10,000    100,000
> SQLite list all         1.5 ms      ~same     ~same
> SQLite label search     0.3 ms      ~same     ~same
> JSONL read + parse      2.0 ms     15.6 ms    185 ms
> JSONL list all sorted   2.7 ms     41.0 ms    444 ms
> JSONL label search      1.8 ms     26.8 ms    153 ms
> in-memory filter only   0.013 ms    0.33 ms    3.3 ms
> ```
>
> ## His ruling: "file as truth, go with it"
>
> **The file is the truth; the `anchors` table stays exactly as it is and is
> rebuilt from the file** -- the same relationship Markdown items already have with
> the index. Querying does not change at all, because queries still hit SQLite. The
> file is written when an anchor is marked or dropped, and read on rebuild. No
> caller learns where the truth lives.
>
> A second SQLite database was considered and DECLINED: it would be this project's
> first non-disposable database, a category of state nothing else here has, and one
> that can corrupt with no way back. Every durable thing in this repository is a
> file -- `state/`, `delivered.jsonl`, the revision log, `.staging/*.json`.
>
> ## What that costs, and what it does not
>
> The table keeps its shape and its speed, so `putAnchor`, `anchorsFor`,
> `allAnchors`, `searchAnchors`, `unmarkAnchor`, `resolveAnchor` and `anchorIdFor`
> are untouched at the call site. The file is paid for only on a WRITE and on an
> OPEN, never on a query.
>
> ## The things that must be true
>
> - The file lives under `.my_context/` and is GITIGNORED: a label quotes
>   conversation text -- the automatic pass labels rulings with corpus ids and
>   tables with their header cells -- and conversation content stays out of git.
> - **The 565 that exist only in his live index must end up in the file**, without
>   him running anything. A table with rows and no file yet produces a file with
>   every row, the hand-marked one included, and that is asserted by `origin` and
>   not by count.
> - Deleting `.index.db` loses nothing: the rebuild re-derives the table from the
>   file the way it re-derives items from Markdown.
> - A half-written file must be impossible. Write-then-rename, as
>   `restore-store.ts` and the staging writer do.
> - The file's SHAPE is chosen with a reason. Two precedents differ:
>   `revision-log.ts` is append-only with `foldLog`, and `.staging/*.json` and
>   `state/` are rewritten documents. The automatic sweep relabels hundreds at
>   once (345 in the last run) and takes some back, and no history of a bookmark
>   is wanted -- so the rewritten document is the shape, in the JSONL encoding the
>   measurement above was taken against.
