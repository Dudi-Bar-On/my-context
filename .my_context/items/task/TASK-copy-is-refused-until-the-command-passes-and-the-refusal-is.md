---
id: TASK-copy-is-refused-until-the-command-passes-and-the-refusal-is
type: task
title: copy is refused until the command passes, and the refusal is readable
status: active
severity: soft
always: false
summary: When a command is not yet valid to copy, show the reason in plain words instead of just hiding the button and leaving the reader to guess.
summary_of: 5fb9f4161226c6dd
scope: []
tags:
  - "plan:builder"
  - "seq:6"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: a13e117c4d8d93e0
plan: builder
seq: "6"
state: todo
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
