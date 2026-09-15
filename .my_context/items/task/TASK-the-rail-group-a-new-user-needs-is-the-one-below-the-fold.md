---
id: TASK-the-rail-group-a-new-user-needs-is-the-one-below-the-fold
type: task
title: the rail group a new user needs is the one below the fold, reachable only by scrolling the rail
status: active
severity: soft
always: false
summary: The two screens that explain the tool sit below the visible list, behind a scrollbar that is easy to miss.
summary_of: e7097b6e02a5606e
scope:
  - src/ui/public/**
tags:
  - v2
  - ui
  - navigation
  - "plan:walk"
  - "seq:169"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 3d04de9d27fe5b2b
plan: walk
seq: "169"
state: todo
priority: "3"
---

# the rail group a new user needs is the one below the fold, reachable only by scrolling the rail

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`) raised it as finding 1.2. The consolidation carried report 1s other rail findings - 1.3 as row 95, 1.4 as row 89, 1.5 as row 90 - and carried this one nowhere. Found 2026-09-15 by the audit at `rulings/90`; the phrase "below the fold" does not appear in `reports/2026-09-13-the-consolidated-findings.md`.

WHAT REPORT 1 MEASURED, quoted: "The rails grouping is right; its ordering buries the reads. minor, 1 hour. Four groups - Injection what arrives / Evidence why it did or did not / Change composed, never run / Read - is a genuinely good taxonomy: it is organised by the users question, not by the data model. The problem is the fourth group. `Conversations`, `Help` and `Learn` sit below the fold at 1440 x 900 and are reachable only by scrolling the rail, whose only affordance is a scrollbar heavier than the nav items themselves. HELP AND LEARN ARE THE TWO THINGS A NEW USER NEEDS, AND THEY ARE THE TWO THINGS THEY CANNOT SEE. Recommend moving `Read` above `Change`, or pinning Help to the header."

WHY IT SURVIVES THE YEAR SINCE. Conversations has since become the screen that grew a blocker, an unpaged 684-row list and the mark flow - it is no longer the quietest item in the rail, and it is still in the group that falls off the bottom.

IT IS NOT A DUPLICATE OF `anchors/8`, which measures a card 1.3 screens below the fold INSIDE the Conversations screen. This is the rail itself, one level up.

VERIFY BEFORE FIXING: report 1 measured at 1440 x 900 on 2026-09-12 and the rail has gained entries since. Re-measure which entries fall below the fold before choosing between reordering and pinning.
