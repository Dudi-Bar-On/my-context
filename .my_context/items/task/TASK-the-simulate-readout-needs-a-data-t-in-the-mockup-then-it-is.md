---
id: TASK-the-simulate-readout-needs-a-data-t-in-the-mockup-then-it-is
type: task
title: the simulate readout needs a data-t in the mockup, then it is ten lines
status: active
severity: soft
always: false
summary: A summary line on the budget screen cannot be shown until the design declares it, after which it is a few lines of work.
summary_of: f277dd4f7d97e39c
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:simulate"
  - strings
  - mockup
  - "plan:walk"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 2363f4253230ea12
plan: walk
seq: "6"
state: todo
priority: "2"
source: "plan:port seq:98, simulate"
---

# the simulate readout needs a data-t in the mockup, then it is ten lines

OWNER RULING, 2026-08-24: give the mockup a `data-t` and ship it.

THE SENTENCE: "5 in, 1 out, 4,320 tokens used" and the "next in at 8,220 -- STD-api-errors-problem-json" line beneath it. The mockup builds both out of English and Hebrew literals inside its own script, under no `data-t`, so neither has a key in either string table. `test/ui/strings-parity.test.ts` fails on a key the design of record does not declare, which is why simulate.js refused to word it at all rather than spelling it out of keys that mean something else.

THE REFUSAL WAS CORRECT AND IT EXPIRES THE MOMENT THE KEY EXISTS. Every number the sentence needs is already in the one `/api/simulate` response this screen reads.

THE WORK, in order:
1. Give the mockup s readout a `data-t` key. This is a mockup edit and it is ruled, not assumed -- same shape as the .cmd ruling on proc.
2. Add the key to en.js AND he.js. strings-parity compares both tables against the mockup s key set in BOTH directions; the Hebrew is not optional.
3. Build the readout. simulate.js s own header says ten lines, and its numbers are already in hand.

THIS DOES NOT DEPEND ON THE SWEEP. The readout was refused for a SECOND and independent reason from the staircase above it, and the file says so. The only reason to sequence it after the staircase is that it sits underneath one -- a presentation question, not a blocking one.
