---
id: TASK-a-corrupt-manifest-makes-the-next-publish-erase-the-store
type: task
title: a corrupt manifest makes the next publish erase the store changelog, and only the packaging boundary keeps it small
status: active
severity: soft
always: false
summary: One damaged file turns the next publish into a deletion of the record of every change the store has ever had.
summary_of: 42de8640403fe7ed
scope:
  - src/rules/**
tags:
  - v2
  - store
  - silent-failure
  - "plan:store"
  - "seq:13"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: a99f4d20a17bed3d
plan: store
seq: "13"
state: doing
priority: "3"
---

# a corrupt manifest makes the next publish erase the store changelog, and only the packaging boundary keeps it small

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) raised it in the paragraph after its minors table, alongside four findings that DID become rows (`e2e-gate.ts`, `harness/baseline.mjs`, `library-screen.test.ts` and the two `composer-staging` skips all became row 115). This one did not. Found 2026-09-15 by the audit at `rulings/90`.

WHAT REPORT 3 SAID, quoted: "`src/rules/manifest.ts:165, 550, 626` would erase the store changelog on the next publish after a corrupt manifest, reachable only from `src/ui/maintenance/`, which `package.json` excludes from `files` - MINOR TODAY, MAJOR THE DAY IT SHIPS."

WHY IT IS FILED RATHER THAN CLOSED BY THE EXCLUSION. The exclusion is real and is the recorded security model - `src/ui/maintenance/**` is entry 5 of report 5s "stays exactly as it is" list, asserted two ways. But it excludes the maintenance UI from the PUBLISHED PACKAGE, not from this repository, and the owner runs this repository. A corrupt manifest plus one publish from the maintenance screen erases the changelog HERE, today.

AND THE CHANGELOG IS ALREADY KNOWN TO BE THE WEAK HALF. `store/10` measured that replaying it from empty yields eleven entries against a store of twelve, so it cannot reconstruct the store even intact. Losing it outright is the same defect one step further.

WHAT TO ESTABLISH FIRST, because report 3 wrote "would erase" rather than "erases": reproduce it in a scratch copy of the store the way report 6 reproduced `evil.md` for `store/6`. If the write is guarded somewhere report 3 did not read, close this item by saying so.
