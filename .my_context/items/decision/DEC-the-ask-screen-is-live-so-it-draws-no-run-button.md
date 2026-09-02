---
id: DEC-the-ask-screen-is-live-so-it-draws-no-run-button
type: decision
title: the ask screen is live, so it draws no run button
status: active
severity: soft
always: false
summary: A screen that already updates itself as you change the filters has no Run button, because a button that visibly changes nothing looks broken.
summary_of: 8d76bddd5d341340
scope: []
tags:
  - v2
  - owner-ruling
  - ui
  - ask
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 668f4b0918f50aa1
---

# the ask screen is live, so it draws no run button

OWNER RULING, 2026-08-27: "Remove Run entirely", after reporting "the run is unusable because you calculate at least the sql whenever it changes so run does nothing".

WHAT HE FOUND, and it is sharper than "the button is broken". The button WORKED. `ask.js`'s three filter selects each called `runFilter()` on change, and Run called the same function -- so by the time it could be clicked, the answer it would produce was already on screen. Clicking genuinely re-ran the query and changed nothing visible.

**AN ACTION WITH NO ACKNOWLEDGEMENT IS INDISTINGUISHABLE FROM A BROKEN ONE.** That is the same class as TASK-a-copy-button-acknowledges-nothing-and-the-app-has-no-aria (plan:walk seq:31), and this is its second instance. Neither is a rendering bug; both are the product doing something and saying nothing.

THREE ANSWERS WERE OFFERED AND HE TOOK THE THIRD:

  1. Run becomes the trigger -- the selects stop auto-running. Makes the button mean something and costs instant filtering.
  2. Stay live and give Run an acknowledgement -- "re-ran, N rows" -- which is a real function, because the corpus moves under the screen while hooks write to it.
  3. REMOVE IT. A live screen does not need a trigger.

He took 3, and the reason it is right rather than merely cheapest: the other two both spend something to keep a control the screen does not need. Option 2 in particular would add an acknowledgement whose only job is to tell the reader that a button they did not need had worked.

WHAT THIS COSTS, stated because it is a real divergence and not a free one. The mockup DRAWS a Run button in the ask section. Under DEC-the-app-is-what-is-built the app may diverge and the mockup is history plus a gap list, but the divergence is RULED here rather than left for a future reader to read as a porting miss and "fix" back.

`screen-parity` does not notice: the canned-query buttons are `button.icon` too, so the KIND is still drawn. `ask.run` stays in both string tables -- the composer uses it for its own read action, and the gap direction of `strings-parity` holds every sentence the mockup declares to exist in the tables regardless of which screen draws it.

WHAT IT DOES NOT LICENCE: the composer's read action keeps its run button. There the button is the only way to make the thing happen, so it is a trigger rather than an echo.
