---
id: TASK-the-strip-cannot-say-injections-today-or-audit-append-p95
type: task
title: the strip cannot say injections-today or audit append p95 yet
status: active
severity: soft
always: false
summary: Two figures the design puts in the bottom strip are missing, left out along with their separators so the strip is short but true.
summary_of: 0a9e784311688fcb
scope: []
tags:
  - "plan:port"
  - "seq:6"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 02ce22a0d110f7bc
plan: port
seq: "6"
state: todo
---

# the strip cannot say injections-today or audit append p95 yet

renderChrome builds the status strip with the git group and the item count live, and the context group in its honest noBridge state. Two segments the mockup carries are absent: the injections-today count and the audit append p95, both of which need an audit aggregate the read surface does not expose. Their separators are omitted with them so the bar reads as a shorter TRUE bar rather than a complete one with holes - inventing a number for a bar whose whole job is provenance would be the exact defect it exists to prevent. Note that ui3 tasks 4 and 5 build the statusline, which is what would let the context group leave its noBridge state.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, BUT IT SPLITS IN TWO, and one half is buildable today by a dependency that was satisfied and never revisited. This is a NEW FINDING, not a restatement.

HALF ONE -- THE CONTEXT GROUP -- IS UNBLOCKED AND IS NOW A DEFECT RATHER THAN AN ABSENCE. This task s own note says "ui3 tasks 4 and 5 build the statusline, which is what would let the context group leave its noBridge state". BOTH ARE DONE. And more than the command exists:
  core/statusline-tee.ts writes the sample to disk, joined on session_id
  `watch-model.ts` · `context: classifyContext(tee.payload),` · ~405 reads it with readTee() and classifies it with classifyContext()
  `watch-model.ts` · `no bridge installed, or this session was never sampled` · ~272 already names the null case: "no bridge installed, or this session was never sampled"
  /api/watch/context IS REGISTERED and serves it
Meanwhile app.js:736-738 appends strip.ctx.noBridge UNCONDITIONALLY -- it never asks. So the strip tells every user the bridge is not installed, including the users who have installed it. A provenance bar stating an unchecked fact is the precise defect that bar exists to prevent, and it is the same class as the Tutorials screen s twelve hard-coded checkmarks.

HALF TWO -- INJECTIONS TODAY AND THE AUDIT APPEND p95 -- STANDS UNCHANGED. Both need an audit aggregate the read surface does not expose, and omitting them with their separators, so the bar reads shorter and TRUE rather than complete with holes, remains the right treatment until the aggregate exists.

WHY HALF ONE MATTERS BEYOND THE STRIP: the same sample is what the owner s own idea for the simulator rests on (plan:walk seq:8, "anchor the simulator on the real context window, from the status line"). seq:8 is blocked on walk seq:7 for a REAL reason -- a marker needs a chart to sit on -- but the strip needs no chart.
