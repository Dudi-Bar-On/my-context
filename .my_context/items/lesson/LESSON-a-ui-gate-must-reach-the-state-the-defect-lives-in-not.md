---
id: LESSON-a-ui-gate-must-reach-the-state-the-defect-lives-in-not
type: lesson
title: a UI gate must reach the STATE the defect lives in, not merely the screen
status: active
severity: soft
always: false
summary: Opening a page is not the same as reaching the situation a fault appears in, so anything drawn only later is never checked at all.
summary_of: 64cd960599cc1c6a
scope: []
tags:
  - v2
  - testing
  - e2e
  - ui
  - gates
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: fa0e8a57ee49e07c
---

# a UI gate must reach the STATE the defect lives in, not merely the screen

MEASURED 2026-08-27, on the gate written for the owner's invisible-button report -- and the gate was VACUOUS on its first pass.

WHAT HAPPENED. `e2e/button-contrast.spec.ts` walks the command-composing screens, reads every drawn `<button>`, and fails one whose text cannot be read against what is behind it. Written, run, green. Then the fix was REVERTED -- reintroducing the owner's exact defect, a classless button on the user agent's near-white face -- and **it still passed**.

WHY. `palette.js` returns early on `if (!complete) return;`. The command box, the Copy control and the read action are built only once every required argument is filled. Walking to `#/palette` measures the command picker and the flag controls and NOT the three controls the gate exists for. Twenty-odd buttons were measured, the count assertion passed, and the one that mattered had never been drawn.

THE SHAPE, and this project has now paid for it four times in two days: a query CORRECT ABOUT WHAT IT MEASURED AND SILENT ABOUT WHAT IT MISSED. The injection reading `cwd`. The board reading fields while the state was in tags. Eight of twenty-four tasks marked done. And now a gate that walked to the screen and never reached the state.

WHAT THE GATE NEEDED, and it is one step: DRIVE the screen into the state -- select a command, wait for the control to exist -- before measuring. `doctor` is the command used, because it takes no arguments, so "composed" is one selection away and the step cannot fail for a reason unrelated to buttons.

THE GENERAL RULE. **A screen is not a state.** For any UI gate, ask what has to be TRUE for the thing under test to be on screen at all, and make that a step with its own wait and its own failure. A control built conditionally is invisible to a walk, and invisible to a walk is indistinguishable from correct.

AND THE RULE THAT CAUGHT IT: a gate nobody has watched fail is a gate nobody has tested. The spec had an anti-vacuity test -- it injected a broken button and required the collector to see it -- and that test passed throughout, because the COLLECTOR was never the broken part. Anti-vacuity on the instrument is not anti-vacuity on the walk. Only reverting the real fix found it.
