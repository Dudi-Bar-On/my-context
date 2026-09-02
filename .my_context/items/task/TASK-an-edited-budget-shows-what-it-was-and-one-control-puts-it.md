---
id: TASK-an-edited-budget-shows-what-it-was-and-one-control-puts-it
type: task
title: an edited budget shows what it was, and one control puts it back
status: active
severity: soft
always: false
summary: While changing a setting, show what it currently is and offer one control to put it back, so a change can be abandoned without guessing.
summary_of: 0a916eed1320043f
scope: []
tags:
  - v2
  - ui
  - budget
  - "plan:budget"
  - "state:todo"
  - "seq:6"
origin: human
source_file: null
source_anchor: null
source_checksum: 9e3f8b6e3433c875
valid_from: 2026-08-28
valid_until: null
checksum: 1ea5a7d8098bc835
plan: budget
seq: "6"
state: todo
priority: "1"
source: owner, 2026-08-28
---

# an edited budget shows what it was, and one control puts it back

> Owner, 2026-08-28: *"add the configure and the simulator budgets changing a
> button that refreshes and show the current values, because after changing the
> controls the user does not know what it was if he does not want to apply his
> changes; another helpful would be to display the current values before the
> changes."*
>
> ## The gap, stated exactly
>
> `plan:budget seq:5` made the budget inputs editable and gave them a save
> control. It did not give them a way BACK. Type over `16000`, decide against it,
> and the number you typed over is gone — the screen holds only what is in the
> input.
>
> The confirm does show `budgets.pinned: 16000 → 22000`, but only at the moment of
> applying. That is the wrong end of the interaction: by the time the confirm
> renders, the reader has already lost the value they were deciding about, and the
> confirm is the last place it helps to learn it.
>
> ## Two controls, and they answer different questions
>
> **1. Restore the values in force.** One control that discards the edits and puts
> the inputs back to what `config.json` holds. It also answers "has anything
> changed at all" — it is only enabled when something has.
>
> **2. Show the in-force value beside each edited one.** Not on apply: WHILE
> editing. `16000 → [22000]` beside the input, so the reader can see what they are
> changing from without having to remember it or press anything. The confirm's
> before/after already computes exactly this pairing (`diffBudgets` in
> `src/core/budgets-write.ts`) — the value is derivable on the screen and does not
> need a second source.
>
> ## Found while measuring this: the simulator cannot reach the budgets Configure accepts
>
> `src/ui/public/screens/simulate.js` builds its slider from *"the mockup's own
> slider bounds, verbatim: `min=0 max=12000 step=50`"*. The owner set `pinned`
> above that on 2026-08-28. **A budget in force can be outside the range the
> simulator can represent**, so "simulate the budget I actually have" is not
> expressible, and the two screens disagree about what a budget can even be.
>
> That bears directly on
> `REQ-configure-and-the-simulator-agree-on-the-budgets-whatever`: agreeing about
> the VALUE is not enough if one screen cannot display it. Establish the real
> bound before changing it — the mockup is the design of record and it says
> 12000, so either the mockup moves first or the range becomes derived rather
> than literal. Do not simply widen the app and leave the mockup behind:
> `styles-parity` and `screen-parity` would be right to object.
>
> ## The interaction with `plan:live seq:3`
>
> `seq:3` makes screens re-render when their declared kinds arrive. A live refresh
> that lands while somebody is mid-edit and replaces their typed values with the
> corpus's is the exact defect that task exists to prevent — its rule is that a
> refresh which cannot keep the reader's place ASKS. An edited budget form is a
> reader's place. Whichever of the two Configure declares, it must not silently
> discard an in-progress edit, and the test for this task should include a
> mutation arriving while a value is typed.
>
> ## Done when
>
> The in-force value is visible beside every budget control while it is being
> edited; one control restores them all and is disabled when nothing has changed;
> the simulator can represent any budget Configure will accept, with the mockup
> moved first if its bound changes; and a browser test drives an edit, asserts the
> in-force value is shown, presses restore, and asserts the inputs return — plus
> the `seq:3` case of a mutation arriving mid-edit.
