# my_context — working notes for agents

**This file is a POINTER, not a copy.**

Everything that governs this project lives in the corpus under `.my_context/`
and is injected at session start by this project's own hooks. That is the
mechanism, and this repository dogfoods it: if a rule matters, it is an item,
and the item is delivered.

**So do not restate a rule here.** A second copy of a rule is the exact defect
this project spent 2026-09-07 measuring — two boards each claiming to be the
single place, two comment blocks in `e2e/app.ts` asserting opposite things about
which corpus it uses, and five superseded instructions being acted on as current
because a document repeated one after it had been reversed. A copy cannot be
superseded; only the original can. **Name the item; do not quote it.**

## What is already in your context

The injection at session start delivers the governing items in full, and lists
the rest as an index. If something you need arrived as a title only, fetch it
with `get_item` (MCP) or `mycontext show <id>` rather than guessing.

## The one thing most easily forgotten, because it happens while writing tests

`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` is pinned and
is delivered every session. Read it there. In one line: **a test declares what
it rests on, and `none` with a reason is a legal answer.**

It is here as a pointer because it applies at a moment — writing a test — when
nobody is reading the corpus.

## Finding what is open

`mycontext ready [--plan <p>] [--held]` computes what is dispatchable from the
corpus' own `needs:` fields. It cannot go stale, because nobody keeps it by
hand. `reports/EXECUTION-BOARD.md` was retired on 2026-09-07 for precisely that
reason, and `reports/V2-HANDOVER.md` is the narrative.

**Cite an item by id, never a report by line number** —
`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`. The
handover is prepended to, so every line number in it moves on the next write.
