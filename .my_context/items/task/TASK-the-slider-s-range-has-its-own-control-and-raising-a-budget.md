---
id: TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget
type: task
title: the slider's range has its own control, and raising a budget past the limit raises the limit
status: active
severity: soft
always: false
summary: Choosing which limit to try and choosing how far the scale reaches are different decisions and should not share one slider.
summary_of: 5a1e30ea1c2f72db
acknowledged:
  - state_unaudited@da17f595997e8b92
scope: []
tags:
  - v2
  - ui
  - budget
  - "plan:walk"
  - "state:done"
  - "seq:7b"
origin: human
source_file: null
source_anchor: null
source_checksum: cf3f0beb6b499c5e
valid_from: 2026-08-28
valid_until: null
checksum: 8451114a5ee46dc3
plan: walk
seq: 7b
state: done
priority: "1"
source: owner, 2026-08-28, repeated
---

# the slider's range has its own control, and raising a budget past the limit raises the limit

> Owner, 2026-08-28, and stated as a repeat: *"currently the simulator slider has
> a maximum value at the right of the scale and this value should be updated upon
> trying to increase a budget higher than its current limit, so the new limits
> should have a different control to be changed, as I have requested in the past."*
>
> **It had not been recorded before.** Searched the whole corpus on the day it was
> repeated: no item, no open question, no note. The request was made in
> conversation and never captured, which is the failure this corpus exists to
> prevent and is worth saying plainly rather than filing as if it were new.
>
> ## The design, in two parts
>
> The screen conflates two different things into one control today:
>
> 1. **Which budget am I evaluating** — the slider's value, dragged.
> 2. **What range can I evaluate over** — the slider's maximum, the number at the
>    right of the scale.
>
> These are not the same question and must not share a control. Dragging is
> exploration within a range; changing the range is a decision about what range is
> worth exploring. A slider whose maximum silently moves while you drag has no
> stable frame of reference, and a maximum that can only be changed by dragging
> into it cannot be lowered at all.
>
> So: **the maximum is set by its own control**, and attempting to raise a budget
> past the current limit updates the limit rather than refusing or clamping.
>
> ## What has already been decided about this bound, so the next change is not the fourth
>
> * **The mockup's literal** — `min=0 max=12000 step=50`, the original, and it was
>   the only bound for the life of the screen.
> * **`sliderMaxFor()`, 2026-08-28** — an interim fix, because the literal CLAMPED
>   the budget in force and drew a number nobody set: with `pinned` at 16,000 the
>   slider showed 12,000 and said nothing. Derived as `max(12000, budget in
>   force)`. `e2e/simulate-slider.spec.ts` pins that property.
> * **`plan:walk seq:7`** — replaces the derivation with the sweep's last rung,
>   since once rungs exist the meaningful bound is a rung and the slider snaps to
>   rungs (`sim.snap`).
> * **This task** — the maximum becomes user-settable, with the rung-derived value
>   as its default.
>
> That is four designs for one number, and the reason to write them down together
> is that each was right when it was chosen. The property that survives all four,
> and must keep surviving: **the slider can always reach the budget actually in
> force, and never displays a value that was clamped.**
>
> ## The owner's suggested shape: a second slider
>
> Owner, same day: *"maybe another sub slider."* So the range control is itself a
> slider — a coarse one setting the maximum, with the existing slider fine-
> grained inside it. Recorded as the owner's proposal, not yet a ruling, because
> one question has to be answered before it can be built.
>
> **What bounds the range slider?** A slider needs a maximum, so a slider that
> sets a maximum needs a maximum of its own, and answering "another slider" again
> does not terminate. It has to end in a number that comes from something real.
> Three candidates, each with a different meaning:
>
> * **The context window size**, from the status-line bridge. The most honest
>   ceiling — no budget above it can ever take effect — and the one the owner's
>   own `plan:budget seq:3` already says validation must use. Its cost is a
>   dependency: without a bridge sample there is no window size, and that task is
>   explicit that the answer then is to REFUSE rather than guess, because a
>   model-to-window table was measured wrong by 5x on this machine.
> * **The sweep's last rung** (`plan:walk seq:7`). Meaningful — past the last
>   rung nothing changes, so the range covers every distinguishable budget — and
>   it needs no bridge. It can sit below the budget in force, so it cannot be the
>   only rule.
> * **A multiple of the budget in force.** Always available, always reachable,
>   and arbitrary: it encodes no fact about the corpus or the window.
>
> The likely answer is the window when the bridge has spoken and the last rung
> when it has not, with the control saying which it is using — a range whose
> ceiling means two different things on different days, without saying so, is the
> silent-ambiguity shape this project keeps paying for.
>
> ## RULED 2026-08-28: the Config-style numeric input
>
> The owner chose it after both were put to him with their costs. So the range
> maximum is a numeric input of the same shape Configure's budget rows use, and
> the sub-slider is not built.
>
> **What this settles**, so it is not re-opened by whoever implements:
>
> * There is no ceiling rule to invent. A number input needs validation, not a
>   maximum, and `requirePositiveIntegerBudget` already refuses by name and never
>   clamps. The three candidate ceilings below are recorded as reasoning, not as
>   work.
> * The control is the one already on Configure, not a second spelling of it.
> * The cost is accepted and named: typing shows nothing until it is committed,
>   on a screen whose subject is watching a number move. If that turns out to
>   matter in use, the sub-slider below is the recorded alternative and this
>   ruling is where to start reading.
>
> ## The owner's second suggestion, which answers the first's objection
>
> Same day: *"or a control like in config."* Configure's budget rows are numeric
> inputs — `input[aria-label="budgets.jit"]`, built by `plan:budget seq:5`.
>
> **This dissolves the terminating-bound problem above.** A number input has no
> visual ceiling to justify: it needs validation, not a maximum. So the question
> "what bounds the range slider" stops being a design decision with three
> defensible answers and becomes an ordinary refusal — a positive integer, and
> where the bridge has spoken, not past the window.
>
> It also buys consistency the sub-slider cannot. Typing a budget is a thing this
> product already does, on Configure, with a control the owner has already used
> and a validator that already exists (`requirePositiveIntegerBudget`,
> `src/core/budgets-write.ts`, which refuses by name and never clamps). A second
> way to type a budget would be a second thing to keep in step — the argument
> `palette-defs.js` makes about the command catalogue, one screen over.
>
> **What the sub-slider still buys, so the choice is real.** Dragging is
> continuous and shows the range changing as you change it; typing is discrete
> and shows nothing until you commit. On a screen whose subject is "watch what
> fits as this number moves", that difference is not cosmetic. The two are also
> composable: a numeric input that sets the ceiling, with the existing slider
> inside it, is the shape most tools use for exactly this.
>
> RECOMMENDED, pending the owner: the Config-style numeric input, because it
> reuses a control and a validator that exist and needs no new ceiling rule. The
> sub-slider stays recorded as the alternative rather than discarded — it is the
> better answer if the range turns out to be something people sweep rather than
> set.
>
> **THE OWNER'S FULL REQUIREMENT, 2026-08-28 — five parts, and one contradicts the design of record**

*"i have requested to have a controls like we have in the config budgets to allow us to raise the max budget, also upon setting it we should have a button to update it the same we does in the config and also the config screen should be synchronized with the simulator and also the ribbon budget in the injection preview max values should be updated also the slide resolution is coarse and actually unusable it should slide smoothly with much smaller steps."*

1. **A Config-style numeric input** for the range maximum. Already ruled; unchanged.
2. **A button to commit it**, in the same shape as Configure's budget write — so setting a range is an act with a receipt, not a silent field.
3. **Configure and the simulator stay synchronised.** `REQ-configure-and-the-simulator-agree-on-the-budgets-whatever` already requires this for the VALUE; the owner now extends it to the RANGE. Note `plan:live seq:8` made the config live per request, so the mechanism exists and the two screens can no longer disagree by staleness — only by not being wired.
4. **The injection preview's ribbon maxima update too.** A third surface, and the one most likely to be forgotten: the ribbon derives each track's width from its tier budget, so a raised maximum has to reach `screens/preview.js` and not only `simulate.js`.
5. **The step is too coarse to use** — "actually unusable". `step=50` today.

**Part 5 — CORRECTED 2026-08-28. There was no contradiction to weigh.**

This section previously framed the finer step as conflicting with `sim.snap`'s prose and offered the owner three compromises. That was wrong, and the owner said so: *"stop to look at the mockup as behaviour, it is only for how it should be presented on the screen."* See `DEC-the-mockup-governs-presentation-never-behaviour-and-a`.

**Snapping is behaviour. The mockup has no standing over it.** The owner asked for a finer step; that is the requirement, not one side of a negotiation.

What `sim.snap` says remains worth knowing as an ENGINEERING fact — *"Every value between two rungs behaves identically"* is true of the selector, so a finer step shows no new selection. Measured against the live corpus: eighteen rungs clustered low (`0, 141, 720, 1013, 1015, 1285, 1294 …`), and a drop at 40% of the track travels to 950, which is what "unusable" names.

So: **make the step fine.** If the implementer believes the reader is better served by the thumb moving freely while the readout and chart report the governing rung, that is an engineering judgement to make and record — not a contradiction to escalate. What must NOT happen is treating the mockup's sentence as a reason to give the owner less than they asked for.

`sim.snap`'s prose is then corrected to match whatever ships, because a design document asserting a behaviour the app does not have is worse than silent.

**Both facts are true**: a finer step shows no new selection, AND the present behaviour is unusable. So do not simply set `step=1` and delete the snap. The shapes worth weighing:

* Fine step for the THUMB, with the readout and chart snapping to the governing rung — the pointer goes where you put it, the answer stays truthful.
* Snap only within a threshold distance, taking the literal value beyond it.
* Show the snap target during the drag, so the jump is predicted rather than suffered.

Whichever is chosen, record why, and update `sim.snap`'s prose in the mockup — leaving the design asserting a behaviour the app no longer has is the drift these gates exist to prevent.

**MEASURED IN A BROWSER 2026-08-28 — the owner hit it, and it is worse than "the range is fixed"**

Owner: *"the slider always displayed at the max value that most of the times is incorrect and when moving it it then changes it's position and not allowing to move it to the right upwards the max value on the right."*

Driven with Playwright against the live corpus:

    initial        min=0  max=16000  value=16000   <- thumb pinned hard right
    drag to 40%    min=0  max=16000  value=950     <- lands nowhere near the drop

**The budget in force for `jit` IS 16,000, and the derived max IS 16,000.** So value == max at rest, by construction, whenever the budget in force is at or above the derived bound.

**The consequence is not cosmetic: the simulator cannot simulate raising a budget.** The thumb can only ever travel LEFT. On a screen whose own subtitle reads *"Raising a budget can evict an item"* and which ships a help topic titled *"Why raising a budget can remove an item"*, the one direction the reader is invited to explore is the one direction the control cannot go.

That is the sharpest possible argument for this task and it should lead it. The ruling — a Config-style numeric input for the range — stands unchanged; what changes is that this is not an enhancement, it is the screen being unable to answer its own question.

**A SECOND defect, which this task should either take or hand on deliberately**

Dragging to 40% of the track produced 950, not ~6,400. `sim.snap` snaps to rungs and the rungs cluster at the low end (`0, 141, 720, 1013, 1015, 1285, 1294 …`), so a drop in open space can travel a long way to reach one. The mockup's own prose defends snapping — *"dragging lands on meaning rather than on 6,050"* — and it is right in principle, but it was written against six evenly-spread rungs. Against eighteen clustered ones, the thumb visibly jumps away from the pointer, which is what the owner reports as *"it then changes it's position"*.

**Do not solve that by removing snapping.** The honest options are to show the snap target while dragging so the jump is predicted rather than surprising, or to snap only within a threshold distance and otherwise take the literal value. Decide, and record which.
