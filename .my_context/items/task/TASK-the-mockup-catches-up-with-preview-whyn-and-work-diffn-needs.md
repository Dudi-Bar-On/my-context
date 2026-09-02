---
id: TASK-the-mockup-catches-up-with-preview-whyn-and-work-diffn-needs
type: task
title: the mockup catches up with preview.whyn, and work.diffn needs a ruling
status: active
severity: soft
always: false
summary: One sentence in the design has fallen behind the app, and another needs a decision about how it shows the formatting it describes.
summary_of: 3f148089f58937a0
scope: []
tags:
  - v2
  - ui
  - strings
  - mockup
  - tree-parity
  - "plan:walk"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 9c0ed7d049228334
plan: walk
seq: "16"
state: todo
priority: "2"
source: "plan:walk seq:1"
---

# the mockup catches up with preview.whyn, and work.diffn needs a ruling

Two keys the emphasis pass REFUSED to overwrite, 2026-08-25. Both are real and neither is an emphasis problem.

preview.whyn -- THE APP IS AHEAD. The mockup: "Composing the fix NEEDS a stable code on {m:injection()}; today the five causes differ only in English prose." en.js: "Composing the fix BINDS TO a stable code on {m:injection()}, so each cause is named by that code and not only by English prose." The app updated the sentence when the feature landed and the design of record did not. Under the ruling that more than the mockup is usually right, the MOCKUP changes.

work.diffn -- NEEDS A RULING. The mockup demonstrates the marks inline: "additions are {m:<ins>}tinted{m:</ins>}, removals are {m:<del>}struck{m:</del>}" -- actual {m:<ins>} and {m:<del>} ELEMENTS inside the sentence, so the reader sees the treatment in the sentence describing it. en.js writes the words flat. The grammar now carries bold and italic and carries neither of these.

THE QUESTION FOR THE OWNER: do {m:<ins>} and {m:<del>} become run markers too? They are the same shape as {m:b:} and {m:i:} and the same argument applies -- the design of record uses them and no string table can carry them. The counter-argument is that unlike emphasis they appear ONCE, in one sentence, and a marker built for one sentence is a grammar growing by accident.

Neither was touched. An emphasis pass that silently re-worded a string would be exactly the failure the refusal check exists to prevent.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it GAINED two things.

plan:screens seq:1s-f is SUPERSEDED INTO IT and holds the reasoning this task lacks: preview.whyn cannot be reworded in the app because strings-parity holds the key set equal to the mockup s data-t set in BOTH directions, so an app-side edit fails in the INVENTED direction. The mockup has to change first. That is why this is a mockup task and not a string task.

plan:rulings seq:49 carries the work.diffn half and states the stakes better: work.diffn is USER-FACING TEXT, not a comment. It tells the reader the diff is WORD-LEVEL; lineDiff is line-level. The screen describes itself wrongly to the person looking at it. seq:49 s other half -- watch-model.ts ~553 still saying "the 15-minute idle exit" when IDLE_MS became eight hours -- is a one-line fix that belongs elsewhere, and is the SAME wrong number the README carries (plan:rulings seq:48). One ruling, three unswept statements.
