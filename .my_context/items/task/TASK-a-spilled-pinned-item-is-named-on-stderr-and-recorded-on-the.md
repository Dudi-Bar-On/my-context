---
id: TASK-a-spilled-pinned-item-is-named-on-stderr-and-recorded-on-the
type: task
title: a spilled PINNED item is named on stderr and recorded on the audit row
status: active
severity: soft
always: false
summary: When notes promised to every session do not all fit, say exactly which ones were left out rather than only how many.
summary_of: fe79ab2645d7d451
scope: []
tags:
  - v2
  - injection
  - budgets
  - hooks
  - "plan:budget"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 5fcb7ee4c6727569
plan: budget
seq: "1"
state: done
priority: "1"
source: owner, 2026-08-27
---

# a spilled PINNED item is named on stderr and recorded on the audit row

SHIPS FIRST, and it is the floor everything else sits on. The owner: "but only for pinned ... and this is only until the whole budget handling by the ui will be implemented" -- so it is interim in the sense that the UI is coming, NOT in the sense that it goes away.

MEASURED TODAY: 23 pinned items cost ~17,237 tokens against a 16,000 budget; the newest SessionStart delivered 16; SEVEN never arrived; the injection audit row has no `spilled` field at all. Among the seven: the instruction to use my_context for everything, the instruction to display the task item before and after work, and the instruction that the mockup is the UI specification.

WHAT TO BUILD:
1. `SessionStart` writes ONE stderr line naming every pinned item that did not fit, and what the tier costs against what it is set to. Not a count -- the IDS, because "7 spilled" is not actionable and "these seven" is.
2. The injection audit row carries them. The log must be able to answer "what did this session not get" without re-deriving it from the corpus as it stands now, which will have moved.
3. ONLY pinned. `jit`, `restored` and `index` spill by design and their spilling is already drawn in the ghost lane. Pinned is the tier whose semantics is "always", and a partial always is the only one that lies.

DO NOT auto-raise the budget here. That was offered and declined: a corpus that grows its own injection cost without anyone deciding is how a window fills quietly.
