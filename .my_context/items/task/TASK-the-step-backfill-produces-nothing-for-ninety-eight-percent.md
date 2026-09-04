---
id: TASK-the-step-backfill-produces-nothing-for-ninety-eight-percent
type: task
title: the step backfill produces nothing for ninety-eight percent of lanes, so the screen has nothing to show
status: active
severity: soft
always: false
summary: Almost every stopped lane records no steps at all, which is why the audit stream shows empty lanes however the screen is fixed.
summary_of: 9ad83ff3fac160c5
scope:
  - src/hooks/**
  - hooks/hooks.json
tags:
  - v2
  - hooks
  - audit
  - "plan:hooks"
  - "seq:32"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 795b8a80251dcd2a
plan: hooks
seq: "32"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the step backfill produces nothing for ninety-eight percent of lanes, so the screen has nothing to show

Measured on the live corpus, 2026-09-04, after three separate screen fixes each moved the
problem without solving it. Of 990 distinct agents carrying a subagent-stop record, only 15 have
any agent-step row at all. 975 have none. Every one of those draws on screen as a lane with zero
steps and a disabled expand control, which is the screen honestly reporting that there is
nothing to expand.

This is the root cause the earlier work was downstream of. The feed bound, the lane grouping and
the on-demand step lookup are all real fixes and none of them could help, because the records
they were arranging are not being written. The owner has now reported not seeing steps four
times and each answer addressed a different layer above this one.

A second measurement points at the same place from another angle: 947 of 997 stop records carry
type=<absent>, meaning no matching agent-dispatched record exists for them. Only 50 are
attributed.

Two readings fit and they need different fixes, so establish which before building. Either these
are real lanes whose transcripts are not being read, in which case the backfill is failing and
the steps are recoverable; or SubagentStop is firing for things that are not lanes at all, in
which case the log is being filled with rows that should never have been written and the screen
is faithfully drawing noise. The second would also mean the counts this project reports about
lanes are wrong.

Where to look: the backfill reads agent_transcript_path at stop. That field was previously probed
and found delivered, pointing at a real file of 243 KB, so an absent field is not the obvious
explanation and must be checked rather than assumed. Compare the 15 that work against the 975
that do not and name what differs, because that comparison is the whole answer.

What must be true at the end: either a stopped lane records its steps, or the log says why it
could not, per this project’s standard that a measured zero is drawn and named while an
unmeasured thing is not. A row that silently records no steps is indistinguishable from a lane
that did nothing, and that ambiguity is what has cost four rounds of investigation.
