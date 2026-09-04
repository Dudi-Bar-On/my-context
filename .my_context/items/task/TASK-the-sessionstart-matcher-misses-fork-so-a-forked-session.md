---
id: TASK-the-sessionstart-matcher-misses-fork-so-a-forked-session
type: task
title: the SessionStart matcher misses 'fork', so a forked session gets nothing
status: active
severity: soft
always: false
summary: A session started by branching off another is given nothing at all, and nothing anywhere says so.
summary_of: 17de561def5aef44
scope: []
tags:
  - "plan:hooks"
  - "seq:0f"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: f16c6cab610c9d64
plan: hooks
seq: 0f
state: done
priority: "1"
---

# the SessionStart matcher misses 'fork', so a forked session gets nothing

Found on 2026-08-22 by reading the shipped binary rather than by running anything.

Claude Code 2.1.239 declares the SessionStart source as a five-value enum in its own payload schema: Or(["startup","resume","clear","compact","fork"]). hooks/hooks.json matches startup|clear|resume|compact. Nothing anywhere in src/, hooks/ or test/ mentions fork.

So a forked session fires SessionStart, matches no entry, and receives no injection at all - and says nothing, because a hook that never runs cannot disclose that it did not. That is INV-nothing-is-dropped-silently failing at the outermost edge of the system, where nothing downstream can catch it.

What is NOT yet established: whether the platform actually sends fork for a user-visible action, and what a fork is. A schema proves a value is legal, not that it occurs. The probe agent is tracing the call site.

The fix is one word in a matcher, but hooks.json is a shipped manifest and adding a source changes what the hook runs on - the owner rules on it. If fork does occur, the clear-path guard needs re-examining too: a fork inherits a parent's context, so whether it should clear the dedupe state is the same question SubagentStart raised.
