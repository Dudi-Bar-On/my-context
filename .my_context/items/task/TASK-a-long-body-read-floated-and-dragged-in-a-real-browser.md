---
id: TASK-a-long-body-read-floated-and-dragged-in-a-real-browser
type: task
title: a long body read floated and dragged, in a real browser
status: active
severity: soft
always: false
summary: Have a person actually read a genuinely long item in the new floating panel, since automated checks would pass on short text and prove nothing.
summary_of: 132438b234e59601
scope: []
tags:
  - v2
  - ui
  - pane
  - e2e
  - docs
  - "plan:pane"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 5fcaca63ec2fc405
plan: pane
seq: "5"
state: todo
priority: "2"
source: owner, 2026-08-27
---

# a long body read floated and dragged, in a real browser

This item tracks state only. The task itself is Task 5 of docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-can-float.md, which carries the tests, the code and the commit message.

RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it. Playwright measures that the floated body is more than twice the width and that Escape restores it; a human reads a genuinely long item both ways.

PICK AN ITEM WITH A LONG BODY. The point of the whole feature is a wall of prose, and a two-line fixture would pass every assertion and prove nothing -- several of the pinned rules run to a page.

Stop every UI server before the e2e gate: two servers over one `.demo-corpus` produce failures belonging to nobody, and that cost two red runs on 2026-08-26.
