---
id: TASK-no-screen-has-hover-or-click-help-and-most-buttons-carry
type: task
title: no screen has hover or click help, and most buttons carry none at all
status: active
severity: soft
always: false
summary: Add short hover and click help to buttons and other controls across the app screens, following the pattern the status strip already uses.
summary_of: 5f80be3f3884a90a
scope: []
tags:
  - "plan:walk"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/task-body.txt"
source_anchor: null
source_checksum: d305818acc0665ed
valid_from: 2026-09-02
valid_until: null
checksum: 31ccd18c167f249e
plan: walk
state: todo
---

# no screen has hover or click help, and most buttons carry none at all

> The owner: "add a task for adding simple short help upon hovering, immediate candidates are buttons but not limited too, find all the places and controls that deserves adding it, maybe also on every screen some help when clicking or hovering over some question mark icon?"
>
> Counted across my-context/src/ui/public/screens/*.js: roughly 35 buttons (el('button', ...) call sites), of which about 10 carry any title text. Per screen: config 9 buttons, 0 titled. simulate 6, 0. graph 4, 0. ask 2, 0. preview is the best at 4 of 6. No question-mark or help affordance exists on any screen today, and no .sub note under a screen title stands in for one.
>
> The strip's field hovers, at the end of drawContext() in my-context/src/ui/public/app.js, are the model to follow, and the owner approved them by name (2026-09-01: "WINDOW text hover is great, do the same for all of the other fields exactly"). Two rules from the keyed() helper's comment there are binding on this work, in substance:
>
> A TOOLTIP IS NOT A CARRIER. It is invisible to touch, to keyboard-only navigation and in print, so nothing may live only there. Every fact a reader must act on stays on the visible surface; hover help is additive only.
>
> A tooltip that restates the visible text is worse than none — it teaches the reader that hovering is not worth doing. The strip's rule is that a hover says what the control does that its label cannot: where a number comes from, what a press will change, the bound the label had to drop. A pass that puts title="Copy" on a button labelled Copy satisfies a count and fails the purpose.
>
> This task should decide, not answer in advance, three things before or during the doing:
>
> The question-mark affordance: per screen or per section? A hover-only trigger breaks the carrier rule above, since it is unreachable by keyboard and invisible on touch — it would need to be a real focusable, clickable control if it exists at all. Consider whether the existing .sub note under each screen title is already the right home for what a question-mark would say, rather than adding a new control.
>
> Where the text lives: every user-facing string needs a key in both strings/en.js and strings/he.js, and strings-parity is bidirectional. Thirty-five controls is seventy strings at one key per control. Decide whether there is a cheaper shape — help keyed by control id or derived from something that already exists — or whether one key per control is simply the honest cost.
>
> The relationship to mycontext help: the CLI and MCP already carry topic help. A hover that duplicates a help topic is a second copy that will drift from it. Decide whether screen help should point into the help system rather than restate it.
>
> Scope: buttons are the starting point, not the boundary, per the owner's "not limited too." Selects, the tag input, chips that filter, the session and focus dialogs, and the strip fields already covered are all candidates. This task does not enumerate all ~35 controls; it names the method for finding them (grep el('button', ...) and equivalent control constructors per screen, per the counts above) and the quality bar above, and leaves the per-control text to the doing.
