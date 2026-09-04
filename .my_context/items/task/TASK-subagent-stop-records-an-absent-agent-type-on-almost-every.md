---
id: TASK-subagent-stop-records-an-absent-agent-type-on-almost-every
type: task
title: subagent-stop records an absent agent type on almost every row while the payload carries one
status: active
severity: soft
always: false
summary: Nearly every stop row says the agent type is absent, though a real payload carries the type under a different field name.
summary_of: e55fef35034dfa5b
scope:
  - src/hooks/subagent-stop.ts
  - src/hooks/io.ts
tags:
  - v2
  - hooks
  - audit
  - "plan:hooks"
  - "seq:27"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: bc4021503105ea6c
plan: hooks
seq: "27"
state: done
priority: "3"
verified_on: 2026-09-04
---

# subagent-stop records an absent agent type on almost every row while the payload carries one

Measured across every audit segment in this repository: 7,361 of 7,635 subagent-stop rows,
96.4 percent, carry type=<absent> in their note. The handover recorded the same figure
independently at 96.7 percent, so this is a standing condition and not a recent break.

A live SubagentStop payload probed on 2026-09-04 carries agent_type. The stop row is reading
some other field, or reading a field that is only sometimes present, and reporting absence
rather than looking where the value actually is. The dispatch row added the same week gets
this right by a different route: it takes the type from the Agent tool input at
PostToolUse, which is why agent-dispatched rows name a type and subagent-stop rows next to
them do not.

The cost is small but it is exactly the kind of small that accumulates. A reader scanning the
stream sees a lane dispatched as general-purpose and stopped as absent, and has to know that
those two rows disagree for a reason that is not about the lane.

What to build: read agent_type where the payload provides it, keep the absent marker only for
the case where it genuinely is not there, and say in the code which field is authoritative so
the two rows agree by construction rather than by coincidence. Confirm first, on real
payloads, whether agent_type is present on every firing or only some, because a marker that
sometimes lies is worse than one that always does.
