---
id: TASK-the-stale-projection-refusal-names-a-command-and-will-not
type: task
title: the stale-projection refusal names a command and will not hand it over
status: active
severity: soft
always: false
summary: A refusal names the command that would fix it and makes you retype it, though the app has a copy button for exactly this.
summary_of: 878e5d47e9d0e551
scope: []
tags:
  - v2
  - ui
  - review
  - audit
  - "screen:watch"
  - "plan:walk"
  - "seq:32"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3ec1d5f4a5706534
plan: walk
seq: "32"
state: todo
priority: "2"
source: "plan:review seq:5, the functional UX review, 2026-08-25"
---

# the stale-projection refusal names a command and will not hand it over

FOUND 2026-08-25 by plan:review seq:5, the functional UX review, 2026-08-25, by making the projection stale the way ordinary work does and looking at what the screen offers.

THE MESSAGE IS GOOD. watch, ask and decay all report it and all say the same thing: "the audit projection is behind relative to its log, and this endpoint may not catch it up: syncing is a write, and answering from it anyway would present a partial history as a complete one. Run `mycontext audit` to build it; a read surface may not, because building it is a write." That is honest, it explains the WHY, and it names the cure.

AND THEN IT MAKES THE USER TYPE IT. Measured on all three screens in the refusing state: ZERO `.cmd` rows, ZERO copy buttons. The command appears only inside a prose sentence.

THIS UI ALREADY HAS THE AFFORDANCE. `lib/command.js` composes commands and the `.cmd` compose-and-copy row is used by `doctor`, `capture` and `work` today -- and `mycontext audit` takes no arguments, so it is the simplest possible case: a fixed string and a copy button. `plan:ui3 seq:11x` named exactly this as one of its three ways out, and the owner chose a different one (`plan:walk seq:28`, the writer keeps the projection current) -- BUT THAT DECLINED IT AS THE WHOLE ANSWER, not as an addition. The ruling s own words: "it may still be worth adding for the cases a writer cannot cover", and an imported log, a corpus edited outside the tool, or a deleted projection are exactly those cases.

SO THIS SURVIVES `walk/28` AND SHOULD BE BUILT WITH IT. After seq:28 this state gets rarer and does not disappear, and a rare refusal with no way out is worse than a common one, because nobody will have learned the cure.

FOR `plan:walk seq:12`: this is a refusal that leaves the list by becoming ACTIONABLE, not by being removed.
