---
id: DEC-a-drifted-source-is-a-warning-and-the-mockup-moves-to-match
type: decision
title: a drifted source is a warning, and the mockup moves to match
status: active
severity: soft
always: false
summary: "A quoted file that has moved on since it was copied is a warning, not an error: the record is stale, not broken, and one command brings it up to date."
summary_of: b6cda359bf628a50
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:doctor"
  - doctor
  - mockup
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 1d700cdb9c3c14ca
---

# a drifted source is a warning, and the mockup moves to match

OWNER RULING, 2026-08-25, in the doctor walkthrough of plan:port seq:98.

`src/doctor/checks.ts` emits `source_drift` at `level: "warn"` (~241 and ~306). The design of record draws it in the ERROR card. THE ENGINE IS RIGHT and the mockup moves the row to its warning card.

THE REASON: a drifted source means the SNAPSHOT is stale, not that anything is broken. The item still governs, its citation still resolves, and `mycontext refresh <id>` fixes it in one step. `source_missing` is already the ERROR beside it, and the distinction between gone and merely moved on is worth keeping -- collapsing the two would leave nothing to say when a source really has disappeared.

WHAT WAS WEIGHED AGAINST IT: a citation that no longer matches its source is a claim the corpus is making falsely, and this project does treat a silently wrong record as worse than a missing one. Declined because on this repository drift is a COMMON state, and a doctor that is routinely red stops being read -- which costs more than the distinction is worth.

NOTE THAT THE UI WAS NEVER WRONG. doctor.js renders the level the engine hands it. This is the design of record disagreeing with the engine, found only because the walkthrough read both.
