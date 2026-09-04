---
id: TASK-the-audit-stream-opens-with-a-bounded-backlog-and-names
type: task
title: the audit stream opens with a bounded backlog, and names history from live
status: active
severity: soft
always: false
summary: The activity feed shows nothing until something new happens, so a busy project looks empty and nothing explains why.
summary_of: a844ffd68ba795e9
scope: []
tags:
  - v2
  - ui
  - watch
  - owner-reported
  - "plan:walk"
  - "seq:52"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ff1a48d432b8ecdb
plan: walk
seq: "52"
state: done
priority: "1"
source: owner reported 2026-08-27, dogfooding
---

# the audit stream opens with a bounded backlog, and names history from live

OWNER REPORT, 2026-08-27, dogfooding the REAL corpus: "the audit stream is blank without records, i think it is a bug".

MEASURED THE SAME HOUR, and he is right about the symptom while the cause is two causes:

  - the log holds 2,076 records; the newest was written minutes before he looked
  - `AuditTail`'s constructor sets every segment's offset to `sizeOf(file)` -- it starts at the END. **The feed is a live tail with NO BACKLOG**, so it shows nothing until something is appended after the screen opened
  - and independently, `/api/watch/volume` -- the pulse, the one surface that would show history -- answers **503**, because the projection is behind the log (`audit.db` 12:34 against `audit.jsonl` 15:46)

So a screen called the audit stream drew nothing over a corpus with two thousand records, and said nothing about why.

THIS IS THE STANDING STANDARD, BROKEN. STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is: *a measured zero is drawn and named; an unmeasured thing is named as unmeasured; neither is ever blank.* An empty live tail is UNMEASURED -- it does not mean "no records", it means "nothing since you opened this" -- and the owner read it the way the standard exists to prevent.

WHAT TO BUILD:

1. **A BOUNDED BACKLOG ON OPEN.** The stream replays the last N records before going live. N is the list bound, and the block declares what it held back, exactly as `boundedList` already does elsewhere.
2. **HISTORY AND LIVE ARE DISTINGUISHED**, visibly. A reader must be able to tell what was already there from what arrived while they watched -- otherwise the backlog just moves the confusion.
3. **AN EMPTY FEED SAYS WHICH EMPTY IT IS.** "Nothing has happened since you opened this" and "this corpus has no audit log" are different facts and neither is blank.

WHAT NOT TO DO: do not replay the whole log. Two thousand records into a live view is the same defect pointed the other way, and the list bound exists for that reason.

RELATED, AND SEPARATE: the pulse's 503 is its own task -- a refusal the server words perfectly and the screen does not show.
