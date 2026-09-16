---
id: TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done
type: task
title: the archive indexes what was said and none of what was done, so four fifths of it cannot be searched
status: active
severity: soft
always: false
summary: Make the commands you ran searchable, not only the conversation around them.
summary_of: c977f5ad38b9bc8c
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 18f822d2dba4690c
plan: semantic
seq: "10"
state: todo
priority: "1"
---

# the archive indexes what was said and none of what was done, so four fifths of it cannot be searched

THE OWNER, 2026-09-16, on being told only a fraction of a transcript is searchable: "why ?
isn’t it a text file ? isn’t transcripts text files ? what are the limitations that holds you
from searching everithing in a conversation (remind you it’s archived)". Then: "Index the tool
calls".

HE IS RIGHT THAT THERE IS NO FILE-FORMAT LIMITATION. It is a choice, and it is about ten lines:
`proseOf` in `src/core/conversation-search.ts` returns `message.content` when it is a string,
and otherwise only the blocks whose `type === "text"`. Everything else is dropped on the floor.

MEASURED ACROSS THE WHOLE ARCHIVE, 2026-09-16 — 1,086 transcripts, 465,677 records, 2.28 GB:

    tool_result   507,619,215 chars   78.9%    what every command PRINTED
    tool_use      106,728,078 chars   16.6%    the commands, paths and arguments
    text           29,301,746 chars    4.6%    what he and Claude SAID — the only part indexed

And what the index costs today: `.index.db` is 101,785,600 bytes, of which
`conversation_prose_data` is 64,512,482 bytes for 13,551,441 indexed characters — **about 4.8
bytes of index per character.** Every projection below rests on that ratio; re-measure it rather
than trusting it if your shape differs.

── WHAT TO BUILD, AND WHAT DELIBERATELY NOT TO ─────────────────────

INDEX `tool_use` — the commands, the file paths, the arguments. 3.6x the text that is indexed
now, and it is what answers "what command did I run", "which file did I touch", "when did I last
run that script". That is this item.

DO NOT INDEX `tool_result` UNCAPPED. It is 17x on its own and it is overwhelmingly file dumps
and test output. MEASURE A CAPPED VARIANT instead — the first ~2 KB of each result catches the
head of almost every output for a fraction of the cost — and REPORT the numbers so the owner can
rule on it. Do not ship it in this item without his answer.

── THE THING THAT DECIDES WHETHER THIS IS AN IMPROVEMENT ────────────────

A SEARCH THAT RETURNS EVERYTHING IS NOT BETTER THAN ONE THAT RETURNS TOO LITTLE. Adding 3.6x the
text will drown a prose query in command noise unless the reader can say WHICH KIND he wants.
The span row already carries a `kind` column — use it, and give both surfaces a way to ask for
said / ran / both. Whether that is a filter, a facet or a tier is yours; that it exists is not.

AND SAY WHAT IS STILL NOT SEARCHABLE. `INV-nothing-is-dropped-silently`. The screen now prints
"searched in the N turns of words this transcript has, out of M records" — that sentence has to
stay TRUE after this change, and it is the model for disclosing whatever remains out.

── MEASURE BEFORE AND AFTER, ON THE REAL ARCHIVE ────────────────────

  — `.index.db` on disk, and the FTS data within it.
  — A FULL REBUILD’s wall time. `conversation rebuild` is run by hand and by the Stop hook; if
    this makes it minutes, that is a finding the owner needs before it ships.
  — THE PER-TURN COST. The refresh now also runs mid-turn from `PostToolUse`
    (`src/core/turn-refresh-soon.ts`), so an incremental scan that gets slower is paid several
    times per turn, not once.
  — QUERY LATENCY on a real query, before and after.

NO BROWSER THIS RUN — another lane holds it. Core, CLI and measurement only; the viewer half
comes after, with his answer about `tool_result` in hand.
