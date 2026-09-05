---
id: TASK-the-tutorials-screen-gets-a-reader-not-only-a-checklist
type: task
title: the Tutorials screen gets a reader, not only a checklist
status: active
severity: soft
always: false
summary: The Tutorials screen gains a reader that opens one tutorial's markdown through the app's existing renderer, instead of only listing checkmarks.
summary_of: b72f3c8ed076f403
scope:
  - src/ui/public/screens/tut.js
tags:
  - v2
  - tutorials
  - ui
  - docs
  - "plan:tuts"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 0bd308d037c362e6
plan: tuts
seq: "4"
state: todo
priority: "2"
needs: tuts/2, tuts/3
---

# the Tutorials screen gets a reader, not only a checklist

Step 4 of six in docs/superpowers/plans/2026-09-05-tutorials-are-served-and-browsed.md. Needs the two endpoints, tuts/2 and tuts/3.

tut.js draws the widened list grouped Basic and Advanced (replacing the six-row TUTORIAL_ROWS loop, keeping the existing done/todo/unmeasured cellSpec unchanged), draws the Hebrew rollup line from heRollup, and adds a reader view: clicking a row fetches /api/doc/:id and renders it through markdownNodes imported from /screens/docs.js -- the same cross-module import app.js already performs for item bodies, so this remains the one renderer in the app rather than a second one written for this screen. A short on-screen sentence near the list states what the done chip means and does not mean, so the distinction is not left only in a code comment.
