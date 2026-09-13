---
id: TASK-a-transient-read-error-permanently-breaks-a-conversation
type: task
title: a transient read error permanently breaks a conversation mirror and deletes the owner's standing persist mark
status: active
severity: soft
always: false
summary: A momentary read failure permanently marks a saved conversation as broken, deletes the instruction to keep it, and refuses to try again.
summary_of: 2fd6c56057cbc57d
scope:
  - src/core/conversation-index.ts
  - src/core/**
tags:
  - v2
  - core
  - silent-failure
  - data-loss
  - inferred
  - "plan:swallow"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: de94c41c4e760ed6
plan: swallow
seq: "7"
state: todo
priority: "2"
---

# a transient read error permanently breaks a conversation mirror and deletes the owner's standing persist mark

INFERRED, NOT REPRODUCED. The path was read; the transient read error was never induced and the rewrite was never observed. THE FIRST STEP OF THIS WORK IS TO REPRODUCE IT on a throwaway mirror -- induce one read failure, then check the archive row, the persist mark and the note. If the damage is not what was read, that is a legitimate outcome and this item says so.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M16) as row 39 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES, AS READ. A transient read error permanently breaks a conversation mirror, under an explanation that is confidently false. Three things happen together: the archive row is rewritten as `exported`; THE OWNER'S STANDING PERSIST MARK IS DELETED; and `REPLACED_NOTE` is set, and it is sticky -- "Already broken. It is not retried."

WHY IT IS WORSE THAN A LOST READ. The owner's own instruction to keep a conversation is destroyed by a failure that had nothing to do with it, the state that records the destruction refuses to be re-tried, and the note explains the wrong cause.
