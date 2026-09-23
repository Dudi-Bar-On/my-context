---
id: TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan
type: task
title: a scanner enumerates what it will skip, not what it will scan, at eighteen sites found by three reviews
status: active
severity: soft
always: false
summary: A scanner lists what it will skip instead of what it will scan, at a number of places this item states too confidently; the work is untouched.
summary_of: 703c8b16f118eea7
summary_was:
  - 2026-09-16 Checks across the project list the cases they know about and wave everything else through, so the input nobody thought of is the one that is never checked.
scope:
  - scripts/**
  - src/core/**
  - src/doctor/**
tags:
  - v2
  - gates
  - fail-open
  - type-design
  - "plan:rulings"
  - "seq:85"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 46adef8d68933a4a
plan: rulings
seq: "85"
state: doing
priority: "1"
---

# a scanner enumerates what it will skip, not what it will scan, at eighteen sites found by three reviews

FOUND BY THREE REVIEWS AS ONE CLASS, which is the strongest evidence in the consolidation. Reports 3, 4 and 6 arrived at it from three different directions and could not see each other:

- Report 3 named it as pattern P4 with six members.
- Report 4 showed the compiler was READY -- the union exists and the table is total -- and a cast walked past it, and found `INVERSE_RELATIONS` failing open on a WRITE gate.
- Report 6 found eleven more sites: `check-text-files.ts` skips `.tsx`, `.jsonl`, `.svg` and every file at the repository root; `check-retired.ts` skips `reports/` and `README.md`; `scopePolicyFor` hands an undeclared category the permissive default.

Row 15 of `reports/2026-09-13-the-consolidated-findings.md`.

THE RULE THE THREE REPORTS CONVERGE ON, and the reason this is one item rather than eighteen: A SCANNER ENUMERATES WHAT IT WILL SKIP, NOT WHAT IT WILL SCAN. Every member of the class is the same mistake -- a list of the cases the code knows about, and a default branch that lets everything else through as benign.

THE CONSEQUENCE. A gate that exists to stop something answers "no problem" for precisely the input nobody anticipated, which is the input that needed a gate.

THIS IS THE SUBJECT D64 NAMES -- the class, not the case. The `status` cast member is closed at `rulings/69`; these are the rest.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN a9ffa990 — untouched; that commit corrected this item's COUNT and did none of its work

THE COUNT IN THIS ITEM MUST NOT BE QUOTED AS MEASURED. The audit in that commit re-measured it: this says "eighteen sites" where at most seventeen are findable, and the body names six. The CLASS is real and the number is not.

Nothing else in that commit touched this work — it filed eleven items and wrote a report.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.
