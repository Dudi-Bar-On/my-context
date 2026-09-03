---
id: TASK-a-full-window-is-a-state-with-a-next-step-not-a-failure
type: task
title: a full window is a state with a next step, not a failure
status: active
severity: soft
always: false
summary: When a new setting cannot take effect until the conversation is reset, save it anyway and tell the user the one action that will apply it.
summary_of: 0742112711eb0957
scope: []
tags:
  - v2
  - injection
  - budgets
  - "plan:budget"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 0b2faf2044859cd1
plan: budget
seq: "4"
state: done
priority: "1"
source: owner, 2026-08-27
needs: budget/3
---

# a full window is a state with a next step, not a failure

When the new budget cannot take effect now, say so in the owner's own words: this injection requires a compact or a clear before it can happen.

AND SET IT ANYWAY. Budgets are read at SessionStart, so a compact or a clear is precisely the moment the new value takes effect -- the write is not blocked by the full window, only its consequence is deferred. Saying "cannot" and writing nothing would make the user do it twice.

The message must name the ACT, not the state: "run /compact or /clear and the seven pinned items will arrive" is actionable; "the context window is full" is a weather report.
