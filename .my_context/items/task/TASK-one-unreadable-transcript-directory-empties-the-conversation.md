---
id: TASK-one-unreadable-transcript-directory-empties-the-conversation
type: task
title: one unreadable transcript directory empties the conversation index, and the hook blames deleted files
status: active
severity: soft
always: false
summary: If one folder cannot be read the whole conversation history looks empty, and the message that follows confidently blames the wrong thing.
summary_of: d4b2b44d85854c56
scope:
  - src/core/conversation-index.ts
  - src/hooks/**
tags:
  - v2
  - core
  - silent-failure
  - inferred
  - "plan:swallow"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 10a13bec8bbcbe00
plan: swallow
seq: "6"
state: done
priority: "2"
---

# one unreadable transcript directory empties the conversation index, and the hook blames deleted files

INFERRED, NOT REPRODUCED. The path was read; no transcript directory was made unreadable and the empty index was never observed. THE FIRST STEP OF THIS WORK IS TO REPRODUCE IT -- deny read on the transcript directory, rebuild, and observe the index, `sourcesOf`, the retrieval pointers and the Stop hook's sentence. If it does not behave as read, that is a legitimate outcome and this item records it.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M15) as row 38 of `reports/2026-09-13-the-consolidated-findings.md`.

THE CHAIN AS READ. One unreadable transcript directory empties the conversation index, the search index's `sourcesOf`, and every retrieval pointer. The Stop hook then reports "N indexed session(s) no longer on disk".

WHY THAT SENTENCE IS THE DEFECT. It is confident, it is specific, and its cause is wrong. The sessions ARE on disk; the directory could not be read. A reader sent to look for deleted files will not find the permission problem.
