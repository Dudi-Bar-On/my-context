---
id: TASK-the-simulator-opens-on-the-tier-that-shows-nothing-and-div
type: task
title: the simulator opens on the tier that shows nothing, and div.at needs a behaviour test
status: active
severity: soft
always: false
summary: The budget screen opens on the one setting that can show nothing, so both of its main features start blank with no explanation.
summary_of: 091eecd351adaac9
scope: []
tags:
  - v2
  - ui
  - walk
  - "plan:walk"
  - "seq:59"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 1be13af997f9c627
plan: walk
seq: "59"
state: todo
priority: "2"
source: "found restoring the parity ledger after seq:7, 2026-08-28"
---

# the simulator opens on the tier that shows nothing, and div.at needs a behaviour test

> Two findings from one measurement while restoring `div.at` to `screen-parity`'s ledger after `plan:walk seq:7` (2026-08-28).
>
> ## 1. The simulator opens on the one tier that can show nothing
>
> `screens/simulate.js` has `let tier = 'jit'`. `EVENT_FOR.jit` is `'tool'`, and `runSweep`'s guard is:
>
>     if (EVENT_FOR[tier] === 'tool' && path === null) { ladderPlate.replaceChildren(); ...; return; }
>
> A `tool` event needs a path. On first paint no path has been chosen, so **the ladder is cleared and the staircase never draws** — the screen's two headline features are blank until the reader picks a tier or a path, and nothing on it says why.
>
> Measured from the other side against the sweep endpoint: `pinned` answers **189 rungs**; `jit` and `restored` answer **zero**. The screen opens on one of the empty ones.
>
> This is the same shape as `plan:walk seq:58`'s path picker — a control that is correct and inert, with the emptiness left to be interpreted. It is worth noting the two share a root: the `jit` tier needs a path, and the product keeps presenting jit-shaped surfaces before a path exists.
>
> **Decide, do not assume**: open on `pinned` (something to see immediately, but the reader must then find `jit` to ask the question the JIT tier answers), or stay on `jit` and say what is missing and how to supply it. The second keeps the screen honest about its own subject; the first is a smaller change. Either is defensible; silently blank is not.
>
> ## 2. `div.at` needs a behaviour test, which the parity census cannot be
>
> `drawLadder` builds the highlight correctly — it marks the last rung at or below the slider with `at`, mirroring the mockup's `rungs[rungs.length-1].classList.add('at')`. `seq:7` removed the ledger entry on the reasonable belief that shipping the ladder closed it, and could not run the browser suite to check. The gate then failed on the fixture's default state, where no rung exists at all.
>
> The entry is restored with the measurement recorded in place. **The honest close is not another ledger edit**: it is a test that SELECTS a tier with rungs and asserts the highlight lands on the right one — which `screen-parity` cannot express, because it counts element KINDS and does not drive a screen into a state.
>
> That is a general limit of the parity gate worth stating once: it proves the app draws what the design draws, and it can say nothing about WHEN. Every element whose existence is conditional on reader action needs its own behaviour test or it sits in the ledger forever, indistinguishable from something never built.
>
> ## Done when
>
> The opening-tier question is decided and recorded; if the screen stays on `jit`, it says what it needs and how to give it; a browser test selects a tier with rungs, asserts the `at` highlight is on the last rung at or below the slider, and asserts it MOVES when the slider moves; and `div.at` leaves `KNOWN_GAPS.simulate` only when that test exists.
