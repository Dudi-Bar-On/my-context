---
id: TASK-idlemonitor-integer-a-maximum-and-a-validated-onidle
type: task
title: "IdleMonitor: integer, a maximum, and a validated onIdle"
status: active
severity: soft
always: false
summary: "Tighten the timer that shuts an idle server down: reject fractions, absurdly long waits and a missing callback, at the moment it is set up."
summary_of: 13307ae80e2fb189
scope: []
tags:
  - "plan:rulings"
  - "seq:23"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: a0ef6b77f77f4bd6
plan: rulings
seq: "23"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# IdleMonitor: integer, a maximum, and a validated onIdle

Ruling B1, in src/ui/idle.ts. The constructor already refuses non-finite and non-positive windows.

INTEGER - Number.isInteger(x) && x > 0, matching `src/cli/commands/audit.ts` · `if (!Number.isInteger(parsed) || parsed <= 0) {` · ~96 and `src/cli/commands/search.ts` · `!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit)` · ~131, which are the repo's own precedent for --limit. Rejects 1.5.
A MAXIMUM - Number.MAX_VALUE currently passes: a window of about 10^295 years, which is functionally the Infinity failure the guard just outlawed arriving through the front door. State the bound and defend it in the message.
onIdle IS A FUNCTION - refused in the CONSTRUCTOR. Today new IdleMonitor(1000, undefined) constructs fine and throws from inside a timer callback fifteen minutes later, where nothing catches it and the stack says nothing about the caller. Same argument that put the window check in the constructor.

Do not regress: the 10ms poll floor and its CONDITIONAL lateness comment, the unref() proven by a child process, and the injected-clock/ambient-clock split which is a separate unruled question. Every test proved red by mutation, and no test may sleep in real time.
