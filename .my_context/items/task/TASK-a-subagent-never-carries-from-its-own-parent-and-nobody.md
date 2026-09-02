---
id: TASK-a-subagent-never-carries-from-its-own-parent-and-nobody
type: task
title: a subagent never carries from its own parent, and nobody ruled that it should not
status: active
severity: soft
always: false
summary: A helper session skips the very conversation it was launched from when picking up earlier context, and nobody has decided whether that is right.
summary_of: d6d0878dcf97fba3
scope: []
tags:
  - "plan:hooks"
  - "seq:18s"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 20b47c7f7ff56c48
plan: hooks
seq: 18s
state: done
priority: "1"
---

# a subagent never carries from its own parent, and nobody ruled that it should not

Task 18 resolves a carry source from state/, defaulting to the most recent session OTHER than the current one. On the subagent event the agent passed the payload's session_id as currentSessionId - and a SubagentStart payload carries the PARENT's session_id.

The consequence, documented at the call site: a subagent excludes its parent and carries from the most recent other session instead. It is consistent with the literal rule and it is almost certainly not what anyone wants: the parent is the one session whose context a child most plausibly continues.

The agent flagged it as a one-line change if the owner disagrees, and did not decide it alone. That was right.

The question: should a subagent carry from its parent, or from the most recent session that is neither itself nor its parent, or not carry at all? Task 11 already established the parent's id is what a child sees, and the clear path is gated on !subagent for exactly that reason - so there is precedent for treating the subagent event as its own case rather than a session like any other.
