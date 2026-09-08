---
id: TASK-the-work-done-in-subagents-is-indexed-and-kept-because-that
type: task
title: the work done in subagents is indexed and kept, because that is where the reasoning is
status: active
severity: soft
always: false
summary: The separate records of work done by helper agents are listed and preserved alongside the main conversations, instead of being lost when temporary files are cleared.
summary_of: 86f2ac841c3c8847
scope:
  - src/core/conversation-index.ts
  - src/ui/**
tags:
  - v2
  - archive
  - "plan:archive"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 5fc75b9b5ee3b314
plan: archive
seq: "12"
state: todo
priority: "1"
---

# the work done in subagents is indexed and kept, because that is where the reasoning is

Owner ruling 2026-09-08, from a measurement he asked for.

MEASURED IN THIS WORKSPACE, and the numbers are the argument:
  478 subagent transcripts, 91 MB, in the harness temp directory
  61 MB for the session transcript itself
  2 files indexed by the archive - it sees NONE of the 478

THE ASYMMETRY MATTERS MORE THAN THE SIZE. The session transcript holds each lane’s REPORT. The
subagent transcripts hold their REASONING. In one day lanes corrected the assistant at least eight
times - a similarity threshold that would have refused 207 of 207 writes; RETIRED_STATUSES wrong in
both directions; 54 dependent specs rather than 24; a token cost that does not exist. The conclusions
are in the session. The working is in the 91 MB.

AND THEY ARE IN A TEMP DIRECTORY, so they will be deleted. That is what makes this urgent rather
than tidy.

WHAT TO BUILD: extend plan:archive seq:1’s scanner to the task directory, and extend seq:4’s
persistence to cover it - the same mechanism, a second kind of file. seq:1 is state:done, which is
why this is a new item rather than an edit.

WHAT TO DECIDE RATHER THAN ASSUME. A subagent transcript is not a conversation with a person, so it
may not belong in the same list on the same screen - it may want to hang UNDER the session that
spawned it, which is also how a reader would look for it. Measure what the harness records about the
parent-child link before designing the list.

AND THE COST IS REAL: the index grows by two orders of magnitude in file count. Whatever the list
does, it must not make the archive screen unusable to serve a case that is mostly read by machines.
