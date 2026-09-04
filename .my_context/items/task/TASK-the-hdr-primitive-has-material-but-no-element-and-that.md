---
id: TASK-the-hdr-primitive-has-material-but-no-element-and-that
type: task
title: the .hdr primitive has material but no element, and that material was inferred
status: active
severity: soft
always: false
summary: A style for the top bar exists but nothing wears it, and whether the top bar should look that way was never actually decided.
summary_of: 2962a683fcfb1ca5
scope: []
tags:
  - "plan:repaint"
  - "seq:3d"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 99d90af96064874e
plan: repaint
seq: 3d
state: done
priority: "2"
---

# the .hdr primitive has material but no element, and that material was inferred

The primitives agent shipped .hdr with the glass material, and flagged honestly that two things about it are not ruled:

1. It is bound to no DOM element. The live top bar is still .top. So .hdr exists and nothing wears it.
2. Its material is an INFERENCE from primitive 1 - 'nothing is a plain box' - not an explicit ruling. The spec does not say the header is glass.

The ui3 task 11 reconciliation already touched this from the other side: the Watch screen's status strip is chrome and matches .hdr, and it was a bordered plain div on a retired token.

So the question is one ruling: is the top bar glass, and does .top become .hdr. Task 6 or task 9 will bind it either way; better to answer it before twenty screens copy the answer.
