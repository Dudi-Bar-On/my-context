---
id: TASK-the-summary-is-staged-to-disk-reviewed-as-numbered-points
type: task
title: the summary is staged to disk, reviewed as numbered points, and injected only after the owner clears
status: active
severity: soft
always: false
summary: Bringing a summary of an earlier conversation back into a cleared window, after the owner has read what it contains and approved it.
summary_of: 6596765e333a1c18
scope:
  - src/core/**
  - src/cli/**
  - src/hooks/**
  - test/**
tags:
  - v2
  - archive
  - context
  - "plan:restore"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 86298a0c5e937447
plan: restore
seq: "2"
state: todo
priority: "2"
needs: restore/1
---

# the summary is staged to disk, reviewed as numbered points, and injected only after the owner clears

Design of record: docs/superpowers/specs/2026-09-07-session-summary-restore-design.md sections 3, 5 and 6. Owner ruling 2026-09-07.

THE SEQUENCE, and step 6 is his and nobody else can do it:
  1 PROPOSE  - agent or owner: this window has lost something the transcript still holds
  2 BUILD    - agent builds the summary against the recipe. AUTOMATIC, needs no approval
  3 REVIEW   - owner reads the SHORT form: numbered main subjects, one line each
  4 APPROVE  - owner approves. Nothing is injected yet
  5 STAGE    - the summary is WRITTEN TO A FILE ON DISK and its presence verified
  6 CLEAR    - THE OWNER clears the context window. His act
  7 DELIVER  - the next injection reads the file and delivers it into the empty window

WHY IT IS AN OVERRIDE AND NOT AN APPEND, which was the owner own answer to my objection: a hook
cannot REPLACE what is in a window - the harness owns it - so an injection is an append, and
appending to a window that is already too full is self-defeating. Clearing first is what makes the
append behave as an override. STAGING IS WHAT LETS IT SURVIVE THE CLEAR: a clear destroys everything
held only in the conversation, so the summary must be a FILE before the clear, never a message.
Step 5 must complete and be verifiable on disk BEFORE the owner is told it is safe to clear - "the
clear happens without the stage" is the one failure mode that loses the thing this exists to save.

BOTH HALVES ALREADY EXIST AND MUST BE REUSED. mycontext carry <id> already marks something for
delivery at the next injection, one-shot, then forgets - that is steps 5 and 7. The .staging/*.json
protocol already stages a decision a human has not taken yet, with a reader that deliberately
imports nothing which writes. And the SessionStart / compact-restore path already delivers into a
fresh window.

THE REVIEW FORM IS NOT THE PAYLOAD. Two artefacts: the PAYLOAD, as long as it needs to be, and the
REVIEW FORM - numbered main subjects, one line each - which is what he reads and approves. Same
division supersedeItem and execute already use: a person approves against a readable statement, not
against the bytes. AND THE CONSEQUENCE MUST BE STATED RATHER THAN DISCOVERED: he is approving a
summary he has not read in full, so the review form must be honest about COVERAGE - how much was
read, what the filter dropped, where the recipe skipped. A review form that reads as complete when
it is partial is worse than none.

NO BUDGET MANAGEMENT - owner ruling, explicit: it takes as much as it requires, because this is not
ongoing behaviour but the last option for restoring things that would otherwise be lost. The
existing tiers budget a RECURRING cost; this has none.

THE LOOP GUARD, or the feature degrades itself the second time it is used: an injected summary
becomes part of the transcript like everything else, so a later summary would summarise the summary.
Every injected summary carries a MARKER and the reader excludes marked records.

AND NEVER AUTOMATIC. An agent may propose and may build. ONLY THE OWNER INJECTS. If this is ever
being used weekly then the handover is failing and that is the thing to fix instead.
