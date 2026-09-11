---
id: TASK-copy-is-refused-until-the-command-passes-and-the-refusal-is
type: task
title: copy is refused until the command passes, and the refusal is readable
status: active
severity: soft
always: false
summary: "Done: you cannot copy a command the product knows is wrong, and the reason it refuses is on the screen."
summary_of: ce81b3fad14596de
summary_was:
  - 2026-09-11 When a command is not yet valid to copy, show the reason in plain words instead of just hiding the button and leaving the reader to guess.
scope: []
tags:
  - "plan:builder"
  - "seq:6"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: fcef9c0d50ab107d
plan: builder
seq: "6"
state: done
needs: builder/4, builder/5
---

# copy is refused until the command passes, and the refusal is readable

The behaviour the owner named. It already exists on ONE screen: `captureCommand` throws on a half-built capture and the screen draws no `.cmd` row at all, so there is nothing to copy. `palette.js` treats the same throw the same way.

Generalise it, and improve one thing while generalising: a copy button that is simply absent tells the reader nothing about WHY. The refusal from seq 4 is the sentence to show - the CLI's own words, next to the field that caused it where that can be determined.

A refusal a reader cannot read is the failure this project keeps rediscovering. It is written into DEC-the-ask-screen-accepts-typed-sql as a question that must be settled while building, and it is the same question here.

DEPENDS ON seq 4 and 5.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the one builder task that also serves the owner s standing goal that a refusal is a state to leave. It already exists on ONE screen -- captureCommand throws on a half-built capture and the screen draws no .cmd row -- and the improvement named here is the whole point: a copy button that is simply ABSENT tells the reader nothing about why. Show seq:4 s refusal, which is the CLI s own words, next to the field that caused it. For plan:walk seq:12, which enumerates every standing refusal: this is a refusal that leaves the list by becoming READABLE rather than by being removed. Depends on seq:4 and seq:5.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.

Landed in `1be21693` — "builder/6, /8 and /17: the check is wired, the legal values are on screen, and you can read the id you picked".

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
