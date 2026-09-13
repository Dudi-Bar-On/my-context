---
id: TASK-the-announcement-slot-on-conversations-is-created-correctly
type: task
title: the announcement slot on Conversations is created correctly and written to nowhere
status: active
severity: soft
always: false
summary: The page builds a place to announce that a change succeeded and then never puts anything in it, so screen-reader users hear nothing.
summary_of: a96e953511f4f5c6
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - aria-live
  - empty-surface
  - "plan:walk"
  - "seq:166"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 271a1076d980fa87
plan: walk
seq: "166"
state: todo
priority: "2"
---

# the announcement slot on Conversations is created correctly and written to nowhere

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) as row 26 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `.convmarksaid` is an `aria-live="polite"` element created at `conversations.js` · where `.convmarksaid` is created (line 1144) and WRITTEN TO NOWHERE IN THE FILE. Report 2 confirmed it empty in the browser after a successful write.

WHY IT IS UNDER D50 RATHER THAN THE WRITE-CONFIRMATION SUBJECT. D50 is a surface built to carry an explanation with nothing filling it. The slot is correct: the right element, the right politeness, created at the right moment. Everything about it is right except that nothing ever puts a sentence in it.

THE CONSEQUENCE. A screen-reader user gets silence after a successful write, from a live region that exists specifically to prevent that.
