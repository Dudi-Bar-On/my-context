---
id: TASK-ten-thousand-lines-of-documentation-are-held-by-one-gate
type: task
title: ten thousand lines of documentation are held by one gate that checks grammar and cannot see a reversed arrow
status: active
severity: soft
always: false
summary: Three cheap mechanical gates over docs/ — fence byte-identity across copies, a citation resolver, and item ids — plus pinning the fence floors to the true count.
summary_of: d5f9fe6511d3d68a
scope:
  - test/docs/**
  - scripts/check-cited-items.ts
  - scripts/check-diagrams-parse.ts
  - docs/**
tags:
  - v2
  - docs
  - gates
  - "plan:rulings"
  - "seq:111"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 94e6b85065c84df3
plan: rulings
seq: "111"
state: done
priority: "1"
---

# ten thousand lines of documentation are held by one gate that checks grammar and cannot see a reversed arrow

**TWO INDEPENDENT FINAL CHECKS ON 2026-09-17 REACHED THE SAME CONCLUSION AND IT IS THE REASON THIS
ITEM EXISTS: THE DOCUMENTS ARE HELD BY ALMOST NOTHING.**

    capabilities   234 claims checked   5 wrong   2.1%
    system         196 claims checked   4 wrong   2.0%

The prose is in the best state it has ever been — the rate fell seven-fold and not one direction,
quantifier or edge was found reversed. **That is exactly why the gap matters now**: nothing is
holding that state, and four repair passes proved these documents drift within HOURS. Six figures
drifted in five and a half hours during this campaign, measured and tabulated.

── THE FINDING, WHICH CORRECTED THE MAIN SESSION ─────────────────

**`test/docs/*.test.ts` DOES NOT READ `docs/capabilities/**` OR `docs/system/**` AT ALL.** Every path
literal across all twelve (now thirteen) files opens the two READMEs, `docs/prd.md`, two tutorials
and four superpowers specs. `test/docs/capabilities.test.ts` is about the READMEs’ own
`## What it can do` section — **A NAME COLLISION**, and the main session repeated "the 112 doc tests
hold these chapters" in four commit messages and several replies before a lane proved otherwise.

So the only gate touching them is `check:diagrams`, which calls `mermaid.parse()` and therefore
**HOLDS SHAPE, NOT TRUTH.**

── THE BLIND SPOTS, NAMED CONCRETELY BY BOTH LANES ───────────────

  — **A REVERSED EDGE PARSES.** The campaign’s worst finding was in a perfectly valid fence.
  — **A WRONG EDGE *LABEL* PARSES** — the label is opaque to the parser. One carried an inverted
    quantifier inside a diagram a verifier had just scored 6 of 6 clean.
  — "exactly one of FOUR" parses whether the code has three or four.
  — A cited `file.ts:N` inside a label is never resolved against the file.
  — **NOTHING COMPARES TWO SECTIONS OF ONE CHAPTER.** Four findings were a chapter contradicting
    itself, and every one of them is green everywhere else.
  — **NOTHING COMPARES TWO DOCUMENTS’ COPIES OF ONE FENCE.** Five fences exist in two or three copies
    and are asserted byte-identical in prose; edit one copy and the gate still says all parse.
  — A fence disagreeing with its own caption.
  — Anything about RENDERING, since the gate draws nothing — including
    `01-items-and-corpus.md:35`’s `linkStyle 3,4`, an ORDINAL that will silently colour the wrong
    edges the day an edge is inserted above it.
  — A stale count is not a parse error.
  — `check-cited-items.ts` never walks `docs/` (filed separately) and exits 0 anyway.

**BETWEEN THEM THE TWO GATES WOULD HAVE CAUGHT NONE OF THE NINE FINAL FINDINGS, NONE OF THE 28
DIAGRAM CLAIMS, AND NONE OF THE 15 A REPAIR WROTE.**

── WHAT TO BUILD — ROUGHLY SIXTY LINES, NOT ANOTHER READING PASS ────

Both lanes costed these and ranked them the same way. **Build them in this order; each is
independently useful and none needs a browser.**

1. **FENCE BYTE-IDENTITY ACROSS COPIES** — the cheapest closure in either report, ~15 lines in
   `test/docs/`. Five fences live in 2–3 copies across `README.md`, `docs/capabilities/02-injection.md`
   and `docs/system/07-focus.md`, asserted identical in PROSE — a claim that has now ROTTED THREE
   TIMES in three different spellings ("byte-identical", then a provenance claim that stayed true
   while the picture silently stopped matching). **A prose claim of that shape cannot survive; the
   gate should own it.** Use the product’s own `mermaidBlocks` extractor, no Chromium.

2. **A CITATION RESOLVER OVER `docs/`** — every `file.ts:N` in the documents, checked against the
   file. One lane built one AS A THROWAWAY during the repair **and it found nine unlisted errors**,
   then discarded it. Rebuild it as a gate.

3. **POINT `check-cited-items.ts` AT `docs/`** — its `SOURCE_ROOTS` omits it entirely, so every item
   id in 25 chapters and both READMEs is unchecked. **EXPECT A BACKLOG: report what it finds before
   repairing any of it.** A gate turned on and immediately silenced by a hasty sweep is worth less
   than one turned on with its findings written down. And mind the two ids DELIBERATELY truncated
   with a visible `…` inside diagram labels — correct and stated, because a visible ellipsis claims
   nothing while an invented suffix looks complete.

── AND ONE NUMBER THAT IS ALREADY WRONG ──────────────────────

`FENCE_FLOOR`/`FILE_FLOOR` in `scripts/check-diagrams-parse.ts` exist so that a document moving out
from under the sweep cannot pass green with nothing to check. **They are pinned below the true count
while the Hebrew edition lands in two lanes.** Once both are committed, RE-RUN THE GATE AND PIN THE
REAL NUMBERS — do not take either lane’s figure, because neither could see the other’s uncommitted
work. A floor that is quietly behind is the failure the floor was built to prevent.

── WHAT NOT TO DO ────────────────────────────────────

**DO NOT BUILD A GATE THAT RE-READS THE PROSE FOR TRUTH.** Both lanes recommended stopping the
reading passes, and the owner ruled the same way: *"i do not want to continue mess with this."*
These three gates catch MECHANICAL drift — a copy that stopped matching, a citation that stopped
resolving, an id that stopped existing. Semantic truth is what the write-time discipline is for,
and that discipline measurably worked.

**EVERY GATE PROVES IT CAN GO RED BEFORE IT IS TRUSTED.** `check:diagrams` runs its red proof on
every single run, and the Hebrew parity gate was proved with an injected retyped byte, a deleted
edge and a demoted heading. That is the standard here, and this repository has already shipped one
harness that printed "baseline matches the pin" without ever running a test (`19939273`).
