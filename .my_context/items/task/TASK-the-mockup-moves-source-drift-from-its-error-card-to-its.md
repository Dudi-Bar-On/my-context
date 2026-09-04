---
id: TASK-the-mockup-moves-source-drift-from-its-error-card-to-its
type: task
title: the mockup moves source_drift from its error card to its warning card
status: active
severity: soft
always: false
summary: One health finding is drawn as an error but reported as a warning; move it, and move its suggested fix along with it.
summary_of: 05dfd93bd6e92620
scope: []
tags:
  - v2
  - ui
  - "screen:doctor"
  - tree-parity
  - mockup
  - "plan:walk"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: dbdf1d7bfd6e6be0
plan: walk
seq: "17"
state: done
priority: "2"
source: "plan:port seq:98, doctor"
---

# the mockup moves source_drift from its error card to its warning card

Carries out the ruling that a drifted source is a warning.

The mockup draws `source_drift RULE-never-log-customer-email` in the ERROR card. `src/doctor/checks.ts` emits it at `level: "warn"`. Move the row.

THE APP NEEDS NO CHANGE. doctor.js renders the level the engine hands it and always has; this is the design of record catching up with the engine.

CHECK THE CARD S COMMAND MOVES WITH IT. The mockup s error card carries `mycontext refresh RULE-never-log-customer-email`, which is that row s repair -- `repairCommandFor` earns it for `source_drift`. Move the row and its command together, or the error card keeps a repair for a finding that is no longer in it.

AFTER: the mockup s error card is EMPTY, which is a state the design has never drawn. doctor.js s own header already rules on it -- "A clean corpus draws three empty cards, not an empty screen. Owner ruling: empty renders the real markup with zero rows" -- so the mockup should draw it the same way rather than dropping the card.

CLOSED 2026-08-26 AS MOOT, under `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`.

This task s own body says it: "THE APP NEEDS NO CHANGE. doctor.js renders the level the engine hands it and always has; this is the design of record catching up with the engine." Under the ruling taken today, the design of record does not have to catch up. The mockup is history and a list of intended-but-unbuilt features, and a row drawn in the wrong card of a historical drawing is neither.

THE PRODUCT IS ALREADY CORRECT and was never wrong: `src/doctor/checks.ts` emits `source_drift` at `level: "warn"` and the screen draws it in the warning card. What would have changed is one row in one HTML file, with no effect any user could see.

THIS IS THE FIRST TASK THE RULING RETIRES, and it is worth naming as a class rather than as one item: a queued edit whose whole content is "make the drawing agree with the code" is now work with no product behind it. Anything genuinely intended and unbuilt still fails the gap direction of the parity gates, which is untouched.
