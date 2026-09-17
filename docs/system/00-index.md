# `docs/system/` — how this actually works

`docs/capabilities/` answers **what can it do**. It is a reference: one chapter per surface, real
command output, a table of flags. It was verified against the working tree on 2026-09-12/13, one
chapter (16, the board) added later, and a repair pass has since re-verified its claims.

This directory answers a different question: **how does this actually work**. Not the flag list —
the mechanism underneath it, the decision that shaped it, and the failure that decision was a
response to. The model is `docs/the-store.he.md`, the one document in this project written this
way before this directory existed: what a thing is and what it is confused with, what it holds
today, how it works, how it is maintained, and — without softening it — what is known to be wrong
with it.

That shape matters more than it looks like it should. A reference chapter can be complete and still
leave a newcomer unable to answer "why does it work like *this* and not the obvious other way." The
answer is almost always a specific measured failure — a regex that matched 4 of 28 mentions and got
one of them wrong, a claim that was acted on for a week before someone measured it and found it
false, a hue that shipped before anyone ruled on it. Reference chapters cite the outcome. These
chapters keep the argument.

## What is here, and why these five

`reports/2026-09-16-the-subjects-of-this-system.md` inventoried 32 subjects and marked, for each,
what documentation exists today. Five had **nothing of the right shape** — not a stale chapter, not
a chapter that needs updating, but no chapter at all, sometimes not even a tutorial:

| Chapter | Subject | What existed before this pass |
|---|---|---|
| [`01-the-board.md`](./01-the-board.md) | How work is chosen: `needs`, `ready`, `path`, the D-numbers | A reference chapter (`docs/capabilities/16-the-board.md`) shipped in the same repair pass this directory belongs to — command syntax and real output live there. This chapter is the part a reference chapter cannot carry: the governance story, and why a newcomer has to understand it before touching anything else here. |
| [`02-the-document-and-lane-viewer.md`](./02-the-document-and-lane-viewer.md) | Rendering a 133 MB transcript: folding, hit highlighting, the find panel, marks in the margin | Three same-week reports. No chapter. |
| [`03-the-palette-and-the-drawn-language.md`](./03-the-palette-and-the-drawn-language.md) | The five-hue meaning budget, chips, icons, generated Mermaid diagrams | A design mockup and browser gates that enforce it. Nothing in prose. |
| [`04-the-audit-log-decay-and-contribution.md`](./04-the-audit-log-decay-and-contribution.md) | What the project records about its own running, and two readings derived from it | Scattered mentions across two chapters and two tutorials. No chapter, no single owner. |
| `05-lessons.md`, `06-ingest.md`, `07-focus.md` | Three small doors: a mistake becomes a candidate rule; a document becomes draft items; a session narrows what it sees | One tutorial each. No chapter. |

Lessons, ingest and focus are three separate short chapters rather than one combined one, on
purpose: the inventory that proposed grouping them as "cheap wins" was grouping them by *size*, and
research for this pass found they are not coupled to each other in the code — no file under
`src/ingest/` imports `focus.ts` or anything under `src/lesson/`, and `focus.ts` imports nothing
from ingest. Filing them under one heading would have implied a pipeline that does not exist. Each
gets its own door, its own failure history, and its own "what's known wrong."

## What is deliberately not repeated here

Per the standing rule of this project — a copy of a fact is the defect this project spent
2026-09-07 measuring — these chapters point at `docs/capabilities/16-the-board.md` for the board's
full command reference and real terminal output rather than re-printing it, and they point at the
relevant corpus items (`DEC-…`, `KNOWN-…`, `TASK-…`) by id rather than quoting their bodies in
full. Fetch an item with `mycontext show <id>` or read it directly under `.my_context/items/`;
citing it here is not a substitute for reading it, and every id below resolves against a real file
in the tree as of the date on this document.

## Every count in every chapter here is a dated reading

The single most-repeated finding in the research behind this directory is that a number copied from
a document is a number that has already started to be wrong. `docs/capabilities/16-the-board.md`
itself carries a correction made the same day it was written — a header the mechanism map called
"200 lines" turned out to be 48 when counted directly. Every command shown in these chapters was
run against the working tree on **2026-09-17**; a reader is meant to re-run it, not trust it.

## See also

- [`docs/the-store.he.md`](../the-store.he.md) — the worked example this directory's shape is
  taken from (Hebrew; the structure, tables and diagrams carry without the language)
- [`docs/capabilities/00-index.md`](../capabilities/00-index.md) — the reference this directory
  complements
- [`reports/2026-09-16-the-subjects-of-this-system.md`](../../reports/2026-09-16-the-subjects-of-this-system.md) —
  the inventory that identified these five gaps
- [`reports/2026-09-16-the-mechanism-map.md`](../../reports/2026-09-16-the-mechanism-map.md) — the
  code-level trace this directory's board, viewer and palette chapters were built from
