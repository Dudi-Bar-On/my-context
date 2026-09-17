---
id: TASK-fourteen-documents-cite-seven-retired-items-and-thirteen-of
type: task
title: fourteen documents cite seven retired items, and thirteen of those citations read as a live ruling
status: active
severity: soft
always: false
summary: Repoint or disclose twenty citations of retired items across both language editions, and decide what replaced the two that have no recorded successor.
summary_of: 0ee12ccdd5088539
scope:
  - docs/capabilities/**
  - docs/system/**
  - src/cli/commands/repair.ts
  - scripts/repair-openq-filters.ts
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:115"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 9795263ac1b584f5
plan: rulings
seq: "115"
state: todo
priority: "1"
---

# fourteen documents cite seven retired items, and thirteen of those citations read as a live ruling

**THE FIRST RUN OF A GATE THAT HAD NEVER LOOKED AT `docs/` FOUND TWENTY SITES ACROSS FOURTEEN
DOCUMENTS NAMING SEVEN RETIRED ITEMS, AND THIRTEEN OF THEM READ AS A LIVE RULING.** Surfaced by
`rulings/111` (`201ed69c`), listed and deliberately NOT repaired — that lane was told to hand the
findings over rather than silence its own gate.

Reproduce with `node scripts/check-cited-items.ts`; every site is printed with its file, line, and
whether it reads as LIVE.

── WHY THIS IS NOT TIDYING ──────────────────────────────

A retired item EXISTS — it has a file, a status and an edge naming what replaced it. So a document
citing one is not broken; **it is telling a reader to follow a ruling this corpus has already
superseded, in a voice that sounds current.** That is worse than a dangling reference, which at
least announces itself.

And `retired` is not `absent`: `TASK-code-and-tests-that-speak-with-a-retired-item-s-authority` is
this project’s own ruling on the conflation. This item is that defect, in the documents.

── THE SEVEN, WITH THEIR SUCCESSORS ─────────────────────────

  1. `OPENQ-how-do-filters-respect-dependencies`
     → `DEC-focus-discloses-and-allows-rather-than-refusing-to-hide`, then
       `DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always`
     LIVE at `docs/capabilities/03-creation-and-gates.md:401` and `.he.md:424`.
     **AND IN CODE**, which the lane’s table did not cover and the main session confirmed:
     `scripts/repair-openq-filters.ts:2` and `src/cli/commands/repair.ts:62` also read as LIVE.
  2. `RULE-search-may-rank-its-results-and-the-model-it-asks-is-the`
     → `RULE-search-may-rank-its-results-and-semantic-search-is-not`
     LIVE at `14-search-over-the-archive.md:251` and `.he.md:310`.
  3. `REF-the-wave-map-what-order-the-work-is-being-done-in` — **NO SUCCESSOR RECORDED.**
     LIVE at `docs/system/01-the-board.md:290`, `.he.md:332`, `16-the-board.he.md:255`;
     correctly DISCLOSED at `16-the-board.md:219`, which is the shape the others should take.
  4. `LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it`
     → `DEC-moved-commit-with-a-pathspec`. LIVE at `10-rule-store.md:350`, `.he.md:749`.
  5. `KNOWN-a-focus-silently-overrides-always-true-so-a-pinned-item` — **NO SUCCESSOR RECORDED.**
     LIVE at `docs/system/07-focus.md:224`, `.he.md:301`; disclosed at `.md:185`, `.he.md:249`.
  6. `RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus`
     → `DEC-moved-an-unknown-category-means-a-possible-wrong-corpus`.
     LIVE at `10-rule-store.md:331`, `.he.md:717`.
  7. `OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items`
     → `TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing`.
     Four sites, ALL INSIDE FENCED BLOCKS — quoted evidence, not live. **LEAVE THESE ALONE.**

── THE TWO THAT NEED A DECISION RATHER THAN AN EDIT ──────────────

**#3 AND #5 HAVE NO RECORDED SUCCESSOR.** You cannot repoint a citation at nothing. For each,
establish what actually replaced it — or that nothing did — and say which in the document. **"This
was retired on <date> and nothing replaced it"** is a true, useful sentence; silently deleting the
reference loses the fact that the question was once asked and settled.

And note #3 and #5 are each ALREADY DISCLOSED CORRECTLY somewhere in the same document set
(`16-the-board.md:219`, `07-focus.md:185`). **Read those first: the document already contains the
sentence the other sites need.**

── THE THING MOST LIKELY TO BE GOT WRONG ─────────────────────

**THE HEBREW MIRROR DOUBLES EVERY ONE OF THESE.** Repairing the English chapter alone leaves the
Hebrew reader following the retired ruling, and the parity gates will not catch it — they assert
STRUCTURE, not which id a sentence names. Fix each pair in one change.

And a repair here is a WRITING pass, which this campaign measured three times: repairing 38 claims
produced 21 new ones, 28 produced 15, 21 produced 15. **Read the code behind every sentence you
touch, including ones you are only rephrasing.** The discipline that ended the loop took the rate to
2.0–2.1%.

── CONSTRAINTS ────────────────────────────────────────

  — `node scripts/check-cited-items.ts` is the measurement. Run it before and after and put both
    numbers in the report. It is deliberately in NEITHER CI workflow — its own owner ruling, that
    nothing it finds can fail a run — so the number moves only because someone looked.
  — **DO NOT ADD AN EXEMPTION TO MAKE THE COUNT FALL.** The two visibly-truncated ids and the
    over-long id one chapter quotes AS the defect it describes already pass with no exemption
    written, and that is the standard.
  — `npm run check:diagrams` (68 fences) and `test/docs/*.test.ts` (162 with the script tests) must
    stay green.
  — RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE.
