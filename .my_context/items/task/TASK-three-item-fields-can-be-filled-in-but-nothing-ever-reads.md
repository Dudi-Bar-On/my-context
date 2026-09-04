---
id: TASK-three-item-fields-can-be-filled-in-but-nothing-ever-reads
type: task
title: three item fields can be filled in but nothing ever reads them back
status: active
severity: soft
always: false
summary: A blocked-on pointer, an assumption's checkup date and a reference's source file can all be set on an item, and no check reads any of them back.
summary_of: 8b382b1e9b5065a0
scope:
  - src/doctor/checks.ts
tags:
  - v2
  - categories
  - doctor
  - "plan:categories"
  - "seq:25"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 1a762841c6f6d5be
plan: categories
seq: "25"
state: todo
priority: "2"
---

# three item fields can be filled in but nothing ever reads them back

Build three doctor checks (src/doctor/checks.ts), one per field, following `checkTaskUnverified`'s pattern (same file) — a date- or presence-comparison finding, registered in the same check pipeline every other doctor check runs through.

**open_question.blocks.** Add a check that surfaces every `open_question` carrying a `blocks` value as a finding naming what is waiting on it — an informational-level finding is enough; the point is that the dependency becomes visible from the corpus rather than only from the open_question's own prose.

**assumption.validate_by / validated_on.** Add an overdue-assumption check: an `assumption` whose `validate_by` date has passed with no `validated_on` set is a finding. Mirror `checkTaskUnverified`'s date-comparison shape exactly — including a birth-cutoff the way that check's `VERIFIED_ON_INTRODUCED_AT` works, so an assumption captured before this check existed is not retroactively flagged.

**reference.source_file.** Add a finding for a `reference` item with no `source_file` at all. Today `checkSourceDrift` (src/doctor/checks.ts, ~line 545) only examines items that already carry `sourceFile`/`sourceAnchor`/`sourceChecksum` — a `reference` created with none of the three is invisible to every existing check, even though the category's whole stated purpose ('A snapshot of a file, with its origin recorded so doctor reports drift') depends on one being set.

Each new check needs a help/topic entry documenting it and a test, matching the pattern `verified_on`'s doctor check set (task.plan/categories seq: see the verified_on task) already established. Owner's own words on why this matters: 'the check is not optional — it is the whole point.'
