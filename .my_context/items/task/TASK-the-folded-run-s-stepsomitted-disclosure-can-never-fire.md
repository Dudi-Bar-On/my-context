---
id: TASK-the-folded-run-s-stepsomitted-disclosure-can-never-fire
type: task
title: the folded run's stepsOmitted disclosure can never fire, because STEP_CAP equals the run cap
status: active
severity: soft
always: false
summary: A folded run of machinery can never leave a step out, so the line that would say it had, and the string behind it, are unreachable.
summary_of: 0a6cd02f579f160d
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:21"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: f8cea5daf731f689
plan: archive
seq: "21"
state: todo
priority: "3"
---

# the folded run's stepsOmitted disclosure can never fire, because STEP_CAP equals the run cap

Found 2026-09-08 by the lane that removed the document's TEXT caps (`plan:archive seq:7`'s
remainder), while checking every reader of a field before deleting it. It is the same SHAPE of
defect the owner ruled on that day — a screen disclosing a limit — with the opposite cause: this
one cannot fire at all.

THE ARITHMETIC, in `src/ui/read-model-conversation-document.ts` — cite `readNodes` and the
`open.steps.length < STEP_CAP` branch, not a line number.

  - `STEP_CAP` is declared as `= WORK_RUN_CAP`, which is 40.
  - `readNodes` closes the open run BEFORE it takes a record: `if (open !== null && open.span >=
    WORK_RUN_CAP) closeRun()`. So a run's `span` never exceeds 40.
  - one record pushes one step, so `steps.length === span` always.
  - therefore `steps.length < STEP_CAP` is true on every record that ever reaches it, and
    `stepsOmitted` is `0` for every node this endpoint has ever produced.

WHAT IS DOWNSTREAM OF IT. `src/ui/public/screens/conversations.js` — `drawWork` draws
`conv.doc.stepsOmitted` when `body.stepsOmitted > 0`, so that branch is unreachable; the string
exists in BOTH tables and is delivered to neither reader; and after the text caps were removed
`.tvcut` in `styles.css` has no other live call site, so the rule is dead as well.

WHY THIS IS NOT SIMPLY DELETED HERE. The lane that found it had a ruling to carry out about a
DIFFERENT cap and deleting a third one in the same change would have made the diff argue two
things. And there is a real question underneath it that a deletion would answer by accident: the
two constants are tied — `STEP_CAP = WORK_RUN_CAP` — so `stepsOmitted` is dead only for as long as
they stay equal. Someone raising `WORK_RUN_CAP` alone would bring it back to life.

THE THREE OPTIONS, for whoever takes it:

  1. DELETE `STEP_CAP`, `stepsOmitted`, `conv.doc.stepsOmitted` from both tables, and `.tvcut`.
     Honest, smallest, and removes the coupling by removing one side of it.
  2. KEEP the field and make the identity explicit — a test asserting `STEP_CAP >= WORK_RUN_CAP`
     with the argument written down, so the dead branch is dead ON PURPOSE and a future edit to
     either constant fails rather than quietly re-enabling an untested path.
  3. DECIDE THE FOLD IS TOO BIG. `WORK_RUN_CAP` exists so a fold stays openable; if forty steps is
     the wrong number for the BODY even though it is the right number for the RUN, then `STEP_CAP`
     should be smaller than it and `stepsOmitted` starts firing — which is a product question
     about how much a reader wants inside one `<details>`, not a code question.

MEASURED, so option 3 is decided on numbers rather than taste: on the owner's own transcript,
2026-09-08 — 66,976,537 bytes, 28,998 records, 5,076 nodes — the largest folded run holds 40 steps
and 75,296 characters, and the largest single step is 58,888 characters. A fold of forty is real
and it is opened by a reader who asked for it.

NOTE THE RELATED FACT that is NOT this defect and must not be folded into it: `WORK_RUN_CAP` itself
is not a cap the owner's no-limit ruling reaches. A run longer than forty becomes CONSECUTIVE work
nodes, each carrying its true `span`; nothing is dropped and nothing is summarised away. That is
recorded in the constant's own comment and it stands.
