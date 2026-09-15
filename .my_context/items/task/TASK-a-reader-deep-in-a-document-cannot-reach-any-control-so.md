---
id: TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so
type: task
title: a reader deep in a document cannot reach any control, so actions need a right-click menu and keyboard shortcuts as well as buttons
status: active
severity: soft
always: false
summary: The buttons are off the screen when you are deep in a document, so every action needs to be reachable where you are — by right-click and by keyboard, without taking the buttons away.
summary_of: e1c084b7a94c0061
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - src/ui/public/styles.css
  - e2e/**
tags:
  - v2
  - ui
  - recall
  - a11y
  - "plan:anchors"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: ccca52d94f6e1e1e
plan: anchors
seq: "4"
state: todo
priority: "1"
---

# a reader deep in a document cannot reach any control, so actions need a right-click menu and keyboard shortcuts as well as buttons

OWNER REQUEST 2026-09-15, after using the navigation the same day it shipped: "i see the navigation
buttons you added but when a user is brousing in the viewer he can not see the buttons so we have to
find solutions like right mouse button, a popup window, keboard shortcuts - in general all the
actions that have buttons and fields to fill like for example the search would be better to have
them also or only (you decide) on a popup window triggerd by a right mouse button menue and a
keyboard shortcut."

HE IS DESCRIBING A REAL AND NARROW DEFECT. The controls exist and are correct; they are simply not
WHERE HE IS. A reader deep in a long transcript has scrolled the card that holds the buttons off
the screen, so an action that is one click away in principle is a scroll-up, a click and a
scroll-back in practice — and that is per action, on a document where the whole point is to keep
reading.

THE RULING HE ASKED ME TO MAKE, AND IT IS "ALSO", NOT "ONLY".

A right-click-only action is INVISIBLE. Nothing on the screen says it exists, so a reader who does
not already know never finds it — which is D58, `the UI is present and changes nothing`, arriving
from the other direction: not a control that does nothing, but a capability with no control. The
buttons are the DISCOVERY path and they stay.

So three routes, each with a job the others do badly:
  — THE BUTTON tells a reader the capability exists. It is how you learn.
  — THE KEYBOARD is for someone who already knows. It is how you go fast.
  — THE RIGHT-CLICK acts ON THE THING UNDER THE CURSOR, which is the one job neither of the others
    does at all — "mark THIS turn", not "mark the turn I must first go and select".

WHAT MUST BE REACHABLE THIS WAY, and he named the shape rather than a list: every action that today
has a button or a field. On Conversations that is at least — mark this point, relabel, take back,
put back, run the automatic pass, the search box, and the navigation jumps from `anchors/3`.

THE CONSTRAINTS THAT DECIDE THE IMPLEMENTATION, and none of them is optional:

  1. A KEYBOARD SHORTCUT MUST NOT STEAL A KEY THE READER IS USING. There is a search field and a
     rename field on this screen; a shortcut that fires while a field has focus eats the keystroke.
     Every binding must be inert inside an input, and that must be ASSERTED, not assumed.
  2. ESCAPE IS ALREADY SPOKEN FOR, TWICE. `confirm/5` bound Escape on the rename box with
     `stopPropagation` precisely so the document-level Escape — which closes the item pane — never
     sees it. A third Escape meaning is not available. Do not take it.
  3. A CONTEXT MENU MUST NOT REPLACE THE BROWSER’S unless it offers something better. Suppressing
     the native menu costs the reader copy, open-in-new-tab and inspect. Suppress it only over the
     elements where this screen genuinely has actions, and leave it alone everywhere else.
  4. IT MUST BE REACHABLE WITHOUT A MOUSE. A menu that only opens on right-click is the same
     defect one layer down — a keyboard user cannot reach it. The context-menu key and
     Shift+F10 are what a browser already sends; honour them.
  5. FOCUS RETURNS WHERE IT CAME FROM when the menu closes, opened or dismissed. `confirm/1`
     measured 47 tab stops lost on a write and fixed it; a menu that drops the caret re-opens that
     wound.
  6. EVERY SENTENCE NEEDS A KEY IN BOTH STRING TABLES, and the menu must lay out RTL in Hebrew —
     including which side it opens on.

AND IT MUST SAY WHAT THE SHORTCUTS ARE. A keyboard route nobody can discover is the same defect as
a right-click-only action. The binding belongs on the button’s own title or beside it, so the
discovery path teaches the fast path.

NOT IN SCOPE, said plainly: this is the Conversations screen. Whether the same treatment is owed on
Library, Composer and the rest is a separate question and a bigger one — answer it after this has
been used.
