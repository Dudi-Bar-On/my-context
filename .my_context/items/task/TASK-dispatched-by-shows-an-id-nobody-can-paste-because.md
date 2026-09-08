---
id: TASK-dispatched-by-shows-an-id-nobody-can-paste-because
type: task
title: dispatched by shows an id nobody can paste, because parentAgentId drops the agent- prefix
status: active
severity: soft
always: false
summary: A column meant to name which helper dispatched another prints a value that is not the name anything else uses for it.
summary_of: 73972363e1741b7e
scope:
  - src/cli/commands/conversation.ts
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - cli
  - "plan:archive"
  - "seq:32"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: a96bc530edfe73fb
plan: archive
seq: "32"
state: todo
priority: "3"
---

# dispatched by shows an id nobody can paste, because parentAgentId drops the agent- prefix

MEASURED 2026-09-09 on this workspace, while building plan:archive seq:15. The harness's agent-<id>.meta.json records parentAgentId WITHOUT the agent- prefix that the transcript's own filename and every other surface carry.

    the roster's agentId          agent-a276e58976e10fe19
    the same lane's parentAgentId a26cb0b87f4a6712a
    the file that id names        agent-a26cb0b87f4a6712a.jsonl

So the two fields are in DIFFERENT namespaces although both are called an agent id, and 43 of this workspace's 255 lanes carry the second one.

WHAT IT COSTS TODAY, and it is exactly one thing: mycontext conversation subagents prints parentAgentId raw in its 'dispatched by' column, so 43 rows show a value that cannot be pasted into mycontext conversation show or into the viewer's own address. The column reads 'the session' for depth 1 and is right; at depth 2 it names something no other command answers to.

WHAT IT DOES NOT COST. Nothing in the UI depends on it. seq:15 joins a turn to a lane on toolUseId, which both sides record identically, and that is why the link works at depth 2 without ever reading parentAgentId — the asymmetry was found by reading the field, not by being bitten by it.

THE REPAIR IS A CHOICE, NOT A ONE-LINER, and whoever takes it should make it deliberately. Either the column prefixes on the way out (presentation, and the stored value stays the harness's own), or the index normalises on the way in (one namespace everywhere, at the price of storing something the sidecar did not say). This project's own habit favours the first: readSubagentMeta's header says the sidecar's schema is the harness's and the transcript beside it is the thing worth keeping.

VERIFY IT STILL HOLDS BEFORE FIXING IT. This is an observation about a harness format that can change under us, and 43 rows is the whole sample.
