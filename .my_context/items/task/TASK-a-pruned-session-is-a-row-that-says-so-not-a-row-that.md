---
id: TASK-a-pruned-session-is-a-row-that-says-so-not-a-row-that
type: task
title: a pruned session is a row that says so, not a row that vanishes
status: active
severity: soft
always: false
summary: A session whose file is deleted disappears from the list unless it was kept, and a kept session is copied out as it grows so nothing is lost.
summary_of: b0e11eae89eee34e
summary_was:
  - 2026-09-07 When the original transcript file is deleted, the archive should show that it is gone rather than quietly forgetting the session existed.
acknowledged:
  - body_disagrees_with_meta@95067a97ec49c3ef
  - citation_form@95067a97ec49c3ef
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 95922a15b76a29a3
plan: archive
seq: "11"
state: done
priority: "2"
verified_on: 2026-09-10
---

# a pruned session is a row that says so, not a row that vanishes

THE READ HALF AND THE WRITE HALF OF THE SAME LANE DISAGREE, and one of them quotes the other to
justify the opposite.

The spec: "A pruned transcript is a BROKEN ROW in the index. The list MUST SHOW that a session file
is gone rather than failing to load, and that is the strongest argument for export."

The code: rebuildConversations calls index.removeMissing(...) (`src/core/conversation-index.ts` ·
`index.removeMissing(`,
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

CITATION RE-ANCHORED 2026-09-08, under
RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number.

It cited src/core/conversation-index.ts:890 by line and carried no fragment - and the line HAD
ALREADY DRIFTED: 890 is a fragment of a query, not the removeMissing call the sentence is about.
The citation was wrong within a day of being written, which is the argument for the rule rather
than an exception to it.

────────────────────────────────────────────────────────────────────────────
MEASURED 2026-09-09: THE RULING STANDS, ONE OF ITS PREMISES DOES NOT.
────────────────────────────────────────────────────────────────────────────

THE WRITE HALF IS UNTOUCHED AND WAS NEVER IN DOUBT. removeMissing stays, the list holds only
sessions that still exist, and no row is kept for a pruned transcript. That is what the owner chose
and it is what the code does.

WHAT IS WRONG IS THE WORD UNREACHABLE. The ruling calls present:false, conv.pruned, conv.missingSome,
conv.prunedBody and the 200-body branch DEAD CODE to remove rather than a state to make reachable.
They are reachable, and they were reachable while that sentence was being written: removeMissing runs
during a REBUILD, while the list is served FROM THE INDEX between rebuilds and stats each file at
request time. Delete a transcript, load the screen before the next assistant turn, and the row is
there with present:false.

IT IS A TEST, NOT AN ARGUMENT, AND IT HAD BEEN GREEN SINCE seq:2. test/ui/conversations-endpoint
.test.ts, now named `a transcript deleted between two rebuilds is disclosed, then dropped`,
constructs the state in three lines and now asserts BOTH halves: before a rebuild the row is served
with present:false and the document answers 200 with the reason in a sentence; after a rebuild the
row is gone.

SO THE READ HALF WAS NOT DEAD CODE, IT WAS THE DISCLOSURE FOR A ONE-TURN WINDOW. Removing it would
have left, for exactly that window, a row on the list with nothing marking it, opening onto a
document that cannot load - INV-nothing-is-dropped-silently failing at the one moment it exists for.
So the chip is KEPT and what changed is what it claims: not that the archive keeps pruned sessions,
which the ruling reversed, but that this one is already gone and leaves the list at the end of your
next turn. conv.missingSome now says that, which is what reconciles it with the help text that took
the deleting side - and that help text is kept, as the ruling asked.

THIS IS THE CHEAPER-TO-REVERSE HALF AND IT IS FLAGGED AS PROVISIONAL. If the owner wants the
deletion carried out literally, it is about forty lines and three string keys, and the window above
is what he would be choosing to leave undisclosed.

AND THE SECURITY SENTENCE IS DONE. conv.sensitive is drawn FIRST in the feature's own help
disclosure, in both languages: what the files hold, that the app serves them over a local port to
whoever holds its address, that an archive turned on WIDENS what a leaked link would show, and the
two commands that turn it on and off. Before this there were zero mentions of sensitivity, pasted
secrets or the local port across all 30 conv.* keys.
