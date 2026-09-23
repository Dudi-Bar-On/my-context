---
id: TASK-a-corrupt-or-locked-archive-index-makes-every-retrieval
type: task
title: a corrupt or locked archive index makes every retrieval mission answer no material
status: active
severity: soft
always: false
summary: When the archive cannot be opened, the screen says it holds nothing about this instead of saying it could not look.
summary_of: 6651584d7d46abaa
scope:
  - src/ui/**
tags:
  - v2
  - core
  - silent-failure
  - "plan:swallow"
  - "seq:13"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 7c369d64fbed9de7
plan: swallow
seq: "13"
state: done
priority: "2"
---

# a corrupt or locked archive index makes every retrieval mission answer no material

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) raised it as M17. `reports/2026-09-13-the-consolidated-findings.md` carried M5-M16, M18, M19 and M21-M25 into rows and CARRIED NO ROW FOR M17 - the string "M17" does not appear in that file. So no D number, no plan and no item ever received it. Found 2026-09-15 by the audit at `rulings/90`.

WHAT REPORT 3 MEASURED, quoted rather than paraphrased: "A corrupt or locked index makes every retrieval mission answer no material. `src/ui/read-model-retrieval.ts:343-348` catches everything, where the sibling route `read-model-conversations.ts:2046-2056` narrows on `instanceof` and rethrows the rest. `openReadOnlyChecked` throws four distinguishable things; one of them is genuinely empty and three are faults. Size: one-line."

WHY IT BELONGS TO D66 AND NOT SOMEWHERE ELSE. This is pattern P1 exactly - a catch wider than the case it argues - and the sibling route one directory over already does it the right way, which is what makes it an inconsistency rather than an unknown.

WHAT MAKES IT WORSE THAN AN ORDINARY SWALLOW. The answer it produces is a CLAIM ABOUT THE ARCHIVE: a retrieval mission reports that nothing in the conversation record bears on the subject. A reader who believes it stops looking. That is the same shape as `searchArchive` in row 36 and it is on the newest surface in the product.

VERIFY BEFORE FIXING: the line numbers are report 3 line numbers as of 2026-09-12 and the file has moved since. Find the catch by its shape, not by its line.
