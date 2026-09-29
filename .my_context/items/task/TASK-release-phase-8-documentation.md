---
id: TASK-release-phase-8-documentation
type: task
title: release phase 8 — documentation
status: active
severity: soft
always: false
summary: Every false claim in the README and chapters corrected, retired items no longer cited as live, screenshots shot from a sandboxed server, and the changelog written for 2.0.0.
summary_of: 34def61c496e138b
scope: []
tags:
  - "plan:release"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: aa8d40cd2fd34e1a
plan: release
seq: "8"
state: todo
---

# release phase 8 — documentation

Spec: docs/superpowers/plans/2026-09-22-v2-0-release.md, Phase 8. Closes when that phase's exit condition is met on this machine and on both CI jobs, and checkpoint 8 is reported and appended to reports/2026-09-22-release-checkpoints.md.

Documentation debts recorded by phase 4 on 2026-09-23, for this phase's lanes: (1) docs/capabilities/03-creation-and-gates.md and its Hebrew mirror carry a hand-written, explicitly exhaustive doctor code list (info (24) ... 61 total) that is now two codes behind — governing_spill_coverage (task 4.5) and the rule-store check's code (task 4.5 round 3); nothing pins the list, so nothing went red. (2) README.md's warning block above Growth ('A hook that fails to write its record does not tell you... still injects, silently') and docs/README.he.md's mirror assert a behaviour task 4.4 retired: every hook now reads its audit-write result and discloses on stderr (unrecordedHookLine). (3) src/core/audit.ts recordAudit's docblock was corrected by 4.4b; the two READMEs were not. Closing condition adds to this item's own: both READMEs say what ships, and the capabilities doc's code list is either regenerated from the registry or stops claiming to be exhaustive.
