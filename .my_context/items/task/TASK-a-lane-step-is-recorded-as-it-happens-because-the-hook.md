---
id: TASK-a-lane-step-is-recorded-as-it-happens-because-the-hook
type: task
title: a lane step is recorded as it happens, because the hook already fires and the payload already names the lane
status: active
severity: soft
always: false
summary: Steps are written live from the tool-use hook instead of only being backfilled when a lane stops.
summary_of: 88948f14d6cee65b
scope:
  - hooks/hooks.json
  - src/hooks/**
tags:
  - v2
  - hooks
  - audit
  - live
  - "plan:hooks"
  - "seq:33"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: c3bc9d81c88aeb46
plan: hooks
seq: "33"
state: done
priority: "1"
verified_on: 2026-09-04
---

# a lane step is recorded as it happens, because the hook already fires and the payload already names the lane

Owner ruling 2026-09-04: widen the PostToolUse matcher, unguarded by config. He was asked
because he had reverted a matcher widening once before, and the distinction he ruled on is that
the earlier one was PreToolUse, which can BLOCK through permissionDecision deny, while
PostToolUse only observes and has no such path.

A probe on 2026-09-04 settled what had been guessed at three times. Hooks DO fire inside a
running lane, per tool call, live, minutes before the stop event and never batched. The payload
carries agent_id and agent_type on every in-lane firing. The reason no audit row has ever
carried an agent id is that post-tool-use.ts does not read those fields, which is this project’s
own omission rather than a platform limit. The probe record under reports holds the evidence.

Two changes and neither is speculative. The PostToolUse matcher covers Write, Edit, MultiEdit
and Agent, so the Bash, Read and Grep calls that make up most of a lane’s work fire nothing.
And the handler must read agent_id and agent_type and attribute the row to the lane.

THE TRAP THAT MUST BE DECIDED BEFORE ANY CODE. Steps are ALSO backfilled at SubagentStop by
reading the lane transcript, and that path was verified correct, extracting 82 of 82 steps from
a real transcript. Writing live rows without settling this records every step twice. This
project has already shipped a double-logging defect once, when a self-registered settings file
duplicated the plugin manifest and every event was recorded twice, so the failure mode is known
and was expensive. Decide whether the backfill stops when live rows exist, whether the live
writer is the only writer, or whether the two are reconciled on read, and state which.

What a reader gets: the sentence the owner actually asked for. The terminal shows a lane as its
agent type beside a one-line description, and that description is tool_input.description, which
the subject key list already tries first and already parses correctly. 58 percent of real Bash
calls carry one. Live rows put that sentence in the stream while the lane is still working.

Volume is the real cost and must be measured rather than assumed. One row per tool call in every
project that installs this plugin is a large increase, and a lane already backfills bursts of
about 150. Measure what the change adds over a representative session and say whether anything
downstream, the feed window in particular, needs to change with it.
