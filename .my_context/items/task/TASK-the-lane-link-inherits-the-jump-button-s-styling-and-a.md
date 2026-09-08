---
id: TASK-the-lane-link-inherits-the-jump-button-s-styling-and-a
type: task
title: the lane link inherits the jump button's styling, and a sentence-length label is not a jump button
status: active
severity: soft
always: false
summary: Giving the control that opens a helper agent's transcript a look of its own, instead of borrowing the one the scroll buttons wear.
summary_of: 521e57d2b8fcba54
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:31"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: "1556611255824214"
plan: archive
seq: "31"
state: todo
priority: "3"
---

# the lane link inherits the jump button's styling, and a sentence-length label is not a jump button

plan:archive seq:15 shipped the link that opens a subagent's transcript from the turn that dispatched it. It is a real anchor with target=_blank and it wears .tvjump — the class the Top/End buttons wear — because src/ui/public/styles.css was held by another lane on 2026-09-09 and could not be edited. This item is what that borrowing owes back.

WHAT IT LOOKS LIKE, seen in the browser on the owner's own session at 30% of a 1,001,138px document: the control reads 'Open this agent's transcript in a new tab — 19 records' in a bordered monospace box with the user agent's underline through it. It is legible and it is reachable; it is also THREE affordances for one link — a border, a monospace face meant for identifiers, and an underline — where the app's own vocabulary would give it one.

WHAT IT SHOULD GET, and it is small: a .tvlane rule of its own beside .tvjump in the .tv block. A sentence-length label wants var(--sans) rather than var(--mono), which .tvjump uses because Top and End are two words. Whether the underline or the border survives is the choice to make; keeping both is the thing to stop. The same applies to .tvlanehome on a lane document's head, which is one full sentence in a mono box.

WHY IT IS NOT A REWRITE. Nothing about the behaviour changes: the href, the target, the rel, the label and the string keys all stay. This is a stylesheet rule and the two class names are already on the elements — e2e/conversations.spec.ts names a.tvlane and a.tvlanehome today.

DO NOT take the chance to make it a button calling window.open. laneLink's own header records why an anchor was chosen: middle-click, ctrl-click, copy link address and the keyboard all work by construction, a popup can be blocked, and none of that is worth a font.
