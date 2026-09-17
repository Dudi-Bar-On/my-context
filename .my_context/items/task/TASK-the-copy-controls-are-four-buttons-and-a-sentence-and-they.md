---
id: TASK-the-copy-controls-are-four-buttons-and-a-sentence-and-they
type: task
title: the copy controls are four buttons and a sentence, and they are the third panel he specified
status: active
severity: soft
always: false
summary: Move the copy-what-you-marked controls into a floating panel of their own.
summary_of: ad476455787d0bab
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
  - "seq:13"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: a1f9d324c65a357f
plan: semantic
seq: "13"
state: todo
priority: "1"
---

# the copy controls are four buttons and a sentence, and they are the third panel he specified

WHAT MOVES: "Copy what you have marked:" and its four controls — to paste into a prompt, to
paste as it looks, the exact record, and Reconstruct a subject — together with the sentence
that explains what each one produces.

THE SENTENCE IS THE SUBJECT, NOT THE BUTTONS. "The first is the one to reach for: it is the
text as the record holds it, with no page formatting in it, and a command comes out as the
command." That explanation is why the four exist and it is currently drawn as grey prose in a
strip a reader skims. In a panel it can be what it actually is — the label on each choice.

AND THREE OF THE FOUR ARE DISABLED UNTIL SOMETHING IS SELECTED, which is honest and invisible:
a reader who has selected nothing sees four greyed controls and no reason. A panel has room to
say why.

`Reconstruct a subject` is not a copy at all — it opens the retrieval surface
(`docs/capabilities/06-retrieval.md`). Decide whether it belongs in this panel or elsewhere and
say which; it sits with the copy controls today for reasons of space, not of meaning.
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
