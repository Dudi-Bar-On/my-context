---
id: TASK-the-status-strip-says-the-bridge-is-not-installed-without
type: task
title: the status strip says the bridge is not installed without ever asking
status: active
severity: soft
always: false
summary: The strip tells everyone that a component is not installed without ever checking, including the people who installed it.
summary_of: bb072681297f706d
scope: []
tags:
  - v2
  - ui
  - "screen:status"
  - api
  - reconciliation
  - "plan:walk"
  - "seq:29"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 218aa8a1cc46899f
plan: walk
seq: "29"
state: done
priority: "1"
source: "plan:walk seq:23, reconciliation of plan:port seq:6"
---

# the status strip says the bridge is not installed without ever asking

FOUND 2026-08-25 by plan:walk seq:23, the reconciliation. Not previously recorded anywhere, and it is a defect rather than an absence.

THE STRIP LIES, in the one place built to stop the product lying. `src/ui/public/app.js:736-738` appends `strip.ctx.noBridge` to the context group UNCONDITIONALLY, with no check of any kind. That string says: "showing only what mycontext injected -- that is all this number is. The status line bridge is not installed." Every user reads that sentence, including every user who has installed the bridge.

IT WAS TRUE WHEN IT WAS WRITTEN. `plan:port seq:6` recorded the context group as honestly-absent and named its own unblocking condition in its body: "ui3 tasks 4 and 5 build the statusline, which is what would let the context group leave its noBridge state". BOTH ARE DONE. Nothing went back. That is the pattern `plan:walk seq:11` exists for -- a refusal naming its unblocking condition in a comment nothing checks.

THE DATA IS BUILT, SERVED AND REACHABLE TODAY:
  `core/statusline-tee.ts` writes the sample to disk, joined on session_id
  `watch-model.ts` · `readTee(root, session)` · ~299 reads it with `readTee(root, session)`
  `watch-model.ts` · `classifyContext(tee.payload)` · ~304 classifies it with `classifyContext(tee.payload)`
  `watch-model.ts` · `the NO-SAMPLE state: no bridge installed, or this session was never sampled` · ~272 already names the null case in its own words: "the NO-SAMPLE state: no bridge installed, or this session was never sampled"
  `GET /api/watch/context` is REGISTERED and serves it

THE WORK: the context group asks `/api/watch/context` and renders what it gets.

THE THREE STATES ARE THE DESIGN, and they are already written down in `plan:walk seq:8`, which rests on the same sample: KNOWN, NOT-YET-KNOWN (no API call since the last compact), and UNKNOWN (this Claude Code sends no context_window). In the two that are not known the number is ABSENT AND NAMED -- never guessed, never drawn at a default. And the existing `noBridge` sentence is the FOURTH state, correct only when `readTee` finds nothing.

DO NOT CONFLATE NO-BRIDGE WITH NO-SAMPLE. `watch-model.ts` · `is the NO-SAMPLE state: no bridge installed, or this session was never sampled` · ~291 deliberately covers both with one null and says so. A session that has a bridge and has not been sampled yet is not a session with no bridge, and telling the second story about the first is how this defect came to exist in the first place.

THIS IS HALF OF `plan:port seq:6`. The other half -- injections-today and the audit append p95 -- still needs an audit aggregate the read surface does not expose, and stays there.

AND IT UNDERPINS AN OWNER IDEA: the same sample is what `plan:walk seq:8` anchors the simulator on. seq:8 is blocked on seq:7 because a marker needs a chart to sit on. The strip needs no chart.
