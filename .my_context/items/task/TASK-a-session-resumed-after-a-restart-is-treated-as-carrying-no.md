---
id: TASK-a-session-resumed-after-a-restart-is-treated-as-carrying-no
type: task
title: a session resumed after a restart is treated as carrying no epoch boundary, even when its window was rebuilt from a summary
status: active
severity: soft
always: false
summary: The context-window epoch assumes a resumed session keeps counting from where it left off, which is false when the resume rebuilds the window.
summary_of: a4d597031705b01c
scope:
  - src/core/context-share.ts
tags:
  - v2
  - rulings
  - context
  - "plan:rulings"
  - "seq:56"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 60c179f150686ea2
plan: rulings
seq: "56"
state: todo
priority: "1"
---

# a session resumed after a restart is treated as carrying no epoch boundary, even when its window was rebuilt from a summary

Correct `contextEpochStart` (src/core/context-share.ts, ~line 80) so a session resumed after a restart whose window was rebuilt from a compaction summary is treated as having a fresh epoch boundary at the resume, not as carrying the pre-restart epoch forward.

Today the function looks only for the session's latest `pre-compact` audit row and treats a session with none as 'never compacted' — correctly, for a session that has genuinely held everything it was ever injected. The docblock's claim that 'a session RESUMED after a restart keeps its id and its transcript, and so keeps its epoch — which is correct' is the part that needs correcting: it is only correct when the resume's transcript really is the full prior transcript, and false when the resume rebuilds the window from a summary, which drops what was actually resident.

Add a way to detect that case — for example, a dedicated audit op written at the moment a resumed session is found to have rebuilt its window from a summary, treated as an epoch boundary the same way `pre-compact` already is — and update the docblock to state the corrected rule once the fix lands. Add a test reproducing the measured case: a resumed session whose window was rebuilt from a summary, asserting the epoch resets rather than carries forward. Measured 2026-09-03: the current behaviour counted 663,975 tokens as resident that were gone, reading roughly 86% of the window against an actual roughly 33%.
