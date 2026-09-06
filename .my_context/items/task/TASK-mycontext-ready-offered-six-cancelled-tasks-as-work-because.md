---
id: TASK-mycontext-ready-offered-six-cancelled-tasks-as-work-because
type: task
title: mycontext ready offered six cancelled tasks as work, because it never read status
status: active
severity: soft
always: false
summary: The command that answers what to work on was listing tasks that had been abandoned, and no author could have prevented it.
summary_of: e8683c43820e5f47
scope:
  - src/core/needs.ts
tags:
  - v2
  - cli
  - workflow
  - "state:done"
  - "verified_on:2026-09-06"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: be415bd9e6b6d50d
state: done
verified_on: 2026-09-06
---

# mycontext ready offered six cancelled tasks as work, because it never read status

Found 2026-09-06 by a delegated worker that read its own cancelled task back out of `mycontext
ready` and reported it rather than working around it.

WHAT WAS WRONG. `readyReport` skipped only `DONE_STATE`, and `workItems` filters only
`superseded`. So a task cancelled with `status: deprecated` flowed straight through and was
offered as work. Measured on this corpus at the moment of the finding: SIX cancelled tasks were
being listed as ready - docsys/5, /6, /9, /10, walk/16 and tuts/4 - and `ready --plan tuts` said
“2 ready of 2 open” for a plan holding exactly one real task.

WHY THE AUTHOR COULD NOT HAVE PREVENTED IT, which is the part that makes this the report’s defect
rather than a bookkeeping slip. The four states are todo, doing, blocked and done. A task
abandoned BEFORE it was built has no state to move to: `done` would claim it shipped and it never
did, and the CLI rightly refuses an invented state - it explains that `state` is projected into a
tag and an unknown value would file the item under a group no filter names. So the only thing
that can record a cancellation is `status: deprecated`, and the report was not reading it.
Asking every author to also move a state that cannot express the fact is the held-by-convention
failure this project keeps paying for.

THE FIX is one line in the loop: `deprecated` is skipped alongside `done`. Deliberately only
`deprecated` - `draft` and `validated` are workable states of a live task, and `superseded` is
already excluded upstream.

WHAT IS NOT FIXED, and it is a real second question. `buildTaskIndex` still includes deprecated
tasks, so a `needs:` pointing at a cancelled task still reads as unsatisfied and would block its
dependent forever. Three tasks name `needs: docsys/5`, which is deprecated. None is currently
held by it - two are done and the third is itself deprecated - so nothing is blocked today, and
the right answer is not obvious: a cancelled dependency arguably should unblock its dependents,
but silently satisfying a need nobody met is its own hazard. Left for a ruling.
