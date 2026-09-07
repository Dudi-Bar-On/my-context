---
id: TASK-a-pruned-session-is-a-row-that-says-so-not-a-row-that
type: task
title: a pruned session is a row that says so, not a row that vanishes
status: active
severity: soft
always: false
summary: A session whose file is deleted disappears from the list unless it was kept, and a kept session is copied out as it grows so nothing is lost.
summary_of: fdeaecf0b4d98628
summary_was:
  - 2026-09-07 When the original transcript file is deleted, the archive should show that it is gone rather than quietly forgetting the session existed.
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - e2e/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:11"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: cb8e3bfa93ee7707
plan: archive
seq: "11"
state: todo
priority: "2"
---

# a pruned session is a row that says so, not a row that vanishes

THE READ HALF AND THE WRITE HALF OF THE SAME LANE DISAGREE, and one of them quotes the other to
justify the opposite.

The spec: "A pruned transcript is a BROKEN ROW in the index. The list MUST SHOW that a session file
is gone rather than failing to load, and that is the strongest argument for export."

The code: rebuildConversations calls index.removeMissing(...) (src/core/conversation-index.ts:890,
method at :740), which DELETES every row whose transcript is gone. And removeMissing own doc comment
CITES THAT SPEC SENTENCE to justify doing the opposite of what it says.

SO A WHOLE STATE IS UNREACHABLE: present:false, missing, the conv.pruned "File deleted" chip,
conv.missingSome, conv.prunedBody and a 200-body branch in read-model-conversations.ts all exist to
draw something no rebuild can leave behind. And the screen help text takes the DELETING side - "A
session your machine has deleted is gone from here too - that is the cost of not copying" - one
string above conv.pruned, which claims the reverse.

DECIDE ONE, then make the other side agree. The owner restated definition points at keeping the row:
he asked for export precisely "because a session is not promised to be available for long period",
and a row that vanishes silently is the state in which nobody learns they should have exported. But
that is a ruling to take, not an assumption to build on.

AND SAY THE SECURITY SENTENCE WHILE IN HERE, because it is the same spec section and equally absent:
"the archive widens what a leaked nonce would show and THAT SHOULD BE SAID OUT LOUD IN THE FEATURE
OWN HELP." The help today says the opposite kind of thing - "nothing here enters your repository" -
and there are zero mentions of sensitivity, pasted secrets or the local port across all 30 conv.*
keys.


─────────────────────────────────────────────────────────────────────────────
OWNER RULING 2026-09-07: THE CODE IS RIGHT AND THE TITLE OF THIS ITEM IS WRONG.
─────────────────────────────────────────────────────────────────────────────

He was shown both sides and chose DELETING the row. Everything above stands as the RECORD of the
contradiction and of how it was found; it no longer states what to build. The spec sentence "a pruned
transcript is a broken row in the index" is SUPERSEDED by this ruling.

SO: removeMissing stays. The list shows ONLY sessions that still exist - and, once persistence is
built, sessions that were marked to persist. The unreachable read half (present:false, missing,
conv.pruned, conv.missingSome, conv.prunedBody and the 200-body branch in read-model-conversations
.ts) becomes DEAD CODE to remove rather than a state to make reachable. Removing it is this task.

AND THE HELP TEXT THAT TOOK THE DELETING SIDE IS NOW CORRECT: "A session your machine has deleted is
gone from here too - that is the cost of not copying." Keep it. It is one string above conv.pruned,
which said the reverse; conv.pruned is what goes.

THE SECURITY SENTENCE STILL BELONGS HERE and is unaffected by the ruling: the spec says the archive
widens what a leaked nonce would show and "that should be said out loud in the feature own help". The
help today says the opposite kind of thing - "nothing here enters your repository" - and there are
zero mentions of sensitivity, pasted secrets or the local port across all 30 conv.* keys.

WHAT REPLACES THE BROKEN ROW is his own better answer, and it is now plan:archive seq:4 and seq:5:
PERSISTENCE, which is a live mirror rather than a snapshot. Read those two before starting here, so
the dead code is removed with the replacement understood rather than merely deleted.
