---
id: TASK-the-focus-and-session-triggers-open-no-dialog-so-two-title
type: task
title: the focus and session triggers open no dialog so two title-bar controls do nothing
status: active
severity: soft
always: false
summary: Two buttons in the title bar do nothing when pressed, because the panels they were meant to open were never built.
summary_of: b128ff91c02624e1
scope: []
tags:
  - v2
  - ui
  - shell
  - walk
  - "plan:walk"
  - "seq:115"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/t2.md"
source_anchor: null
source_checksum: 898294416f23f2c2
valid_from: 2026-08-31
valid_until: null
checksum: e00456184dabce96
plan: walk
seq: "115"
state: done
priority: "1"
source: owner ruling, 2026-08-31
---

# the focus and session triggers open no dialog so two title-bar controls do nothing

> > Owner ruling 2026-08-31. Both triggers exist with correct ARIA and neither opens anything.
>
> **The state**
>
> `#focusbtn` and `#sessbtn` both carry `aria-haspopup="dialog"` and point at `#focuspop` and `#sesspop`. **Neither dialog has markup anywhere.** `app.js` records the refusal in its own header: the mockup names those ids *"only as a target, not a source"*, and the task that built the triggers declined to invent the dialogs.
>
> That was the right call then. It is a defect now: two controls in the title bar do nothing when pressed.
>
> **What each is for**
>
> * **Focus** narrows what gets injected. `mycontext focus [tags…] [--show|--clear] [--scope --category --preview --relations]` already does it, and the screens already read the result — the preview's gate ladder has a `focus` rung drawing `focus.hidden`. The dialog sets what the CLI sets.
> * **Session** picks which session a screen reads. Its absence has a measured consequence: `plan:walk seq:35` found that `ctx.session()` is always the default, so **Injected now can only ever show one session**, and its e2e had to mount the screen module rather than navigate to it.
>
> **Rulings**
>
> * **The focus dialog composes; it does not write.** Follow the Review queue's pattern — a choice composes a command line, one Execute runs it behind the approval boundary. Focus changes what Claude receives on the next event; that is exactly the kind of change the owner applies.
> * **The session picker is a READ.** It changes which session the screens ask about and writes nothing, so it needs no boundary.
> * `loadSessions()` already computes and exposes the real default and cold session — wire the dialog to that rather than re-deriving it.
>
> **Done when**
>
> Both dialogs open, are keyboard-reachable and dismissible, set `aria-expanded` truthfully, and a browser test drives each to a changed screen state — for the session picker, that Injected now shows a session other than the default.
