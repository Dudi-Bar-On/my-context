---
id: TASK-the-handover-config-key-absent-by-default-and-refused-by
type: task
title: the handover config key, absent by default and refused by name when wrong
status: active
severity: soft
always: false
summary: A new setting that turns handover notes on, off unless you set it, and rejecting a wrong value by name rather than guessing.
summary_of: 9a9e0df3695856ec
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ed52e9db6eca31da
plan: handover
seq: "1"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the handover config key, absent by default and refused by name when wrong

This item tracks state only. The task itself is Task 1 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

A new top-level `handover` key beside `ui`, validated by a `requireHandover` built to the shape of `requireUi`: refuse a non-object, refuse an unknown sub-key BY NAME, refuse a path that escapes the project root. ABSENT is the default and absent means the whole feature is off — a plugin does not read files in somebody's repository because they installed it.

`path` names ONE file and is not a glob: a glob that matches two handovers has to pick one, and picking is the act that would need a rule nobody has written.
