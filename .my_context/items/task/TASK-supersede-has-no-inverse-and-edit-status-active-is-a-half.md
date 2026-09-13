---
id: TASK-supersede-has-no-inverse-and-edit-status-active-is-a-half
type: task
title: supersede has no inverse, and edit --status active is a half-inverse nobody designed
status: active
severity: soft
always: false
summary: Retiring an item in favour of another writes four facts across two files, and one documented flag appears to undo one of them and leave three.
summary_of: 93be9606788b76c5
scope:
  - src/core/mutate.ts
  - src/cli/commands/edit.ts
tags:
  - v2
  - corpus
  - "plan:rulings"
  - "seq:73"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/supers.md"
source_anchor: null
source_checksum: c0a1338bc7db62d3
valid_from: 2026-09-13
valid_until: null
checksum: 91c7e474aabee994
plan: rulings
seq: "73"
state: todo
priority: "2"
---

# supersede has no inverse, and edit --status active is a half-inverse nobody designed

> RAISED by the removal review as "should `supersede` have an inverse?", and PUT TO THE OWNER 2026-09-13 with a recommendation to rule that it has none. Verifying it first changed the question, so the item records what was measured rather than the recommendation as it was offered.
>
> THERE IS NO INVERSE COMMAND. `mycontext supersede <retired id> --by <replacement id>` is the whole surface; nothing anywhere under `src/` un-supersedes. That much of the recommendation holds.
>
> BUT A SUPERSESSION IS FOUR FACTS ACROSS TWO FILES, not one:
>   - `status: superseded` on the retired item
>   - `valid_until` on the retired item
>   - a `superseded_by` relation on the retired item
>   - a `supersedes` relation ON THE REPLACEMENT
>
> AND `edit --status` ACCEPTS `active`. It does not accept `superseded` - which is right, and means a supersession cannot be forged by hand. But it does accept `active`, and nothing found so far refuses it on an item whose status IS `superseded`. That would flip ONE of the four facts and leave the other THREE saying the item is retired: a live item carrying a `valid_until` in the past, pointing at its own replacement, with the replacement still claiming to supersede it.
>
> SO THE REAL QUESTION IS NOT "SHOULD THERE BE AN INVERSE". It is that there is a HALF-INVERSE nobody designed, and it is reachable with a documented flag.
>
> WHAT THIS ASKS FOR:
>
> 1. MEASURE THE HATCH BEFORE ANYTHING ELSE. On a throwaway corpus: supersede an item, then `edit --status active` on it. Report which of the four facts change. IF SOMETHING ALREADY REFUSES IT, this item is a false premise and should be closed as one - that has happened three times this week and it is a legitimate outcome.
>
> 2. IF IT IS REACHABLE, CLOSE IT RATHER THAN BUILD AN INVERSE. The recommendation put to the owner and approved: a supersession is A DATED HISTORICAL CLAIM, and unwinding it should mean superseding the successor back, which leaves a TRUE record of both acts. An inverse that erases the first act makes the corpus lie about its own history, which is the defect this project's whole lifecycle exists to prevent.
>
> 3. THE REFUSAL MUST SAY WHAT WOULD UNBLOCK IT, per `RULE-a-refusal-states-its-unblocking-condition`: name the successor, and name superseding it back as the way forward.
>
> 4. RECORD THE RULING AS AN ITEM, so the next reader does not re-ask. That is the actual cost being paid today - the question has been asked twice and answered nowhere.
