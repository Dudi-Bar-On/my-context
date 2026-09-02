---
id: TASK-the-provenance-bar-is-empty-on-every-screen-no-module-has
type: task
title: "the provenance bar is empty on every screen: no module has ever filled provparts"
status: active
severity: soft
always: false
summary: A strip built to explain what qualifies the numbers you are looking at is blank on every screen, because nothing ever fills it.
summary_of: 6ee9c67bb34b32d1
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - a11y
  - "plan:walk"
  - "seq:39"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: ac19e10661279895
plan: walk
seq: "39"
state: todo
priority: "2"
source: "owner request 2026-08-25: preview, app vs mockup, on the REAL corpus"
---

# the provenance bar is empty on every screen: no module has ever filled provparts

FOUND 2026-08-25 by owner request 2026-08-25: preview, app vs mockup, on the REAL corpus. Only a third of this had a task.

THE MOCKUP FILLS IT WITH THREE PARTS, visible in the screenshot beneath the panes:
    preview of `parent thread` . tokens `not recorded before 1.0.1` . projection `already current`

THE APP DRAWS THE BAR AND NOTHING IN IT. `renderChrome()` builds `#prov` and an empty `#provparts` deliberately -- its own comment: "the bar is one home for every qualification the screens owe, and when no screen owes one there is nothing to say. The row is reserved by the grid either way ... screens fill `#provparts` later." LATER NEVER CAME: grep `src/ui/public/screens/` for `provparts` and there are ZERO hits across all 21 screens.

SO THE ONE SURFACE BUILT TO HOLD "what qualifies the numbers you are looking at" is blank on every screen in the product, and the qualifications it exists for are instead scattered into each screen s prose or absent.

WHAT HAS A TASK AND WHAT DOES NOT. `plan:ui3 seq:11x` covers ONE of the three parts -- the projection group, `#provproj`, which `renderChrome` does not build at all -- and the reconciliation established that one of its three keyed states (`prov.projCaughtUp`) can never happen and should be retired. THE OTHER TWO PARTS HAVE NO TASK: "preview of <what session>" and the token-recording caveat.

THE ORDER MATTERS. Decide what the bar is FOR before filling it, because "one home for every qualification" is a contract and three screens each appending their own sentence is how it becomes a second subtitle. The mockup s own three are the model: each names a LIMIT on the numbers above it, not a description of them.

AND IT IS SHELL WORK, NOT SCREEN WORK -- the bar outlives any one screen, so a screen module creating it was correctly refused. It belongs with `plan:walk seq:29` (the strip s context group) and `plan:walk seq:31` (the missing aria-live region): three tasks, one function, `renderChrome()`. Do them in one sitting.
