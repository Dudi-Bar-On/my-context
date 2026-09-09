---
id: TASK-the-list-row-cannot-link-its-lane-count-because-the-whole
type: task
title: the list row cannot link its lane count, because the whole row is already a button
status: active
severity: soft
always: false
summary: On the conversation list the number of helper agents is text you cannot click, and making it clickable means rebuilding the row control.
summary_of: ca2bf9e20c71935a
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:53"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 81c466556a7ce5cb
plan: archive
seq: "53"
state: todo
priority: "2"
needs: archive/41
---

# the list row cannot link its lane count, because the whole row is already a button

FOUND 2026-09-09 by the seq:47 lane, which was asked to write this rule and correctly refused to,
because the CSS alone would have been dead and the control does not exist.

THE LIST ROW SAYS "N helper agents" AND THE NUMBER IS NOT A LINK. seq:41 made the count a link in
the DOCUMENT; the LIST row still only says it. The obvious repair - put an anchor inside the row -
is invalid markup, because drawRow makes the WHOLE ROW a button element and an anchor cannot live
inside one.

SO THE WORK IS NOT CSS, IT IS THE ROW CONTROL. Writing .convrowwrap and .convlanelink on their own
ships rules nothing wears. Making the count clickable means un-buttoning .convrow and rebuilding the
row as a container with two controls in it.

AND THAT IS WHY IT IS ITS OWN ITEM RATHER THAN A LINE IN seq:47: conversations.spec.ts rests 66
assertions on the current row, and the row click affordance - the whole row being the target - is a
behaviour a reader already has. A change that makes the count reachable and makes the row harder to
hit is a worse screen, so the replacement has to keep the whole-row target AND add a second one
inside it, which is a keyboard and focus-order question as much as a markup one.
