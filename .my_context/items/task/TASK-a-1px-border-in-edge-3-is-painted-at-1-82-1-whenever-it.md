---
id: TASK-a-1px-border-in-edge-3-is-painted-at-1-82-1-whenever-it
type: task
title: "a 1px border in --edge-3 is painted at 1.82:1 whenever it lands on a half pixel, and it often does"
status: active
severity: soft
always: false
summary: Three code and quote boxes draw a border that is half as visible as intended whenever it falls between screen pixels, so it needs either a brighter colour or a thicker line.
summary_of: 72f9402ee0476bfb
scope:
  - src/ui/public/styles.css
  - e2e/frame-paint.spec.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:52"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: b0a9aed4567c3edf
plan: archive
seq: "52"
state: todo
priority: "1"
needs: archive/47
---

# a 1px border in --edge-3 is painted at 1.82:1 whenever it lands on a half pixel, and it often does

MEASURED 2026-09-09 by the seq:47 lane and re-measured in the main session the same day. Three
boxes in the viewer carry a 1px border in --edge-3 #6e6e7e: the fence box (.tvsaid pre), the
author’s own thematic break (.tvsaid hr) and terminal output (.tvterm). The TOKEN is 3.79:1 on
--sink. THE PAINT IS 1.82:1 whenever the border lands on a fractional device row, because the
browser antialiases it to a flat 50% blend #3f3f49 - a rounding error away from the --edge the
owner said he could not see at all.

AND IT IS INTERMITTENT, WHICH IS THE PART THAT MATTERS FOR HOW IT IS TESTED. The same .tvsaid hr
painted the full 3.79 token in one run and the 1.82 blend in the next, with no code between them,
and .tvterm passed alone and failed in a full-file run. The position is decided by whatever prose
precedes the box, so it is not a constant of the stylesheet.

A THEMATIC BREAK IS THE WORST CASE and is worth stating separately: a collapsed table ruling paints
57% at the token and 43% at the blend, so more than half of it still reads; a rule is ONE line, so
when it blends there is no compensating half anywhere and every pixel of it is 1.82.

SO 3:1 CANNOT BE MET AT 1px IN THIS COLOUR, and that is the decision. Two ways out and they are the
owner’s to choose between:
  - A BRIGHTER TOKEN, so that the 50% blend itself clears 3.0. This is what #c9c6d4 did for the
    table frame, where the owner named the value and every painted pixel cleared the bar.
  - A 2px BORDER, so a whole device row is always painted at the token whatever the offset, and the
    blend is a fringe beside it rather than the whole line.

THREE TESTS IN e2e/frame-paint.spec.ts STAND fixme ON THIS ITEM, asserting the bar (3:1 on PAINT,
not on token) rather than asserting the defect. The lane first asserted that the blend always
occurs, which made the gate depend on where a line happened to fall; that is precisely how
cssom-restatement spent a day red and taught four lanes to record it as known and work around it.
Deleting the word fixme is the gate once this is ruled.

AND .tvjump IS THE SAME QUESTION ONE BOX OVER, measured and deliberately not fixed. Its --edge
border is 1.49:1 on its own --panel-2 fill and 1.20:1 on the ground actually painted outside it;
painted, its edges antialias to 1.09:1. Every wearer is written by conversations.js - Top, End, "N
new below", the three copy buttons and close-tab - so the reach is the archive screen and nothing
else. --edge-3 there would REPORT 3.35 and DELIVER 1.63, which is seq:38’s half-delivered fix
repeating itself. It needs the same answer as the three boxes above, and should be ruled with them.

ONE MEASUREMENT THAT CORRECTS A HABIT OF THIS PRODUCT, recorded because it invalidates numbers
elsewhere: --panel, --panel-2 and --paper are NOT what a control on a card sits on. .card and .pane
are translucent (--pane-tint .56-.64) over body{background:var(--ground)}, whose first blob is
#433580 at 14% 6% - exactly where the transcript bar is - so the painted ground there is about
rgb(40,41,94) and it MOVES WITH POSITION ON THE PAGE. Every contrast ratio in this product computed
against those three tokens for anything on a card is a claim about a colour that is not painted.

AND ONE DEAD RULE FOUND WHILE HERE, the same specificity shape as the defect just fixed: .ghdoc th
and .ghdoc td in styles.css are dead - doc.html deliberately loads no /styles.css and no other page
renders .ghdoc. They are (0,1,1), so they would lose to the app table base the same way .tvsaid td
did if they ever became live. Decide whether they are deleted or made live; do not leave a rule
that looks like it works.
