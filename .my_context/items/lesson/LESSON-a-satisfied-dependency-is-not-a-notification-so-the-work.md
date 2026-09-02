---
id: LESSON-a-satisfied-dependency-is-not-a-notification-so-the-work
type: lesson
title: a satisfied dependency is not a notification, so the work behind it never resumes
status: active
severity: soft
always: false
summary: Work paused until something else finishes never restarts, because finishing that thing tells nobody who was waiting on it.
summary_of: 3d11d1fee02e87b6
scope: []
tags:
  - v2
  - process
  - reconciliation
  - lesson
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 90b3bd777e81ad3e
---

# a satisfied dependency is not a notification, so the work behind it never resumes

plan:walk seq:23 found this three times in one afternoon, in three different plans, and it is the same mechanism each time: a task records WHAT WOULD UNBLOCK IT, that thing subsequently happens, and nobody comes back.

  `plan:port seq:6` -- "ui3 tasks 4 and 5 build the statusline, which is what would let the context group leave its noBridge state". Both done. The strip still tells every user the bridge is not installed.
  `plan:port seq:94` -- "DEPENDS ON seq 95". seq:95 done, inventory built and reviewed with the owner. seq:94 sat untouched while the failure it prevents was hit four more times.
  `plan:ui2 seq:5r` -- "BLOCKED BY plan:port seq:95, the mockup is frozen until the tree-parity inventory is reviewed". It was reviewed, screen by screen, with the owner.

AND ONE MORE OF THE SAME FAMILY, found the day before: three refusals in the UI named the condition that would end them, in comments nothing checks, long after the condition was met.

WHY IT KEEPS HAPPENING. A dependency is written in the BLOCKED task, and the task that satisfies it never learns it was a blocker. Closing a task is a local act; the edge points the wrong way for anybody to traverse at the moment it matters.

WHAT ACTUALLY CATCHES IT: nothing today. `doctor` does not read blockers, no gate reads prose, and the corpus has `link` but almost nothing uses it for this. The two mechanisms that would:
  1. `plan:walk seq:11` -- a refusal must state its unblocking condition WHERE A GATE CAN TEST IT, not in a comment. That is the same fix one layer down, and it should be widened from refusals to task blockers.
  2. Closing a task asks what it unblocks, and the answer is written on the tasks that were waiting, not on the one that closed.

UNTIL EITHER EXISTS, A PERIODIC SWEEP IS THE ONLY CATCH -- which is what this reconciliation was, and it found three in one pass. That is a measurement of how often the sweep is worth running, not a reason to be satisfied with it.
