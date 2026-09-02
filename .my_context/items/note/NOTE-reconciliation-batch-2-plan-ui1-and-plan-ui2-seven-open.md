---
id: NOTE-reconciliation-batch-2-plan-ui1-and-plan-ui2-seven-open
type: note
title: "reconciliation batch 2: plan:ui1 and plan:ui2, seven open tasks verdicted"
status: active
severity: soft
always: false
summary: A second batch of open work read, finding three separate items that are really one problem and a hold-up that had quietly stopped applying.
summary_of: 7ac7fb0a007f7fda
scope: []
tags:
  - v2
  - ui
  - reconciliation
  - "plan:walk"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: d9d21699836d889f
---

# reconciliation batch 2: plan:ui1 and plan:ui2, seven open tasks verdicted

plan:walk seq:23, 2026-08-25.

  ui1 17c  SUPERSEDED  by walk/7 -- it asked for a ruling and got one, 2026-08-24
  ui1 18e  DONE        settled by fact: graph.js exists and uses the mockup s --edge-3
  ui1 17b  STANDS      read-model work; a sibling of screens/1s-a and ui1/17c
  ui1 17f  STANDS      owner ruling, priority 3; the inverse of screens/10s
  ui2 5r   STANDS      ITS BLOCKER IS STALE -- the mockup freeze is over
  ui2 12k  STANDS      mockup session
  ui2 10p  STANDS      ruled to stay; not work, and not a refusal to delete

THREE FINDINGS WORTH MORE THAN THE SEVEN VERDICTS.

ONE. THREE TASKS ARE THE SAME PROBLEM AND HAVE NEVER BEEN READ TOGETHER: ui1/17b (per-line index costs and the candidate order), screens/1s-a (the seen set for gate ladder rung 5) and ui1/17c (the sweep curve, now ruled). Each is "this screen draws an element the response cannot fill". Each refuses to be reconstructed in the browser for the same reason. NO PARITY GATE CAN FIND ANY OF THEM, because all three DRAW the element -- it is simply never bound. Whoever builds walk seq:7 is already in the right file for the other two.

TWO. A STALE BLOCKER WAS HOLDING REAL WORK. ui2/5r is blocked by port/95 pending review of the tree-parity inventory. That review happened, with the owner, screen by screen. Every task blocked on the mockup freeze is unblocked; what remains is that the mockup is the owner s file, which is a different constraint and a much smaller one.

THREE. THE MOCKUP SESSION IS FOURTEEN ITEMS, NOT SIX. Reported to the owner as six. Batch 1 found three more in plan:screens; batch 2 found two more here (ui2/5r, ui2/12k) and the two mockup edits already inside plan:walk (seq:3, seq:6) had been counted as ordinary open work.
