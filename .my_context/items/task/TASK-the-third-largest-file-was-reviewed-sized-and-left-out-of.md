---
id: TASK-the-third-largest-file-was-reviewed-sized-and-left-out-of
type: task
title: the third-largest file was reviewed, sized and left out of the accretion subject with its caution attached
status: active
severity: soft
always: false
summary: One more oversized file was examined and recommended for a careful split, and the list that collected the others left it off.
summary_of: 6dd12cd16a1259b8
scope:
  - src/core/**
tags:
  - v2
  - core
  - accretion
  - "plan:accretion"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 231c89ed02a055ee
plan: accretion
seq: "6"
state: todo
priority: "3"
---

# the third-largest file was reviewed, sized and left out of the accretion subject with its caution attached

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`) listed seven entries under Simplify. The consolidation carried entries 1 and 2 as rows 78 and 79, entries 3 and 4 together as row 84, entry 6 as part of row 65, and entry 7 into its stays list. ENTRY 5 WAS CARRIED NOWHERE. D76 names four files and this is not one of them. Found 2026-09-15 by the audit at `rulings/90`.

WHAT REPORT 5 SAID, quoted in the parts that matter: "`src/core/conversation-index.ts` (3,449 lines) - lower confidence, and worth real care before acting. Its own opening line names two things: the conversation index and the scanner that rebuilds it from disk. Structurally visible: pure transcript-parsing (~1,100 lines), the `ConversationIndex` SQLite-backed class (~1,000 lines), then rebuild/forget orchestration."

THE CAUTION IS HALF THE FINDING AND MUST TRAVEL WITH IT. Report 5: "there is a specific, measured reason to be careful here: the `restore-stage.ts`/`restore-staging.ts`/`restore-store.ts` split one directory over exists SPECIFICALLY to keep `node:sqlite` off an injection-critical import path (`test/core/restore-delivery.test.ts` walks the runtime import graph and fails if `conversation-index.ts` or `node:sqlite` becomes reachable from it). `core/statusline-tee.ts` and `cli/commands/statusline.ts` already import only the cheap, non-SQLite pieces of this file BY NAME (`subagentDir`, `countSubagentFiles`) for exactly that reason. A split has to preserve that boundary at least as carefully as the restore family does. I would want whoever touches this file next to confirm there is no unwritten version of the same argument before moving code - CONSIDER CAREFULLY, NOT DO."

RE-MEASURED 2026-09-15: the file is now 3,869 lines, up from the 3,449 report 5 counted. It is the third-largest TypeScript file in the repository behind `read-model.ts` (4,264) and `mcp/tools.ts` (3,109), both of which have items under this plan.

SO THE DELIVERABLE IS A JUDGEMENT FIRST. Confirm or refute the import-boundary argument, then either split or record why not. A recorded "it stays" is a legitimate close for this item and is what report 5 itself expected.
