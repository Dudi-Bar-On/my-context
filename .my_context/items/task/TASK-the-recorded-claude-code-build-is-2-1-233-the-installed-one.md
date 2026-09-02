---
id: TASK-the-recorded-claude-code-build-is-2-1-233-the-installed-one
type: task
title: the recorded Claude Code build is 2.1.233; the installed one is 2.1.238
status: active
severity: soft
always: false
summary: A recorded fact about outside software still holds, but the version noted beside it is a few builds behind.
summary_of: 1bc02e3ad9615e77
scope: []
tags:
  - "plan:ui3"
  - "seq:3v"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: df3e907941f6a7de
plan: ui3
seq: 3v
state: done
priority: "3"
---

# the recorded Claude Code build is 2.1.233; the installed one is 2.1.238

Checked during ui3 task 3. Both greps the plan prescribes still match, and the payload construction is byte-identical apart from minifier symbol names - az0/v8o where the plan recorded TAw/wMo. Every field name is the same, including the e?...:0 branch that makes current_usage === null the only valid gate for not-yet-known.

So nothing is wrong: the external fact still holds. What is stale is the version beside it - the external-facts table, spec 4b, and a test docstring all say 2.1.233.

The plan says to re-extract only if either grep comes back empty, so the agent correctly did not touch any of the three. Bumping the recorded version is a decision about how a verified external fact records WHEN it was verified, not about the fact itself.
