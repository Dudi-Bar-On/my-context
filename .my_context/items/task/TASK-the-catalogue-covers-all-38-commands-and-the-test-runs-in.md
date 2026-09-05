---
id: TASK-the-catalogue-covers-all-38-commands-and-the-test-runs-in
type: task
title: the catalogue covers all 38 commands, and the test runs in BOTH directions
status: active
severity: soft
always: false
summary: Describe every command the tool has, not just the ones the screens use, and check that description against reality in both directions.
summary_of: 8d6f1b902eda9c2a
scope: []
tags:
  - "plan:builder"
  - "seq:3"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 5b0b8a6587fe3324
plan: builder
seq: "3"
state: todo
needs: builder/1, builder/2
progress: "50"
last_change: 2026-08-31
---

# the catalogue covers all 38 commands, and the test runs in BOTH directions

OWNER RULING 2026-08-24: all 38, not only the 22 the screens compose today.

MEASURED: the CLI registers 38 commands; `lib/palette-defs.js` defines 20; and three more (`audit`, `init`, `procedure`) are hand-built inside screens, bypassing the catalogue.

THE TEST IS THE HALF THAT LASTS. `palette-lib.test.ts` fails the catalogue when it advertises a flag the command refuses - one direction. The other direction is unchecked: a flag the CLI HAS and the catalogue lacks is invisible, and so is a command missing from the catalogue entirely. Make it fail BOTH ways, the way `KNOWN_GAPS` in screen-parity already does: an unlisted gap is a regression AND a closed entry must be deleted.

Derive the catalogue from seq 1's lifted specs rather than maintaining a parallel list. A catalogue that is a second description of the parsers is the drift this plan exists to end.

DEPENDS ON seq 1 and 2.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. Owner ruling 2026-08-24, all 38 rather than the 22 the screens compose today, against a catalogue that defines 20 with three more hand-built inside screens. Its second half is the durable one and is the pattern this project already trusts: make the test fail in BOTH directions, the way KNOWN_GAPS in screen-parity does -- an unlisted gap is a regression AND a closed entry must be deleted. A one-directional gate is how the catalogue silently falls behind the parsers, which is the drift this plan exists to end.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
