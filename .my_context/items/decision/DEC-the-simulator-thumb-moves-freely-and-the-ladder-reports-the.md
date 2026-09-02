---
id: DEC-the-simulator-thumb-moves-freely-and-the-ladder-reports-the
type: decision
title: the simulator thumb moves freely and the ladder reports the governing rung; the snap is removed, not narrowed
status: active
severity: soft
always: false
summary: The slider moves smoothly and stays where you put it; instead of jumping to the nearest meaningful step, the display tells you which step you are standing on.
summary_of: 8bb48e87db2d23e1
scope: []
tags:
  - v2
  - ui
  - budget
  - owner-ruling
  - "screen:simulate"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 076920d666c904af
---

# the simulator thumb moves freely and the ladder reports the governing rung; the snap is removed, not narrowed

Taken 2026-08-29 while building `TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget` part 5. The owner asked for a finer step: "the slide resolution is coarse and actually unusable it should slide smoothly with much smaller steps." `DEC-the-mockup-governs-presentation-never-behaviour-and-a` is why `sim.snap`'s prose was not a counter-party — snapping is behaviour and the mockup has no standing over it. What the prose contains that IS worth weighing is a true engineering fact about the selector: every value between two rungs behaves identically, so a finer step shows no new selection. THE RULING: `slider.step` is 1, and the drag-tick snap is REMOVED rather than narrowed to a threshold or annotated with a preview. The rung that actually governs is REPORTED instead of enforced — the threshold ladder already marks the highest rung at or below the value with `.at`, and the staircase's step path is drawn from the rungs themselves, so the reader sees which tread they are standing on without the thumb being dragged away from their finger. WHAT WAS MEASURED, and why the other two shapes lose. Driven with Playwright against this repository's own corpus: eighteen `jit` rungs, every one at or below 1,550, under a bound of 16,000. A click at 40 percent of the track produced 1,550; a click at 95 percent produced 1,550 as well. That is not a coarse control, it is a control that cannot be aimed, and it is what the owner reported as the thumb changing its own position. Snapping within a threshold distance keeps a jump that is merely rarer and still moves the thumb off the pointer. Showing the snap target during the drag adds a second readout to explain a movement that would then still happen. Reporting the rung removes the movement instead of annotating it and costs the reader nothing they were getting. THE FOLLOW-ON EDIT, not a negotiation: `sim.snap` now reads "The thumb moves in single tokens and lands where you put it — the ladder marks the rung that actually governs. Every value between two rungs behaves identically, so 6,050 decides exactly what the rung below it decides." Corrected in `en.js`, `he.js` and `docs/design/web-ui-mockup.html` together, including the mockup's own `step` attribute and its demo `input` handler, because a design document asserting a behaviour the app does not have is worse than silent.
