---
id: TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it
type: task
title: decide when to look at a session, and read the whole of it
status: active
severity: soft
always: false
summary: Work out when a session is worth reviewing and read everything that happened in it, without ever making the user wait.
summary_of: af0723ebab7a01c4
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: d9519e54f60175dc
plan: loop
seq: "2"
state: todo
priority: "1"
needs: loop/1
---

# decide when to look at a session, and read the whole of it

D36b. Plan: docs/superpowers/plans/2026-09-08-self-improvement-trigger-and-pass.md. Spec sections 2, 3, 5, 11.

IT ENDS AT A DRY RUN ON PURPOSE. The pass reads, writes a report, and creates NOTHING - so it can run
on real sessions for days before it is allowed to propose anything.

FIVE TASKS: a counter that cannot break the hook it lives in; incrementing it where an audit row is
already written; a RUBRIC, because a fixed counter is measured inferior (+6.3 points for rubric-gated
triggers, and fixed thresholds fire mid-derivation); the input, whole-transcript and subagents
included, through the reader plan:restore seq:1 already built; and the detached pass itself.

THE LOAD-BEARING ASSERTION is that Stop returns without waiting. That is the hook where a person is
staring at a prompt.

AND THE KILL SWITCH MUST ACTUALLY KILL - upstream shipped one that did not, because a second path
created anyway. One switch, one subsystem, and a test that with enabled:false no child is spawned.
