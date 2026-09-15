---
id: TASK-every-row-in-the-mark-list-links-with-the-same-word-because
type: task
title: every row in the mark list links with the same word, because the go-to control is the session name
status: active
severity: soft
always: false
summary: In a list of marks from one conversation, every "go to" link reads the same, so none of them tells you where it goes.
summary_of: ab0244a2e82ac630
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - e2e/**
tags:
  - v2
  - ui
  - recall
  - "plan:anchors"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 73b9a1315c0b8504
plan: anchors
seq: "7"
state: todo
priority: "2"
---

# every row in the mark list links with the same word, because the go-to control is the session name

OWNER RULING 2026-09-15, the fourth of four the navigation lane offered.

THE CONTROL IS CORRECT AND ITS LABEL IS NOT. `a.convanchoropen` jumps to the marked byte and
works — `e2e/anchors.spec.ts` drives it and it is green. But the link TEXT is the session name,
so on a list where 24 marks sit in one conversation, all 24 rows read the same word and none of
them says what it does.

THE LANE DELIBERATELY DID NOT ADD A SECOND CONTROL, and that judgement stands: a second button
beside one that already does the job is D58 exactly — `the UI is present and changes nothing`.
THIS ITEM IS ABOUT THE LABEL, NOT A NEW AFFORDANCE. If the fix grows a control, it has gone wrong.

WHAT THE LABEL SHOULD CARRY is the thing that distinguishes one row from the next — the position
in the document, not the document’s name, which the list header already says once. A reader
scanning the list is choosing BETWEEN marks, so the link must differ between marks.

CONSTRAINTS: the sentence needs a key in BOTH string tables and must mirror in Hebrew with any
Latin or numeric part isolated, as the anchors card already does. And the accessible name is what
a screen reader announces — 24 links reading alike is worse there than on screen, where at least
the surrounding row differs.
