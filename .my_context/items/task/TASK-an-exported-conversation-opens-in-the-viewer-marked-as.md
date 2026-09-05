---
id: TASK-an-exported-conversation-opens-in-the-viewer-marked-as
type: task
title: an exported conversation opens in the viewer, marked as exported
status: active
severity: soft
always: false
summary: A copy taken earlier can be read back, and never looks like a live session.
summary_of: d52f753241535f5d
scope:
  - src/ui/public/screens/**
  - src/core/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: d3c2274ddf334f27
plan: archive
seq: "5"
state: todo
priority: "3"
---

# an exported conversation opens in the viewer, marked as exported

Step 5 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md, and the last.

The owner asked for the viewer to display an exported conversation distinguished from the
internal one saved under the Claude directory. A copy that looks identical to a live session
is worse than no copy, because a reader cannot tell which they are acting on.

Exports are indexed and listed BESIDE live sessions, marked and dated. That was decided
rather than assumed: an export you cannot find again is not a copy, it is a file. The source
column already exists to carry the distinction.

The accepted cost, stated in the spec: the list stops being a pure mirror of what the harness
holds and becomes a list of what the OWNER holds, which was judged the more useful thing.

Whatever marks an export must survive being looked at quickly. A subtle tint is not a mark.
