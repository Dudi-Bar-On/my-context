---
id: TASK-every-command-site-uses-the-builder-including-the-three-that
type: task
title: every command site uses the builder, including the three that bypass the catalogue
status: active
severity: soft
always: false
summary: Make every place that offers a command use the one shared builder, starting with three that were hand-built and have drifted from it.
summary_of: f8337fb5e2abbba4
scope: []
tags:
  - "plan:builder"
  - "seq:7"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 82f887a78bc72084
plan: builder
seq: "7"
state: todo
needs: builder/5, builder/6, port/95
---

# every command site uses the builder, including the three that bypass the catalogue

The coverage half of the requirement: "everywhere there is a command builder ... include all of them".

MEASURED: `composeCommand` is called by capture, coverage, packs, palette, port, proc and work; `config.js`, `doctor.js` and `gaps.js` compose through `viewmodel.js`. And `audit`, `init` and `procedure` are built by hand inside screens, outside the catalogue and outside its test.

Those three are the ones to do first: they are the drift, and they are the proof the pattern generalises. Then the rest, screen by screen.

Doctor's remedy block is worth its own thought: it composes a command FOR a finding rather than from a user's choices, so the builder there is prefilled and the check is a receipt rather than a gate. That is a legitimate second mode, not an exception to sneak in.

DEPENDS ON seq 5 and 6. BLOCKED BY plan:port seq:95.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. The coverage half, and its measurement is its plan: composeCommand is called by capture, coverage, packs, palette, port, proc and work; config.js, doctor.js and gaps.js compose through viewmodel.js; and audit, init and procedure are built BY HAND inside screens, outside the catalogue and outside its test. Those three first -- they are the drift, and they are the proof the pattern generalises. Doctor s remedy block is correctly flagged as a legitimate SECOND MODE rather than an exception: it composes a command FOR a finding rather than from a user s choices, so the builder is prefilled and the check is a receipt rather than a gate.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
