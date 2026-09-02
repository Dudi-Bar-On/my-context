---
id: TASK-the-gate-ladder-can-never-show-rung-5-because-the-seen-set
type: task
title: the gate ladder can never show rung 5, because the seen set rides on no response
status: active
severity: soft
always: false
summary: One step of the diagram explaining why something was left out can never light up, because the fact behind it never reaches the page.
summary_of: b48be67fd82e015d
scope: []
tags:
  - "plan:screens"
  - "seq:1s-a"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 2b20ff0de6860aef
plan: screens
seq: 1s-a
state: done
---

# the gate ladder can never show rung 5, because the seen set rides on no response

Found 2026-08-23 while building the ladder (screens plan, seq 1s). InjectionVerdict.gate's own note directs a full ladder to be composed from four sources: ItemSummary.gate for rungs 1, 2 and 4, Selection.focus.hidden for rung 3, and Selection.spilled for rung 6. Four of the six. Rung 5, seen, is decided server-side out of the session id inside select() and appears in no response body at all, so screens/preview.js draws the rung and can never bind an item at it. The screen says so in its own header rather than leaving a reader to infer it from a rung nobody ever lands on. What it needs: the seen set, or the ids filtered by it, on /api/select - the same shape Selection.focus.hidden already has for rung 3. Nothing here can be reconstructed in the browser: the seen filter runs before budgeting and its input is a file the page never reads.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and nothing supersedes it. It is the only open API gap in this plan and no walk task covers it.

Checked against every open task in plan:walk, plan:ui1, plan:ui3 and plan:api: none asks for the seen set on /api/select. The walk never found it because the walk compares element trees, and rung 5 is DRAWN -- it is simply a rung nothing can ever land on, which no parity gate can see. That is the durable pattern this project keeps meeting: a gate measures what it was pointed at.

WHAT IT NEEDS is unchanged: the seen set, or the ids filtered by it, on /api/select, in the same shape Selection.focus.hidden already has for rung 3. Nothing here can be reconstructed in the browser.

IT IS A SIBLING OF plan:ui1 seq:17b and seq:17c -- three separate "the screen draws a thing the response cannot fill" gaps on the same screen family. Whoever builds one should read all three.
