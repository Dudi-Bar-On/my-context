---
id: TASK-the-handover-ask-is-verified-not-assumed-a-flag-precompact
type: task
title: the handover ask is verified, not assumed - a flag PreCompact compares against
status: active
severity: soft
always: false
summary: Check whether the handover notes were really written after being asked for, and say so plainly when they were not.
summary_of: d9d3da80a137dc13
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 30c022e1be8e79fd
plan: handover
seq: "9"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the handover ask is verified, not assumed - a flag PreCompact compares against

See DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is. The owner named this on 2026-08-27 and it closes a hole `plan:handover seq:6` shipped with.

WHAT TO BUILD:

1. The latch gains `askedAt` (wall clock) beside `askedAtThreshold`. `Stop` already writes the latch before returning the ask, so no new failure direction is introduced.
2. `PreCompact` compares the handover file's mtime against `askedAt` and records the verdict on its audit row -- it already resolves the handover and already carries `occupancyPercent` and `trigger`, so this is a third field on a row already about exactly this moment.
3. An IGNORED ask discloses on stderr. A stale handover about to be destroyed by a compaction is precisely the silence this feature exists to answer.
4. `SessionEnd` with `reason: 'clear'` gets the same check -- the other boundary that destroys a window.
5. The latch stops meaning "asked" and starts meaning "asked and not yet satisfied", so an ignored ask can be asked ONCE more. Bounded at two, and the second names the first.

WHAT NOT TO BUILD: no third ask. A hook that nags is a hook that gets uninstalled, and the audit row is the accountability story for the ones that went unanswered.

DONE WHEN: an ask that was acted on and an ask that was ignored are distinguishable in the log without reading the handover; an ignored ask is disclosed once; a second ask happens at most once and names the first.
