---
id: TASK-correct-the-plan-s-test-fixtures-bare-rmsync-is-banned-repo
type: task
title: correct the plan's test fixtures - bare rmSync is banned repo-wide
status: active
severity: soft
always: false
summary: A plan tells people to write cleanup code the project forbids, so four separate people hit the same failure; fix the examples in the plan.
summary_of: cb6908aafd66b628
scope: []
tags:
  - "plan:rulings"
  - "seq:6"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 3c89bb8901634cde
plan: rulings
seq: "6"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:57:08Z"
---

# correct the plan's test fixtures - bare rmSync is banned repo-wide

Every test fixture in web-ui-1 ends rmSync(dir, {recursive:true, force:true}), which test/no-bare-rmsync.test.ts refuses. Four agents hit it independently and T7's suite went red on it. Tasks 8-20 carry the same shape. Replace with removeTree from test/helpers/tmp.ts in the plan text.
