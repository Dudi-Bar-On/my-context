---
id: TASK-std-absent-vs-zero-is-a-nickname-22-citations-use-and-no
type: task
title: STD-absent-vs-zero is a nickname 22 citations use and no item answers to
status: active
severity: soft
always: false
summary: A standard is cited across the corpus and the code by a short name that resolves to nothing, so a reader who follows the citation finds no item.
summary_of: 7000ef7e548c0aa2
acknowledged:
  - body_disagrees_with_meta@661e0fde8ef46d43
scope:
  - src/**
  - test/**
  - .my_context/items/**
tags:
  - v2
  - corpus
  - citations
  - "plan:rulings"
  - "seq:67"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: a6ef65fc90a2f2de
plan: rulings
seq: "67"
state: todo
priority: "3"
---

# STD-absent-vs-zero is a nickname 22 citations use and no item answers to

FOUND 2026-09-09 by the lane that took `plan:archive seq:16`, `seq:21` and `seq:28`. It named `STD-absent-vs-zero` in a test's `@basis` because two of its own items cite it that way, and `scripts/basis-gate.ts` refused: DANGLING. The real id is `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.

MEASURED, over the whole tree:

    citations in corpus items                       5
    citations in src/ and test/ and e2e/           17
    items answering to `STD-absent-vs-zero`         0

The five items are `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine`, `OPENQ-install-the-status-line-bridge-over-the-owner-s-current`, `REQ-a-session-near-the-end-of-its-window-asks-for-the-handover`, `TASK-a-task-notification-is-3-9-mb-of-what-a-lane-reported-drawn` and `TASK-execution-is-its-own-audit-kind-a-run-is-not-a-mutation-of`. The seventeen code citations sit in `src/core/audit.ts` (3), `src/core/select.ts` (2), `src/core/config.ts`, `src/core/context-occupancy.ts`, `src/core/ui-server-upkeep.ts`, `src/hooks/stop.ts` and six test files.

WHY THIS IS THE SAME DEFECT AS `TASK-ruling-33-sweep-the-44-bare-file-line-citations-into-the` AND NOT A DUPLICATE OF IT. That item is about a citation that names a LINE, which moves. This one is about a citation that names an ID THAT DOES NOT EXIST, which never resolves at all - and it is the worse of the two, because a stale line number still points at the right file while a nickname points nowhere and reads as authoritative. `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` is the rule both offend.

WHY IT SURVIVED. The gate that would have caught it only reads `// @basis` headers, and 467 test files predate the rule and are exempt. Prose citations in item bodies and in source comments are read by nobody mechanical, so twenty-two of them accumulated with no signal.

THE REPAIR IS A SWEEP AND A CHOICE. Either replace all twenty-two with the real id, or give the standard an alias the corpus can resolve - and the second is a product question about whether an item may have more than one name, which this item does not settle. The first is mechanical and is what a lane should do absent a ruling.
