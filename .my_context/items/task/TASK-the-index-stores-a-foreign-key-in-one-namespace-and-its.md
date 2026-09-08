---
id: TASK-the-index-stores-a-foreign-key-in-one-namespace-and-its
type: task
title: the index stores a foreign key in one namespace and its target in another, so the archive cannot self-join
status: active
severity: soft
always: false
summary: The archive index cannot join a lane to the lane that dispatched it, because the two ids are spelled differently and the shipped SQL surface answers zero.
summary_of: 0d78fc6084c2de94
scope:
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - cli
  - "plan:archive"
  - "seq:33"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 85461aa7a83f9a63
plan: archive
seq: "33"
state: todo
priority: "3"
---

# the index stores a foreign key in one namespace and its target in another, so the archive cannot self-join

MEASURED 2026-09-09, immediately after plan:archive seq:32 shipped. seq:32 repaired the CLI column at the point of DISPLAY and deliberately left the index alone. This item is the half it left standing, written down so nobody has to rediscover it from the outside.

WHAT IS STILL TRUE. subagents.agent_id holds agent-<hex>, because listSubagentFiles takes the whole filename stem and that stem carries the prefix. subagents.parent_agent_id holds bare <hex>, because that is what the sidecar says. The two are written one line apart in the same upsertSubagent call, and they are in different namespaces although both are an agent id.

AND IT IS REACHABLE FROM A SHIPPED SURFACE, which is why this is an item and not a footnote. mycontext query is read-only SQL over this same database, and it was run:

    SELECT COUNT(*) FROM subagents c JOIN subagents p ON p.agent_id = c.parent_agent_id                     0
    SELECT COUNT(*) FROM subagents c JOIN subagents p ON p.agent_id = 'agent-' || c.parent_agent_id        43

Zero is the answer a person gets to the obvious question about this table, and it is WRONG rather than empty: 43 of 257 lanes do have a parent in it. A count that says nothing is there is the worst shape a defect can take on a read surface.

WHY seq:32 COULD NOT FIX IT HERE, and any repair must answer this. conversation-index.ts rules that these tables carry no version number and that THE SHAPE IS THE VERSION - openReadOnlyChecked walks CONVERSATION_TABLE_COLUMNS and refuses a shape it does not read. Normalising on the way IN changes a VALUE and no shape at all, so nothing can tell a row written before the change from one written after it; and rebuildConversations skips any transcript whose bytes and mtime are unchanged, which a finished lane transcript never is again. A write-side fix alone would therefore leave the 43 existing rows bare and write new ones prefixed - one column holding two namespaces, undetectably. That is strictly worse than today, where the defect is at least uniform.

SO THE REPAIR IS A SHAPE CHANGE OR IT IS NOTHING. Either a new column beside parent_agent_id carrying the resolvable id, which openReadOnlyChecked can then REQUIRE, so an index built before the change refuses and gets rebuilt; or parent_agent_id normalised together with some marker in the shape that makes an old index refuse rather than mislead. Both are more than seq:32 was scoped as, which is the whole reason this is a separate item.

DO NOT reach for it by making readSubagentMeta lie. Its header rules that the sidecar schema is the harness own and the transcript beside it is the thing worth keeping. A normalisation belongs at the seam where the index row is built - the same seam that already derives agent_id from a filename - and not in the function whose job is to report what the file said.

AND CORRECT ONE THING seq:32 SAID WHILE YOU ARE HERE. It described the harness as dropping the agent- prefix. It does not: the sidecar carries NO self-id field at all - across all 257 files the key set is exactly agentType, description, isFork, model, parentAgentId, spawnDepth, toolUseId - so the prefixed spelling is ours, adopted from the filename. Half the asymmetry is the harness format and half is our own naming.

WHAT IT DOES NOT COST TODAY. mycontext conversation subagents prints a resolvable id in its dispatched by column since seq:32, and --json carries dispatchedBy beside the untouched parentAgentId. Nothing in the UI reads the field: the turn-to-lane join is toolUseId, which both sides record identically.
