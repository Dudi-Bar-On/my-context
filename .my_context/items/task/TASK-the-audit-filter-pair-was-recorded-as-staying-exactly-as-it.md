---
id: TASK-the-audit-filter-pair-was-recorded-as-staying-exactly-as-it
type: task
title: the audit filter pair was recorded as staying exactly as it is, and the follow-up recorded with it was dropped
status: active
severity: soft
always: false
summary: Two copies of one filter were judged safe to keep, on condition of a small guard that was never written down as work.
summary_of: 93c27f05d1dd3a60
scope:
  - src/core/**
  - test/**
tags:
  - v2
  - core
  - derived
  - "plan:rulings"
  - "seq:92"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 8e5e0f447ac06831
plan: rulings
seq: "92"
state: todo
priority: "3"
---

# the audit filter pair was recorded as staying exactly as it is, and the follow-up recorded with it was dropped

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, Simplify 7) examined `filterAudit` and `filterSelect`/`queryProjection`, found every caller independently justified, and ended with a RECOMMENDATION. `reports/2026-09-13-the-consolidated-findings.md` moved the finding into its "Stays exactly as it is" list as entry 3 and kept only the phrase "One small named residual cost" - so the observation survived and the action did not. Found 2026-09-15 by the audit at `rulings/90`.

WHAT REPORT 5 RECOMMENDED, quoted: "the residual cost the file names is real: adding a new filter field means touching two implementations, and the cross-check test verifies BEHAVIORAL agreement on sample data, not that a structural change to one was mirrored in the other. Worth a small, low-priority follow-up (a shared list of filter field names, asserted identical at both ends) rather than a removal."

AND THE FILE SAYS IT ITSELF. Report 5 quotes `src/core/audit.ts`: "two implementations of one filter is exactly the drift this project keeps finding".

WHY IT IS NOT A DUPLICATE OF THE STAY. The stay is correct and is not being reopened: the two implementations exist for three independently argued callers - `cli/commands/audit.ts` falls back to the raw log when the projection is broken, `mcp/tools.ts` and `pack/history.ts` deliberately skip the index - and `test/core/audit-projection.test.ts` pins their agreement over 355 lines. NOTHING HERE PROPOSES MERGING THEM. What is missing is the one thing the cross-check cannot do: notice that a field was added to one side and not the other.

THIS IS D51 - a fact kept by hand in a second place, derived instead. It is the smallest instance of that subject in the tree.
