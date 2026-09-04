---
id: TASK-ui3-the-statusline-tee-orphans-a-tmp-file-when-the-rename
type: task
title: "ui3: the statusline tee orphans a tmp file when the rename loses"
status: active
severity: soft
always: false
summary: A leftover temporary file is dropped whenever a save loses a race, and they build up slowly over time.
summary_of: d748a5db22928e82
scope: []
tags:
  - "plan:ui3"
  - "seq:3f"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: a74ca33503ff22cc
plan: ui3
seq: 3f
state: done
priority: "2"
---

# ui3: the statusline tee orphans a tmp file when the rename loses

Found while building src/core/statusline-tee.ts, and deliberately not fixed there because the plan's Step 4 block has no cleanup and adding one would be improvising past the text.

writeTee is tmp-then-rename. On Windows, if a reader holds an open handle across the rename, the rename fails EPERM, writeTee returns written:false with a reason, and the previous whole sample stays on disk. That is the correct degradation - the reader sees a stale sample, never a torn one, and receivedAt is what exposes the age.

What it leaves behind is <session>.json.tmp-<pid> in .statusline/. Bounded per pid, but the bridge command is a fresh process per assistant message, so leftovers accumulate slowly. The directory is gitignored so nothing reaches git.

The natural home is ui3 task 4, which builds the command that actually drives this path.
