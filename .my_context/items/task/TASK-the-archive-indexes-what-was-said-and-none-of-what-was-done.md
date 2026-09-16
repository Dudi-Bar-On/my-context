---
id: TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done
type: task
title: the archive indexes what was said and none of what was done, so four fifths of it cannot be searched
status: active
severity: soft
always: false
summary: The tool calls are indexed and the reader can ask for said, ran or both; what a command printed is still out, awaiting the owner's ruling, and so is the screen's half of the switch.
summary_of: a49829745e32227c
summary_was:
  - 2026-09-16 Make the commands you ran searchable, not only the conversation around them.
scope:
  - src/core/conversation-search.ts
  - src/core/conversation-index.ts
  - src/cli/**
  - test/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:10"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 9337c8412c06f0b3
plan: semantic
seq: "10"
state: doing
priority: "1"
---

# the archive indexes what was said and none of what was done, so four fifths of it cannot be searched

THE OWNER, 2026-09-16, on being told only a fraction of a transcript is searchable: "why ?
isn't it a text file ? isn't transcripts text files ? what are the limitations that holds you
from searching everithing in a conversation (remind you it's archived)". Then: "Index the tool
calls".

HE WAS RIGHT THAT THERE IS NO FILE-FORMAT LIMITATION. It was a choice, it was ten lines, and it
is reversed. `reports/2026-09-16-indexing-what-was-done.md` is the record and every number below
is in it.

── WHAT LANDED, 2026-09-16 ──────────────────────────────────────────

`tool_use` is indexed, as a THIRD KIND of span — `'ran'` — beside `'prompt'` and `'answer'`,
which together are WHAT WAS SAID. `toolProseOf` renders the tool's NAME and its arguments as
`key: value` lines, not as JSON: a trigram query matches a contiguous run of characters, and a
path spelled with escaped backslashes inside a raw record is not the path a reader would type.

  - The archive's searchable characters: 13,575,116 -> 43,866,783 (3.2x). 11,554 spans ->
    69,952, of which 58,361 are `ran`.
  - `TOOL_VALUE_CAP` is 2,000 characters PER ARGUMENT, with a visible cut mark. Per argument and
    not per block, because `Write`'s input is `{file_path, content}` and a block cap spends its
    whole budget on the file body and loses the path.
  - ONE RECORD CAN NOW BE TWO SPANS at one byte offset — an answer that also called a tool.
    `hitKey` carries the kind for that reason; without it the new kind is dropped silently and
    the feature half-works while looking like it worked.

THE READER CHOOSES: said / ran / both, one mapping (`kindsOf`), two surfaces.

  - `mycontext conversation search <query> [--sources said|ran|both] [--session] [--agent]
    [--limit] [--json]` — NEW, the first search surface this command has had.
  - `GET /api/conversations/search?sources=...`. `kind=prompt|answer` still narrows within said;
    the two together are refused rather than resolved.

THE DEFAULT IS `said`, so the anchor pass, `retrieval/from-selection.ts`,
`read-model-retrieval.ts` and the document find bar read EXACTLY the rows they read before, with
no edit to any of them. The cost of that default is paid by DISCLOSURE: every answer counts what
the kinds it did not read hold (`TieredSearchResult.elsewhere`), so a zero can never be mistaken
for an answer about the archive.

── MEASURED, BEFORE AND AFTER, ON THE REAL ARCHIVE ──────────────────

    .index.db (live)       101,785,600 -> 323,440,640 bytes
    FTS data, compacted     45,184,285 -> 165,163,462 bytes   3.66x for 3.2x the characters
    full rebuild, prose         16.3 s -> 41.1 s;  the shipped command end to end, 52.8 s
    per-turn incremental      23-29 ms -> 22-38 ms on tails of 10 KB to 283 KB  — UNCHANGED
    query latency (tiered)   9.9-79 ms -> 20-137 ms said;  ran and both are cheaper than said

THE PER-TURN LINE IS THE ONE THAT MATTERS and it is why 2.5x on a full rebuild is affordable:
`turn-refresh-soon.ts` pays the incremental path several times a turn and it did not move.

QUERY LATENCY ROSE BECAUSE `kind` IS AN `UNINDEXED` FTS5 COLUMN — the MATCH scans every span and
the filter is applied after, so six times the spans is six times the scan. A separate FTS table
per kind would remove it; the item directed the `kind` column, so the price is recorded rather
than discovered later. About 7% of the rise is the one extra `countProse` the disclosure costs.

── WHAT IS STILL OUT, AND SAID SO ───────────────────────────────────

`tool_result` (67.0% of this archive's characters) and `thinking` (16.4%) are in NO index at any
scope. `UNINDEXED_BLOCKS` is one definition and both surfaces print it; the CLI names them on
every answer, hit or miss, and the API serves `body.unindexed`.
`conv.doc.matchedFull` — "searched in the N turns of words this transcript has" — is still TRUE,
because `proseSpans` and `findInDocument` both default to `SAID_KINDS`.

── WHAT REMAINS, AND WHY THIS ITEM IS STILL OPEN ────────────────────

  1. THE OWNER'S RULING ON `tool_result`. §7 of the report is the measurement he asked for, as
     characters, projected index bytes and rebuild seconds at five caps. The recommendation
     there is 512 characters, not the 2,048 the item guessed: 2,048 costs more than everything
     else in the index put together, and 512 catches the first screen of almost every command's
     output — the part that says whether it worked — for 80 MB and ~18 s of rebuild. A fourth
     value for the reader's switch is the part a number does not cover.
     `test/core/conversation-tool-index.test.ts` PINS THE ABSENCE, so a lane that switches it on
     without his answer goes red rather than shipping quietly.

  2. THE VIEWER HALF. `findInDocument` takes a `kind` scope and the document screen does not yet
     pass one, and the Conversations search screen has no said/ran/both control — the API
     parameter is there and nothing draws it. Deliberate: `semantic/9` held the browser this
     run, and the screen's sentence about what it searched must change in the same act as the
     scope it searches.

  3. A RECOMMENDATION, NOT A DECISION: a full rebuild roughly DOUBLES the FTS data for content
     it has not changed and never reclaims it — true before this item as well (64.6 MB -> 119.5
     MB for the same 11,554 spans). `optimize` + `VACUUM` costs 5.6 s, takes the post-change
     index from 320 MB to 241 MB, and makes every query 20-40% faster. Whether
     `conversation rebuild` should do it is its own item.
