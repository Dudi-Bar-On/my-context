---
id: TASK-one-builder-component-rendered-from-a-catalogue-entry
type: task
title: ONE builder component, rendered from a catalogue entry
status: active
severity: soft
always: false
summary: "Done: one shared control builds every picker from its catalogue entry, so a new field needs no new screen code."
summary_of: 6f26a287ea19ef6f
summary_was:
  - 2026-09-11 Build one reusable set of command inputs so every screen that offers a command draws it the same way instead of inventing its own.
scope: []
tags:
  - "plan:builder"
  - "seq:5"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 005bf1b44199387f
plan: builder
seq: "5"
state: done
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

Landed in `93920f60` — "builder/5: one builder component, and the mockup half was already dead".

CLOSED 2026-09-11, FOUR DAYS LATE, AND THE LATENESS IS THE POINT. This shipped on 2026-09-07 and
nobody set the state. It was found by the handover measurement, not by an audit: the handover
checker flagged it as an instruction "carried into 3+ blocks with the work still open", and the
lane checking whether that meant HARD or IMPOSSIBLE found it meant NEITHER — the work was done and
the item was wrong.

WHAT THE STALENESS COST, measured rather than supposed: `mycontext ready --plan builder` was
offering these as dispatchable. A lane taking that list would have REBUILT SHIPPED, TESTED WORK —
and would have found the code already there, which is the confusing version of the failure rather
than the loud one.

AND THE HANDOVER WAS NOT AT FAULT, which was checked before it was blamed: the next block written
after the landing names none of these. The residual is a fossil of this item’s own `state` field,
and the checker reads "still open" from there.

Verified before closing: `test/ui/builder.test.ts` 24 of 24 green on 2026-09-11.
