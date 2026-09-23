---
id: TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where
type: task
title: the restore tier drops snapshot ids with no disclosure, where the carry tier names every one of its drops
status: active
severity: soft
always: false
summary: After a compaction, items that could not be restored are dropped without a word, while the other half of the same mechanism explains every drop it makes.
summary_of: 663b461a0c59a693
scope:
  - src/core/**
tags:
  - v2
  - core
  - silent-failure
  - "plan:swallow"
  - "seq:14"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: b4fbce1634a05349
plan: swallow
seq: "14"
state: doing
priority: "2"
---

# the restore tier drops snapshot ids with no disclosure, where the carry tier names every one of its drops

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) raised it as M20. `reports/2026-09-13-the-consolidated-findings.md` carries no row for it - the string "M20" does not appear in that file - so no D number, no plan and no item ever received it. Found 2026-09-15 by the audit at `rulings/90`.

WHAT REPORT 3 MEASURED, quoted: "The restore tier drops snapshot ids with no disclosure, while the carry tier names every one of its drops. `src/core/select.ts:1638-1647` vs `:1104-1120`. An id in the snapshot that has since been superseded, retired, disabled, or hidden by a focus is never a CANDIDATE, so no `Spill` is written and `noteParts` has no entry. `carriedDropReason` exists solely to name those same five cases for the carry tier. Size: medium - reuse `carriedDropReason`."

AND THE MITIGATION IT CHECKED, so nobody re-checks it: `post-compact.ts:302` records "snapshot N id(s), M re-delivered" in the audit log. Report 3 called that "countable after the fact by a human, carrying no ids and no reason, and not where anyone looks mid-task".

WHY IT IS WORTH DOING. The two tiers are one mechanism with two halves, and one half already has the vocabulary the other needs. It is against `INV-nothing-is-dropped-silently` at the moment a session has just lost its window, which is the moment a reader least able to notice.
