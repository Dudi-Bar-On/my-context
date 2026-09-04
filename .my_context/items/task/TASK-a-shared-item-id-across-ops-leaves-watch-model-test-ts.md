---
id: TASK-a-shared-item-id-across-ops-leaves-watch-model-test-ts
type: task
title: a shared item id across ops leaves watch-model.test.ts asserting a sum the new per-item dedupe correctly no longer gives
status: active
severity: soft
always: false
summary: A web-UI test fixture reuses one item id across several deliveries, so a token total the fix now correctly halves still expects the old, larger number.
summary_of: a987ac556fa88a10
scope:
  - test/ui/watch-model.test.ts
tags:
  - v2
  - statusline
  - test-debt
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/task-body.md"
source_anchor: null
source_checksum: 8b18037df83561ca
valid_from: 2026-09-04
valid_until: null
checksum: ec764a84787e3fed
---

# a shared item id across ops leaves watch-model.test.ts asserting a sum the new per-item dedupe correctly no longer gives

> `test/ui/watch-model.test.ts`'s test `/api/watch/context: the share is bounded to this
> window, not to the session's lifetime` (around line 196) fails after
> `TASK-myctx-sums-every-injection-ever-made-instead-of-what-is` landed: its `inject`
> helper names the identical item `RULE-a:pinned` for every call (`session-start`,
> `subagent-start`, `compact-restore`, `jit`), which `core/context-share.ts`'s new
> per-item dedupe now correctly collapses within the post-compaction epoch, so
> `compact-restore`'s 1500 and `jit`'s 700 are charged once (1500) instead of summed
> (2200). The assertion at line ~216 still expects `{ tokens: 2200, injections: 2,
> unrecorded: 0 }`.
>
> Implement by giving each `inject(...)` call in that test a distinct item id (the same
> change already made to the analogous fixture in
> `test/cli/statusline.test.ts`'s "the myctx share counts only THIS window" test), so the
> test keeps proving the epoch/subagent bounds alone and the arithmetic (1500 + 700 =
> 2200) stays intact. This file is outside `TASK-myctx-sums-every-injection-ever-made-
> instead-of-what-is`'s ownership (`test/ui/**` is another lane's), so the fix was not
> applied there.
