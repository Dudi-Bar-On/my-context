---
id: TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which
type: task
title: a timestamp is shown in the reader's own zone, and says which zone that is
status: active
severity: soft
always: false
summary: Times in a saved conversation are shown in the reader's local clock and name the zone, instead of silently showing a different one.
summary_of: d940def044091e18
scope:
  - src/ui/**
  - src/cli/commands/conversation.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:18"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 1f148a329a4977d5
plan: archive
seq: "18"
state: todo
priority: "1"
---

# a timestamp is shown in the reader's own zone, and says which zone that is

Found 2026-09-08 by the owner, and his diagnosis was better than mine. He reported "about 3 hours
missing" from the archive. It is not missing: THE VIEWER RENDERS THE STORED UTC STAMP RAW, and he is
UTC+3. Measured the same minute: 14:11Z here, 17:11 on his clock. Every time in the document reads
exactly three hours behind, so a session that ran until 17:00 looks like it stopped at 14:00.

NOTHING IS ABSENT. This is a formatting defect and it produced a false report of data loss, which is
the more expensive kind: it sent me to measure a stale index when the screen was simply lying about
the clock.

AND IT IS NOT THE SAME BUG AS plan:archive seq:14, though they were reported together. seq:14 is
real and separate: the index still says his session ended 2026-09-07T00:50 while the file is
current. One is a day of missing CONTENT; this is three hours of wrong PRESENTATION.

WHAT TO BUILD: render in the reader's local zone AND NAME THE ZONE. A bare local time is only
unambiguous to someone who already knows which clock it is - and a transcript is exactly the artefact
somebody reads on a different machine, in a different country, months later. The stored value stays
UTC; only the display moves.

THE TRAP, and it will bite whoever does this: THIS PROJECT PINS RENDERING FOR DETERMINISM.
test/helpers/pin-rendering.ts exists, and a lane had to pin toLocaleString('en-US') for a thousands
separator because a bare locale call differs by machine. A naive toLocaleString() here makes the
tests machine-dependent and the failure will look like flake. Pin the locale; take the ZONE from the
reader.

AND THE HEBREW STAMP IS ALREADY DELICATE: the viewer lane found a stamp reordering to
"09:00 2026-09-08" under RTL, because a date and a time are two neutral runs, and fixed it with
dir="ltr" on the <time> element. Whatever formatting lands must keep that.

ONE QUESTION TO ANSWER RATHER THAN ASSUME: whether the LIST and the CLI table need the same
treatment. `mycontext conversation list` prints the raw Z stamp too. A reader comparing the screen
against the terminal must not see two different times for one session.
