---
id: TASK-sessionstart-delivers-the-handover-on-every-source-except
type: task
title: SessionStart delivers the handover, on every source except resume
status: active
severity: soft
always: false
summary: Hand the next session the notes left for it whenever it starts fresh, and say out loud when the notes were expected and are missing.
summary_of: aab550e70fddcc73
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: a5f75c69d3e9315e
plan: handover
seq: "3"
state: done
priority: "1"
source: owner, 2026-08-27
---

# SessionStart delivers the handover, on every source except resume

This item tracks state only. The task itself is Task 3 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

SessionStart's stdout is the ONE hook output the model receives, which is why this tier and not PostCompact — see DEC-the-handover-is-delivered-by-sessionstart-because-postcompact.

`resume` is excluded because it is the only source that keeps the window it already had. A configured handover that is not there DISCLOSES on stderr; an unconfigured one says nothing in either stream. The silence is the defect the requirement exists to answer, so it is asserted in both directions.
