---
id: TASK-retiring-an-item-asks-before-it-happens-wherever-it-is
type: task
title: retiring an item asks before it happens, wherever it is triggered from
status: active
severity: soft
always: false
summary: Replacing a rule that is in force always asks first, not only when it is done through one particular command.
summary_of: ba5321da1a72062f
scope:
  - src/core/mutate.ts
  - src/cli/**
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:contra"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 03edf8b0b52c8f03
plan: contra
seq: "4"
state: todo
priority: "1"
---

# retiring an item asks before it happens, wherever it is triggered from

Owner ruling 2026-09-08. Found by the lane that built the contradiction gate, in its own work.

THE HOLE. `--supersedes <id>` can now be answered from `add` and `edit`, because the gate offers it
as a disposition. But supersedeItem itself NEVER PROMPTED - the confirm lives in the `mycontext
supersede` command, not in the mutation. So retiring a governing item through the gate happens with
no confirmation at all.

preflightSupersede already asks the two refusals that matter BEFORE the write (an unknown id, and a
non-human retiring a governing normative item). What remains is a mid-write failure: the
existing-successor refusal, or a target that stops being writable, can still surface AFTER the create
- leaving the new item on disk and the old one un-retired.

WHAT TO BUILD: the same confirm `mycontext supersede` already shows, on the gated path. Retiring
something that governs is irreversible enough that it asks WHEREVER it is triggered from. The
wording should be the existing one, not a second one.

THE ALTERNATIVE THE OWNER CONSIDERED AND DID NOT TAKE: making create-plus-retire atomic. It is the
better guarantee, and this codebase has no transaction primitive today, so it is a larger piece of
work. If the confirm turns out not to close the half-done-pair case, that is the next move rather
than a wider confirm.
