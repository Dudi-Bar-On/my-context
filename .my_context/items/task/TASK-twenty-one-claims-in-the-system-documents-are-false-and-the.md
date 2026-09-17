---
id: TASK-twenty-one-claims-in-the-system-documents-are-false-and-the
type: task
title: twenty-one claims in the system documents are false and the four worst are relationships drawn backwards
status: active
severity: soft
always: false
summary: Repair the 21 verified-false claims across docs/system/, re-capture the abridged command output, and fix the three diagram defects.
summary_of: 8be1efc4ef596850
scope:
  - docs/system/**
  - reports/2026-09-17-system-docs-verified.md
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:103"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: a788db7278e4217e
plan: rulings
seq: "103"
state: done
priority: "1"
---

# twenty-one claims in the system documents are false and the four worst are relationships drawn backwards

A VERIFIER CHECKED 297 CLAIMS ACROSS THE EIGHT `docs/system/` CHAPTERS ON 2026-09-17 AND FOUND 21
FALSE. The full list with true values is `reports/2026-09-17-system-docs-verified.md`. The main
session then re-checked SIX of the 21 against the tree directly and all six held, so the report is
evidence and not a claim: take it as the work list.

── THE THREE THINGS THAT MATTER MORE THAN THE COUNT ──────────────────

1. ALL FOUR OF THE WORST ERRORS ARE RELATIONSHIPS READ BACKWARDS, NOT STALE NUMBERS. A line
   citation cannot catch these and every previous pass was shaped around line citations. `01` says
   `status: deprecated` short-circuits BEFORE `state` is read — `needs.ts:490` reads `state`, `:491`
   exits on `done`, and the `deprecated` guard is at `:509`, nineteen lines LATER. `02` says
   `doc.html` AVOIDS a trap that `lane.js:56` says it SETS. `07` says a row is hidden only if it
   fails EVERY axis; `select.ts:631` says "AND across axes, OR within one", so it is ANY — and the
   chapter’s own §5 contradicts its §3. Read each of these as a DIRECTION, not a fact, and check the
   direction in the code.

2. FIVE OF SIX PASTED "REAL OUTPUT" BLOCKS ARE SILENTLY ABRIDGED. The sixth marks its cuts and is
   verbatim — that is the shape all six must have. `04`’s `decay` block drops the 5-line disclosure
   THE SAME CHAPTER QUOTES IN ITS OWN §1; its `contribution` block welds two non-adjacent lines and
   retypes exact integers as `~58000`/`~193`. `05` and `06` cut `--help` text mid-sentence, and `05`
   loses the clause "`lesson-accept` refuses it by name". RE-CAPTURE these by running the command;
   do not repair them by editing. An abridged paste that does not say it is abridged is the exact
   defect `INV-nothing-is-dropped-silently` names.

3. A WRONG ID IS AN UNCITABLE CITATION. `06` cites
   `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write`. The real id is
   `INV-a-validator-that-gates-writes-must-be-a-complete` — the suffix was invented, and
   `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` is what makes that fatal
   rather than untidy. VERIFY EVERY id in all eight chapters against `.my_context/items/`, not only
   this one.

── THE FOUR CONTRAST ROWS ARE ONE ERROR, NOT FOUR ───────────────────

`03`’s whole table pairs the SHIPPED hexes with the RETIRED colours’ ratios. True values on
`--panel`: `#22c55e` **7.84** (not 8.42), `#eab308` **9.31** (not 10.58), `#f97316` **6.37** (not
6.31), `#ef4444` **4.75** (not 7.00). The verifier proved it by reproducing 8.42/10.58/6.31/7.00
exactly from `#7cc0a0`/`#e8c368`/`#c78f3d`/`#e08b8b` — the colours `styles.css:101–110` records as
REPLACED. So the table was computed once, correctly, and then the palette changed underneath it.

AND `#ef4444` AT 4.75 IS THE ONE TO THINK ABOUT RATHER THAN JUST RETYPE: the chapter claimed 7.00
and the truth is 4.75, which clears AA for normal text by 0.25. A number that was comfortable is
now marginal. Say so plainly where the table sits; do not quietly swap the digits.

── THE DIAGRAMS ARE SOUND AND THAT IS WORTH RECORDING ────────────────

THERE ARE 12, NOT 13 — the 13th grep hit is prose at `03:90`. All 12 were extracted with the
product’s own `mermaidBlocks` and parsed in real Mermaid 11.17.2 under headless Chromium, and ALL
12 PARSE. That is the first time any of them has been parsed at all: `DIAGRAM_SOURCES` lists only
the two READMEs, so none of these is generated, committed or gated.

THAT GAP IS THE FINDING. `docs/capabilities/07-restore-and-handover.md:78` ships as a Mermaid error
box today precisely because nothing parses what is not in `DIAGRAM_SOURCES`. Recommend whether
`docs/system/**` and `docs/capabilities/**` should join it and say what it would cost; the owner
decides, not you.

Three diagram defects to fix: `01`’s edge `open_question/blocks → needs.ts` is BACKWARDS (`needs.ts`
never reads `blocks` — zero code references; `questions.ts` imports `needs.ts` and reaches
`ready`/`path` directly, and `check-board.ts`, drawn downstream, never sees questions); the same
diagram is MISSING the edge for `check-board.ts` calling `parseDMap`/`dBoard`, which contradicts
§6’s Tier 1; and `02`’s 63,871,429/27,752 are volatile figures stripped of the date the table
beside them keeps.

── ONE COORDINATION HAZARD, AND IT IS LIVE ───────────────────────

`07`’s diagram is byte-identical to README’s at HEAD, as the chapter claims. README IS BEING
REPAIRED IN THE WORKING TREE RIGHT NOW to add `S --> CONT`, which will falsify that claim within a
commit. Re-check it AFTER the README work lands, and prefer a claim that does not rot: "generated
from the same source" survives an edit; "byte-identical" does not.

── HOW ──────────────────────────────────────────────

REPAIR NEIGHBOURHOODS, NOT LINE ITEMS. A verified claim makes its neighbours look verified, and the
21 are concentrated: `03`’s four are one table, `04`’s three are two pasted blocks. When you fix a
number, read the paragraph around it — the sentence that INTERPRETS a wrong number is usually wrong
too and is not in the list.

`00-index.md` came back CLEAN on 26 claims. Leave it alone unless a repair elsewhere changes what it
points at.
