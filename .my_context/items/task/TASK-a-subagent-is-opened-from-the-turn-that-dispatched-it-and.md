---
id: TASK-a-subagent-is-opened-from-the-turn-that-dispatched-it-and
type: task
title: a subagent is opened from the turn that dispatched it, and closing it returns to the same place
status: active
severity: soft
always: false
summary: Following a link from a conversation into the work a helper did, and coming back to exactly where you were reading.
summary_of: 579e7b1b11c09262
scope:
  - src/core/conversation-index.ts
  - src/ui/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 1fa63b97ad7d4edc
plan: archive
seq: "15"
state: todo
priority: "1"
needs: archive/12,archive/13
---

# a subagent is opened from the turn that dispatched it, and closing it returns to the same place

Owner ruling 2026-09-08, on seeing the viewer: every subagent used from a conversation should be
openable from that conversation, and "what’s important is to let the user return exactly to the
cursor point from where it requested to view the subagent content".

WHY IT MATTERS MORE THAN CONVENIENCE, and the numbers are why: measured in this workspace, 478
subagent transcripts totalling 91 MB against 61 MB for the session itself. THE SESSION HOLDS EACH
LANE’S REPORT; THE SUBAGENT TRANSCRIPTS HOLD THEIR REASONING. A reader following a lane’s
conclusion has no way to reach the working that produced it.

THE RETURN IS THE REQUIREMENT, not the link. A reader ten thousand records into a 26,673-record
document who follows a link and loses their place has been punished for looking. So the position
must be restored exactly - which in a VIRTUALISED scroll is a real problem rather than a
scrollTop: the row may not be in the DOM when you come back.

HE LEFT THE SHAPE OPEN - "either as a popup window with the same renderer or a different way". A
second tab is the precedent this project already has for the document page. A popup keeps the
reader’s place trivially. Weigh both and say which and why.

THE SAME RENDERER, whichever shape wins: plan:archive seq:13’s document skeleton and seq:8’s
terminal rendering. A subagent transcript is the same kind of thing and must not grow a second
viewer.

DEPENDS ON seq:12, which indexes and persists the subagent transcripts. Without that there is
nothing to link TO.
