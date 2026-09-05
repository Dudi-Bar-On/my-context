---
id: TASK-the-tier-ribbon-needs-per-line-index-costs-and-an-ordered
type: task
title: the tier ribbon needs per-line index costs and an ordered candidate list
status: active
severity: soft
always: false
summary: One of the required charts cannot be drawn, because two facts it needs are never sent to the page and cannot be worked out there.
summary_of: 6c8c39568f4f893a
scope: []
tags:
  - "plan:ui1"
  - "seq:17b"
  - "state:doing"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: e54963993123e8c1
plan: ui1
seq: 17b
state: doing
priority: "1"
---

# the tier ribbon needs per-line index costs and an ordered candidate list

Second of the four charts the owner ruled must be drawn.

The four-tier ribbon (#ribbons, preview.ribbon, preview.ribbonn) draws each tier's admitted and spilled candidates as a track. Three of the four tracks are servable today - costs and tiersRun exist. The index track is not: it admits LINES, and per-line index costs are exposed by no endpoint.

The ghost lane needs more: the interleaved candidate order per tier, and full and spilled are two separate orders rather than one list split.

Both are read-model work. Neither can be reconstructed in the browser without re-implementing fitToBudget, which the screens agent correctly refused - a second implementation of the selector is how two surfaces come to disagree about what was injected.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, priority 1, and nothing supersedes it.

It is one of THREE open "the screen draws a thing no response can fill" gaps on the preview family, and the reconciliation found they have never been read together:
  plan:ui1     seq:17b  THIS ONE -- per-line index costs, and the interleaved candidate order per tier, for the ghost lane
  plan:screens seq:1s-a  the seen set, or the ids filtered by it, for gate ladder rung 5
  plan:ui1     seq:17c  the sweep curve -- RULED and now SUPERSEDED BY walk seq:7

All three are read-model work on the same request family, all three refuse to be reconstructed in the browser for the same reason (a second implementation of the selector is how two surfaces come to disagree about what was injected), and one of the three has already been ruled. Whoever builds walk seq:7 is in exactly the right file for the other two. DISPATCH THEM TOGETHER.

NO PARITY GATE CAN FIND ANY OF THEM. All three draw their element; the element is simply never bound to anything.
