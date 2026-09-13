---
id: TASK-configure-draws-one-sentence-three-times-gives-an-arrow-two
type: task
title: Configure draws one sentence three times, gives an arrow two meanings side by side, and truncates the file path
status: active
severity: soft
always: false
summary: The settings screen repeats the same explanation three times without saying which is which, uses one arrow for two different meanings, and cuts off the path to the file it is editing.
summary_of: 86ce0f9fad7c0c2d
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - configure
  - ambiguity
  - "plan:walk"
  - "seq:165"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 03c855d02ae17b2b
plan: walk
seq: "165"
state: todo
priority: "3"
---

# Configure draws one sentence three times, gives an arrow two meanings side by side, and truncates the file path

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 2.6) as row 96 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED on the Configure screen, three separate defects in one place:
- The same "what changes" sentence is drawn THREE TIMES with nothing naming which is which.
- The arrow `→` means "shipped default → in force" in one table and "old → new" in the plate beside it -- one glyph, two meanings, adjacent.
- There is no `<thead>` and no `<caption>` on either table.
- The config path sits in a 319 px input, TRUNCATED MID-PATH, under a sentence telling the reader it is the exact file.

THE SUBJECT. D48 is Configure composing a change and something confirming it took. A reader here cannot tell which of three identical sentences applies to the change they are about to make, and cannot read the path of the file the screen says they are editing.
