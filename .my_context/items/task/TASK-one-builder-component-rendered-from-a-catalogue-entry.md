---
id: TASK-one-builder-component-rendered-from-a-catalogue-entry
type: task
title: ONE builder component, rendered from a catalogue entry
status: active
severity: soft
always: false
summary: Build one reusable set of command inputs so every screen that offers a command draws it the same way instead of inventing its own.
summary_of: 04c72873147c9fec
scope: []
tags:
  - "plan:builder"
  - "seq:5"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: f2d83014bf0942f7
plan: builder
seq: "5"
state: todo
needs: builder/2, builder/3, port/95
---

# ONE builder component, rendered from a catalogue entry

Every command site in the UI draws the same way, from data, rather than each screen hand-rolling its own row of inputs.

A closed vocabulary becomes a `<select>`. Free text becomes an `<input>` CARRYING ITS FORMAT AS A PLACEHOLDER - owner instruction 2026-08-24, "a grayed out hint in the fields as placeholder before user enter values". A required field that is empty is visibly required, not silently invalid.

The Capture screen is the model and already does most of this: a select for the category, inputs for title and scope, a select for severity. Read `screens/capture.js` before designing anything - the job is to generalise what is there, not to replace it.

THE MOCKUP IS THE DESIGN OF RECORD AND MUST MOVE FIRST. A builder is new markup on many screens; `styles-parity`, `screen-parity` and `strings-parity` all measure against `docs/design/web-ui-mockup.html`, and every new string needs a key in BOTH tables. Draw it in the mockup, then build it, in one parity-locked commit.

DEPENDS ON seq 2 and 3. BLOCKED BY plan:port seq:95 - every screen file is frozen until the tree-parity inventory is reviewed.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- and plan:walk seq:20 IS ITS MOCKUP HALF. They are one piece of work and neither says so.

THIS TASK: "THE MOCKUP IS THE DESIGN OF RECORD AND MUST MOVE FIRST. A builder is new markup on many screens ... Draw it in the mockup, then build it, in one parity-locked commit."
plan:walk seq:20: "draw the builder ONCE in the mockup, as the pattern every command site uses" -- blocked on the owner, and it unblocks walk seq:13 and seq:21.

So seq:20 is the drawing and this is the component. Do not schedule them apart, and do not let the mockup sitting happen without this task s content in hand: the select / input / placeholder / visibly-required behaviour is what has to be drawn.

AND ITS BEST INSTRUCTION SHOULD SURVIVE INTO BOTH: the Capture screen already does most of this -- a select for the category, inputs for title and scope, a select for severity. Read screens/capture.js first. The job is to generalise what is there, not to replace it.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
