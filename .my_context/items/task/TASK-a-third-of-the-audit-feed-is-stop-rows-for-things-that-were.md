---
id: TASK-a-third-of-the-audit-feed-is-stop-rows-for-things-that-were
type: task
title: a third of the audit feed is stop rows for things that were never lanes
status: active
severity: soft
always: false
summary: Stop records are written for events that are not subagents, and each draws as an empty lane the reader cannot open.
summary_of: bba9b47e3de02022
scope:
  - src/hooks/**
  - src/core/audit.ts
  - src/ui/public/screens/watch.js
tags:
  - v2
  - hooks
  - audit
  - ui
  - "plan:hooks"
  - "seq:34"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: dce98ba9b256bffa
plan: hooks
seq: "34"
state: done
priority: "1"
verified_on: 2026-09-04
---

# a third of the audit feed is stop rows for things that were never lanes

Measured 2026-09-04, after live steps landed. Of the newest 200 audit rows, 63 are
subagent-stop. A probe the same day established that about 95 percent of those are not lanes at
all: SubagentStop and top-level Stop share one emitter in build 2.1.260, reused by five or more
call sites including loop_tick and interrupt cleanup. Checked against the corpus, none of 100
retained lane transcripts match any stop id carrying type=<absent>, and all 100 match a typed
one.

The consequence is the screen the owner has complained about four times. Each phantom row draws
as a lane with zero steps and an expand control that cannot be opened, because there is nothing
to open. On his screen 72 of 74 lane rows were dead. That was never a rendering fault, a window
fault or a grouping fault, all three of which were investigated and fixed at real cost. It is a
third of the feed being rows that never described a lane.

What to decide, and it is genuinely a decision rather than an obvious fix. A stop that is not a
lane can be not written at all, which is cleanest but discards a real platform event the log may
later want. It can be written under a different op so it stops competing for the lane shape.
Or it can be written as it is and excluded where lanes are grouped. State which and why.

Whichever is chosen, the distinguishing fact is already recorded. A real lane carries an
agent_type and a phantom carries none, which is what the type=<absent> note already says out
loud after a fix landed the same day. So this needs no new detection, only a decision about what
to do with what is already known.

Beware the closed op list. Ops are grouped in families with a validate that refuses an unknown
op, and adding one is done the way that list requires rather than around it. Beware also the two
copies of the registered-hook table, one in core and one in the watch screen, held byte-identical
by a test; a new op touches both.

Verify as a user in a browser. The number that matters is how many lane rows can be opened, not
how many are drawn, and it should rise sharply without the feed losing anything real.
