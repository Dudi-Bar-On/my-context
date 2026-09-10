---
id: TASK-notice-the-drift-while-it-is-happening-quietly-and-off-by
type: task
title: notice the drift while it is happening, quietly and off by default
status: active
severity: soft
always: false
summary: A warning when the work has wandered from the plan you set, before you notice you are lost.
summary_of: ca24a982b823bb53
scope:
  - src/review/**
  - test/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: da2aadea3ca6a476
plan: recall
seq: "3"
state: todo
priority: "1"
needs: recall/2
---

# notice the drift while it is happening, quietly and off by default

D42 PHASE 3. Plan: docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md Task 13. Design: docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md sections 13, 14.

LAST DELIBERATELY. Retrieval is the cure and stands alone; this is prevention and it needs anchors,
subjects and chronology to judge against. Built last, it is built on measured foundations - and he
can decide whether he still wants it once finding his way back is cheap.

IT MUST BE ABLE TO BE WRONG QUIETLY. Telling him he has drifted when he has not is worse than
silence, which is why it is OFF BY DEFAULT.

plan:loop seq:2 already computes "is this session worth looking at" and measured the shape: 3,924
tool calls became 261 considerations, 164 rubric fires and 3 passes - where firing on every Stop
would have been 766. This asks the same machinery a different question.

Drift is detected against an ANCHOR, never against a guess at intent.
