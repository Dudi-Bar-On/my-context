---
id: TASK-std-absent-vs-zero-is-a-nickname-22-citations-use-and-no
type: task
title: STD-absent-vs-zero is a nickname 22 citations use and no item answers to
status: active
severity: soft
always: false
summary: Twenty-four sites in code and documentation are swept to the real id and a guard test holds them there; six corpus item bodies still carry the nickname.
summary_of: 53b1113f03afb435
summary_was:
  - 2026-09-11 A standard is cited across the corpus and the code by a short name that resolves to nothing, so a reader who follows the citation finds no item.
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
checksum: 2c31b4ea1c41e1b2
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

2026-09-12: THE CODE AND DOCUMENTATION HALF IS SWEPT. STILL OPEN for the corpus half, which is named below. RE-COUNTED AT THE MOMENT OF ACTING, because twenty-two no longer denoted twenty-two: twenty-four sites carried the nickname outside the corpus. Twenty-one were under src/ and test/, three were in docs/superpowers/, and THREE had never been counted by anyone because they were WRAPPED across a comment break - src/hooks/pre-compact.ts twice and src/core/select.ts once - so a per-line grep read each as two different unknown ids. That is this item's own blind spot in miniature. WHAT WAS DONE. All of them replaced with the real id, across src/core/audit.ts, config.ts, context-occupancy.ts, review-counter.ts, select.ts, ui-server-upkeep.ts, src/hooks/pre-compact.ts, stop.ts, src/review/dedupe.ts, six test files, and three files under docs/superpowers/. verify:citations was byte-for-byte unchanged in every fault count before and after - 2 documentation, 32 source, 57 corpus, 19 faults - so nothing was broken by the edit. A REGRESSION GUARD SHIPPED WITH IT: test/scripts/cited-items.test.ts now holds `no source file cites the absent-vs-zero standard by a name no item answers to`, which walks the four SOURCE_ROOTS, tolerates the line-wrapped spelling, and reports every site by coordinate rather than by count. It names one id on purpose and the test's own comment says why: the check it lives beside skips 2512 id-shaped strings that answer to no item, almost all of them fixtures inventing an id, and 55 of those are under src/ alone, so a general gate would be an allow-list. The needle is assembled from two halves so that this file is not itself exempt. Proved by planting one nickname back into src/review/dedupe.ts: red at the assertion's own line, naming src/review/dedupe.ts:43. WHAT IS LEFT, and why a lane did not take it. Six corpus items still cite the nickname in their bodies and a body is CLI-only, so each is an edit that must pass the summary gate and the contradiction gate for a one-word correction: LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine, OPENQ-install-the-status-line-bridge-over-the-owner-s-current, REQ-a-session-near-the-end-of-its-window-asks-for-the-handover, TASK-a-task-notification-is-3-9-mb-of-what-a-lane-reported-drawn, TASK-execution-is-its-own-audit-kind-a-run-is-not-a-mutation-of, and TASK-the-session-field-names-a-session-and-says-nothing-about-its. The last of those was not in this item's own list of five and is the sixth. THE CHOICE THIS ITEM NAMES IS STILL UNTAKEN: nothing here decides whether an item may answer to more than one name, and the sweep was taken as the answer absent a ruling, exactly as this item said a lane should.
