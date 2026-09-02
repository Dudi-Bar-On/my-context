---
id: DEC-the-slider-s-range-maximum-is-client-state-in-one-shared
type: decision
title: the slider's range maximum is client state in one shared module, and it is not a budget write
status: active
severity: soft
always: false
summary: How far the slider can be dragged is only a viewing choice, remembered in one place shared by the screens that need it, and never saved as a real setting.
summary_of: e86233297e9a2fff
scope: []
tags:
  - v2
  - ui
  - budget
  - "screen:simulate"
  - "screen:config"
  - "screen:preview"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 477c3a1aa7253eb9
---

# the slider's range maximum is client state in one shared module, and it is not a budget write

Taken 2026-08-29 building `TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget`. The owner's five-part requirement asks for a Config-style number with a commit button, and for the range to reach Configure and the injection preview's ribbon as well as the simulator. THE RULING: the range maximum is CLIENT state, held per tier in one module-level store exported from `src/ui/public/screens/parts.js` — the module all three screens already import — and it is NOT written to `config.json`. WHY NOT A BUDGET WRITE, which is the reading the words "the config screen should be synchronized" invite. A budget is what the selector is run at; the range is what a reader has decided is worth exploring. The task's own design section rules that the two must not share a control, and writing an exploration bound into the file that governs injection would make every glance at the simulator a change to the product's behaviour. It would also not fix the defect it was meant to fix: the bound already carried the budget in force as a term, so raising the budget raises the bound and the thumb stays pinned at the right edge exactly as before. WHY ONE MODULE AND NOT THREE COPIES. Three screens have to agree about one number, so it is written down once and imported — the argument `lib/live-invalidation.js` makes about which kinds invalidate which screen and `lib/palette-defs.js` makes about the command catalogue. It lives in `parts.js` rather than in `simulate.js` with the other two importing that, because a screen importing a screen would make the injection preview load the simulator to draw a ribbon, and because `test/ui/config-screen.test.ts` rewrites exactly the three specifiers `parts.js` is one of. WHY A MODULE-LEVEL OBJECT AND NOT sessionStorage. `test/ui/config-screen.test.ts` forbids that screen naming `sessionStorage` at all, and an ES module is a singleton per page, so the object already outlives every render and every navigation between the three screens. It does not survive a reload, which is the right answer too: a reload re-reads the budgets from disk, and a range remembered across it would be a bound nobody on the page had set. HOW EACH SURFACE IS REACHED. The simulator makes it the fourth term of `sliderMaxFor`, where a set range REPLACES the derived default rather than joining its `Math.max` — otherwise the range could only ever be raised, and a maximum that cannot be lowered is half the defect. One term survives the replacement, the budget in force, because a range below it would clamp `slider.value` and draw a number nobody set. Configure calls `raiseSimRange` for every field its budget write actually changed, which is the task's own title performed from the other screen; it only ever raises, and does nothing where no range is set. The injection preview draws each ribbon track to `max(budget, range)` and names the range in the label and hint whenever the two differ, so no sentence on that screen becomes untrue and no track is silently drawn to a scale nobody was told about.
