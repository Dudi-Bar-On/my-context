---
id: TASK-a-lane-s-own-id-carries-agent-and-the-id-naming-its-parent
type: task
title: a lane's own id carries agent- and the id naming its parent does not, so a roster of 264 draws every one of them at the top level
status: active
severity: soft
always: false
summary: The helper agents a session dispatched can be listed, but the record saying which one dispatched which is written two ways, so the list has to translate between them.
summary_of: c372b1a3581e5837
scope:
  - src/core/conversation-index.ts
  - src/ui/read-model-conversations.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:48"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 6e557d8901831392
plan: archive
seq: "48"
state: done
priority: "2"
needs: archive/41
---

# a lane's own id carries agent- and the id naming its parent does not, so a roster of 264 draws every one of them at the top level

FOUND WHILE BUILDING plan:archive seq:41, WHICH IS THE FIRST CODE THAT EVER JOINED THE TWO FIELDS.

MEASURED on this workspace, 2026-09-09, over all 265 rows GET /api/conversations/:id/subagents answers:

    rows carrying a parentAgentId                      43
    of those, whose value matched an agentId            0
    of those, matched once 'agent-' was prepended      43   100%
    distinct parents, the number seq:41 ruled on        17

WHY THE TWO DISAGREE. agentId is derived from the FILE NAME - the transcript is agent-<id>.jsonl, so the prefix is part of the name the index stores. parentAgentId is copied verbatim out of the agent-<id>.meta.json sidecar, which writes the BARE id. Both are correct about their own source and neither is wrong on its own; they are simply not the same alphabet, and nothing had ever compared them.

WHAT IT WOULD HAVE COST, had it not been caught. seq:41's shape is the owner's own ruling - A FLAT LIST WITH THE CHILDREN INDENTED - and the indent is the only place the roster carries the fact that a fifth of these lanes were dispatched from inside another lane. Unjoined, all 264 draw at depth 1: a list that looks complete, is complete, and has silently dropped the one relation it was drawn to show. It would not have failed; it would have looked right.

WHAT IS SHIPPED NOW. laneKey in screens/conversations.js normalises both sides before comparing, and test/ui/transcript-viewer.test.ts asserts both spellings resolve. That is a READER-SIDE repair and it is deliberate: fixing the stored column needs a rebuild, and the index is shared with a server the owner is running.

WHAT IS LEFT TO DECIDE, and it is the reason this is an item rather than a comment: WHICH SPELLING IS THE PRODUCT'S. Three options and they are not equal.
  - Normalise in the INDEX, at upsertSubagent, so the column holds agent-<id>. One vocabulary for every future reader, and it costs a rebuild before it takes effect - which is a write, and the projection is read by a running server.
  - Normalise at the READ MODEL, in summariseSubagent, so the endpoint answers one spelling. Cheaper, no rebuild, and it changes a published field that other readers may already parse.
  - Leave both and keep normalising at every join, which is what is shipped. It is honest and it is the option that rots: the next consumer will not know to do it, and its failure mode is a silently flat list rather than an error.

The measurement is in laneKey's own header so a reader meets it where the translation happens.

CLOSED 2026-09-09, AND THE DECISION WAS TAKEN BY seq:33 RATHER THAN HERE. THE OPEN QUESTION WAS WHICH SPELLING IS THE PRODUCT'S, AND THE ANSWER SHIPPED IS THE FIRST OF THE THREE OPTIONS ABOVE: NORMALISE IN THE INDEX. subagents.dispatched_by holds the RESOLVABLE id, derived once in upsertSubagent from dispatchingAgentId; parent_agent_id keeps the harness's own bare spelling untouched, which is readSubagentMeta's stated job; and openReadOnlyChecked now REQUIRES the column, with ConversationIndex.open healing an older index through fillDispatchedBy. The option this item called the one that rots was not taken.

MEASURED AFTER, ON THE OWNER'S OWN CORPUS, 2026-09-09, THROUGH openReadOnlyChecked AND THE SHIPPED READER FUNCTION rosterOrder ITSELF RATHER THAN A RESTATEMENT OF IT:

    lane rows in the index, over 2 sessions               274
    rows carrying a parentAgentId                          43
    of those, whose dispatched_by resolves to an agentId   43   100%
    of those, whose dispatched_by is null                   0
    rows rosterOrder draws INDENTED                        43
    ROWS THAT DRAW AS ORPHANS                               0
    the same, comparing the two spellings verbatim         43

SO THE DEFECT THIS ITEM WAS FILED FOR IS ZERO ON HIS MACHINE, AND THE 43 THE ITEM COUNTED ARE THE 43 THAT NOW DRAW UNDER THEIR DISPATCHER. The reader-side laneKey (seq:41, reused by seq:49) and the index-side dispatched_by (seq:33) agree on every one of them, and no third normalisation was added.

WHAT IS STILL TRUE AND IS NOT A DEFECT, RECORDED SO NOBODY RE-FILES IT. summariseSubagent publishes parentAgentId BARE and does not publish dispatchedBy, so GET /api/conversations/:id/subagents still answers the harness's spelling and the reader still translates. That is the published-field boundary this item's second option would have changed, and it was deliberately not changed: the field is already parsed by other readers, laneKey is one pure exported function with the measurement in its own header, and the index — which is where a future consumer starts — now carries one vocabulary. If that boundary is ever revisited, the change is to ADD dispatchedBy beside parentAgentId, never to redefine it.
