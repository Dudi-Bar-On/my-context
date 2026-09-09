---
id: TASK-the-list-row-cannot-link-its-lane-count-because-the-whole
type: task
title: the list row cannot link its lane count, because the whole row is already a button
status: active
severity: soft
always: false
summary: On the conversation list the number of helper agents is text you cannot click, and making it clickable means rebuilding the row control.
summary_of: 492c9408ca49807f
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:53"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 3a58ccb442c82a85
plan: archive
seq: "53"
state: done
priority: "2"
needs: archive/41
---

# the list row cannot link its lane count, because the whole row is already a button

DONE 2026-09-10. The row is no longer a button: `drawRow` builds
`div.row.convrow.convrowwrap` holding `button.convhead.convrowopen` (opens the session)
and, inside the counts line, `a.convlanelink` to `rosterHref(sessionId)`. The two are
SIBLINGS, so a press on the count cannot also fire the row - there is no propagation to
stop and therefore no `stopPropagation` to get wrong.

THE WHOLE-ROW TARGET IS KEPT BY `.convrowopen::after{position:absolute;inset:-1px}`, an
invisible overlay over the row's padding box AND its 1px border; the count is the only
hole in it, hoisted by `position:relative;z-index:1`. Measured with `elementFromPoint` in
both projects: the row's centre, its top corner, its far corner and a point 24px beside
the count on the count's OWN LINE all resolve to `.convrowopen`; the count itself
resolves to `a.convlanelink`.

KEYBOARD, measured with real key presses: the row's control is the tab stop, the count is
the next one, and Shift+Tab returns - the row, then the count, never the count
intercepting the row. Enter on the row control opens the session. The focus ring moved to
the wrapper (`.convrowwrap:has(>.convrowopen:focus-visible)`), so a keyboard reader still
sees the whole row light up rather than a ring round the title alone; `:focus-visible`
matches and the control's own outline is `none`, so there is one ring and not two. The
row control's accessible name narrowed from every word on the row to the title.

`rosterHref` and no second spelling - the same function `button.tvlanes` spends in the
document, and the same keyed strings (`conv.lane`/`conv.lanes`), so no new string was
added to either table. A real `<a>` with a real `href`, so middle-click, open-in-new-tab
and copy-link-address work with no script. Same tab: seq:15's new-tab ruling is about a
virtualised transcript, and a roster is a page of rows Back restores.

WHAT WAS MEASURED. Four new assertions-carrying tests (en/he x 2) x 2 projects = 8, all
green in chromium AND chrome. Each was proved non-vacuous by removing the thing it rests
on and watching it go red in both projects: the un-rebuilt row (8/8 red), the overlay rule
deleted with the markup left in place (4/4 red on centre/corner/far/beside), the `:has()`
ring zeroed (red on the ring), and the click handler moved back onto the container (red on
the "the row must not have fired as well" line).

ONE ASSERTION HAD TO BE REWRITTEN BECAUSE IT WAS VACUOUS. The first draft proved the row
had not also fired by asserting the document viewer's well was never built. With the
handler put back on the container that test PASSED: the row fired, set the hash to the
session, and the anchor's own default action then set it to the roster in the same task,
so the final screen was right while the defect was present. It now records every hash the
page passes through and asserts the session's address is not among them - which does go
red on that regression.

seq:41's own docblock said the list row could not carry this control and that the roster
was two clicks from the list. That paragraph is rewritten in place rather than left as a
second, superseded answer.
