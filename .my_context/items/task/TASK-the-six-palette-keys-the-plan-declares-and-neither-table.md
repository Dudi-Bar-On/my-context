---
id: TASK-the-six-palette-keys-the-plan-declares-and-neither-table
type: task
title: the six palette.* keys the plan declares and neither table carries
status: active
severity: soft
always: false
summary: The command screen borrows wording meant for a different screen, because six sentences of its own were never declared anywhere.
summary_of: 464fd10db1a1b040
scope: []
tags:
  - "plan:ui2"
  - "seq:12k"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: cc1e80bd45b416e4
valid_from: 2026-08-23
valid_until: null
checksum: 302cb9d4ef1264ca
plan: ui2
seq: 12k
state: todo
---

# the six palette.* keys the plan declares and neither table carries

> The plan for the Composer declares six string keys that exist in NEITHER table:
> `palette.pick`, `palette.compose`, `palette.run`, `palette.result`,
> `palette.incomplete` and `palette.readNote`. `strings-parity` holds the app's
> key set equal to the mockup's `data-t` set in both directions, so they cannot be
> added to the tables alone — the mockup has to declare them first.
>
> The agent that built the screen added none, correctly, and borrowed across
> prefixes instead: the Run button uses `ask.run`, the result table uses
> `th.item` / `ask.rows` / `ask.noRows` / `ask.truncated`, and the
> composed-write note uses `cap.warn`, the sentence that belongs under Capture's
> composed `add`. "Required inputs are missing" is drawn as `aria-invalid` with
> no English at all.
>
> The owner ruled on 2026-08-23 that the six keys should be added to the mockup and
> then to both tables. The reason the borrowing cannot simply stand: editing
> `ask.run` would silently change the Composer too, and no test in this project
> would notice — the key sets would still match, and both screens would still
> render a string.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. The owner ruled on 2026-08-23 that the six keys go into the mockup and then into both tables; the edit has not happened.

IT JOINS THE ONE MOCKUP SESSION -- the owner s file, the owner s edit, done in one sitting with plan:walk seq:20, 13, 14, 25, 19, 1h, 3, 6 and plan:screens seq:1s-b, 1s-c, 10s. The session was reported to the owner as SIX items; the reconciliation has found it is FOURTEEN.

ONE THING WORTH CARRYING TO THAT SITTING: the reason the borrowing cannot simply be left alone is that editing ask.run would silently change the Composer too, and NO TEST IN THIS PROJECT WOULD NOTICE -- the key sets would still match and both screens would still render a string. That is another entry in the standing pattern that every gate here measures what it was pointed at.
