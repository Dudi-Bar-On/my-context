---
id: TASK-three-surfaces-still-file-a-restore-disclosure-under-spilled
type: task
title: three surfaces still file a restore disclosure under spilled, and none prints the disclosed count
status: active
severity: soft
always: false
summary: A snapshot item the tool could not bring back is now recorded as a disclosure rather than a budget loss, but the contribution command, the watch screen and the ask screen still show it as a budget loss or not at all.
summary_of: 18d8a4d2300369f1
scope: []
tags:
  - "plan:release"
  - "seq:29"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 314268ccd4e634d5
plan: release
seq: "29"
state: todo
---

# three surfaces still file a restore disclosure under spilled, and none prints the disclosed count

Found by task 4.2 and its reviewers on 2026-09-23 (TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where, commits 7cf25718 and 6f41a7b5) and by task 4.4b: the projection files a never-offered restore id as role 'disclosed' and contribution.ts / retire.ts / watch-model.ts carry a disclosed count beside the budget count, but (1) src/cli/commands/contribution.ts prints only the spilled column, so the disclosed count is computed and never shown; (2) the watch screen (src/ui/public/screens/watch.js over /api/watch/spills) draws the row's mark nowhere; (3) src/ui/public/screens/ask.js ROLE_CHIP (~line 401) and the loop at ~549 chip every record.spilled entry as 'spilled' regardless of ref.neverOffered, so a restore disclosure reads as budget pressure. Closing condition: each surface draws a disclosed entry as disclosed (its own chip or column, the reason on hover or beside it), the contribution command prints the disclosed column, and a test per surface plants one budget spill and one restore disclosure in one record and asserts they are told apart; browser specs for the two screens. Files: src/cli/commands/contribution.ts, src/ui/public/screens/watch.js, src/ui/public/screens/ask.js, their tests, e2e specs. Release phase 5 (the CLI column) and phase 6 (the two screens) - one lane, held in phase 6.
