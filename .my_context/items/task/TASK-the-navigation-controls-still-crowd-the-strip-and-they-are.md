---
id: TASK-the-navigation-controls-still-crowd-the-strip-and-they-are
type: task
title: the navigation controls still crowd the strip, and they are the second of the three panels he specified
status: active
severity: soft
always: false
summary: Move the mark stepper, the message stepper and their counts into a floating panel of their own.
summary_of: d4625a7784caa4d2
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/panel.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:semantic"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 3765122aa735a450
plan: semantic
seq: "12"
state: todo
priority: "1"
---

# the navigation controls still crowd the strip, and they are the second of the three panels he specified

WHAT MOVES: the "Step to" kind picker, Previous/Next mark, Previous/Next of your own messages,
and the two counts beside them — "N marked point(s) here" and "N message(s) of yours here",
including the sentences that say how many are hidden by an active search.

THIS IS THE ONE THAT PAYS. The find panel’s own report names these counts as the residue still
sitting in the strip after search moved out. This is the item that collects that.

AND THE COUNTS ARE NOT DECORATION — they disclose. "599 more are in this conversation and the
search above is hiding them" is `INV-nothing-is-dropped-silently` spent on a screen. Moving a
disclosure into a panel a reader may have shut is a real question: answer it deliberately and
say what you chose. A count nobody can see is a count that was dropped.
THE OWNER SPECIFIED THREE PANELS ON 2026-09-16 AND ONLY ONE WAS FILED. His words:
"i want you to consider moving to dialogs by subjects the navigations 1, the search 2 and the
copy 3 - three different subjects on three different dialogs opend from the right mouse button
menu, could be a little bit transparent, movable on screen, stays on screen while you can look at
the viewer and closed uppon clicking it’s close button as a standard window."

Search shipped as the TEMPLATE (`semantic/9`, then `semantic/11`). Navigation and copy were
promised in the same breath and then never written down — they lived in one sentence of a reply
and nowhere else, and would have been lost if he had not asked. That is the same defect the board
work of 2026-09-16 exists to prevent, committed by the session that fixed it, hours later.

── THE FRAME EXISTS AND IS PROVEN ─────────────────────────────

`src/ui/public/lib/panel.js` was built as a reusable frame with one caller, deliberately, so that
these two would be mostly a move rather than a build. It owns: `<dialog>` with `show()` and NEVER
`showModal()` (a modal dialog makes the page behind it inert and the viewer would be dead); the
hand-wired Escape, because only a modal dialog closes on Escape by itself; drag with pointer
capture rather than a document listener; logical-property placement with one RTL reflection; a
`localStorage` place with every read guarded; a clamp onto a narrower screen; bring-to-front; and
the focus hand-back. A caller supplies `name`, `title`, `closeLabel`, `onClose`, `fallbackFocus`.

Search borrows its controls from the strip and gives them back. Do the same.

── THE TEST OF WHETHER IT LANDED ───────────────────────────

THE STRIP MUST SHRINK. Measured at 1280×1000 on the live session: chrome above the viewer was
372.69 px before the search panel and 338.30 px before its second round; it is 230.53 px now in
English and 166.75 px in Hebrew. Report the before and after again — if the strip does not
shrink, the change has not landed, and that is the whole reason these panels exist.

AND ONE MEASUREMENT IS ALREADY WAITING FOR THIS ITEM: `reports/2026-09-16-the-find-panel.md` §2.3
states that the residue left in the English strip IS THE MARK AND MESSAGE COUNTS — which belong
to the navigation panel. That is the number this work collects.

── WHAT MUST NOT REGRESS ─────────────────────────────────

  — Every control keeps its keyboard shortcut and its `aria-keyshortcuts`. The keys are drawn on
    the controls (`N`, `Shift+N`, `U`, `Shift+U`, `K`) and a reader uses them without the menu.
  — The right-click menu keeps working as the opener, and a control that MOVES into a panel must
    not vanish from the keyboard while the panel is shut.
  — Both languages, driven. A panel’s stored place is measured from the RIGHT edge in Hebrew, and
    that is already proven in `panel.js`’s tests — do not reinvent it.
  — Several panels open at once, each remembering where it was dragged, clicking one brings it to
    the front. All three are already in the frame.
