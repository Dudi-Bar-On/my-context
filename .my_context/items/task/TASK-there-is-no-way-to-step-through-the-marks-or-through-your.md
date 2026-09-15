---
id: TASK-there-is-no-way-to-step-through-the-marks-or-through-your
type: task
title: there is no way to step through the marks, or through your own prompts, while reading a conversation
status: active
severity: soft
always: false
summary: You can see your bookmarks in a list but you cannot walk through them in the document, and there is no way to jump from one of your own messages to the next.
summary_of: f087ed084ee4691a
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 52eae95a1e89cda7
plan: anchors
seq: "3"
state: done
priority: "1"
---

# there is no way to step through the marks, or through your own prompts, while reading a conversation

OWNER RULING 2026-09-15, option 3c — ALL THREE, because they are one mechanism and the first
alone immediately makes you want the second:
  — NEXT / PREVIOUS MARK, while reading the document.
  — NEXT / PREVIOUS OF HIS OWN PROMPTS — the turns shown as "You".
  — JUMP TO THE BYTE from the mark list, opening the document at the marked point.

HIS WORDS: "another features that would be helpfull is to jump to marks forward and backward as
well as the user prompts You and simillar helpfull navigations tools you will find as required
or will benefit the user while browsing."

MEASURED 2026-09-15: nothing in conversations.js steps the document by anything — not by mark,
not by role, not by byte. The only movement is the reader’s own scrolling and the search filter.

THE LAST CLAUSE IS AN INVITATION, NOT A BLANK CHEQUE. He asked for "similar helpful navigation
tools you will find as required". Anything beyond the three above must be justified from what a
reader on that screen cannot do today and OFFERED to him — not shipped because it seemed nice. A
control that does nothing a reader wanted is the defect this project already filed as D58.

THE BOUNDS THAT ALREADY HOLD AND STILL DO. The list is paged at BOUND_CAP_LIST (20) and the
document is long: navigation must work ACROSS the page bound, or say plainly that it does not.
Every write already returns the caret to the row it changed (confirm/1); navigation must obey the
same discipline — moving the reader is not an excuse to lose the caret. Every sentence needs a
key in BOTH string tables.
