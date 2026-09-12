---
id: TASK-notice-the-drift-while-it-is-happening-quietly-and-off-by
type: task
title: notice the drift while it is happening, quietly and off by default
status: active
severity: soft
always: false
summary: A quiet check, off unless you switch it on, that tells you when the work has wandered away from the point you bookmarked.
summary_of: 1bc94dd4e242da6c
summary_was:
  - 2026-09-11 A warning when the work has wandered from the plan you set, before you notice you are lost.
acknowledged:
  - task_unverified@584deb3d89d9f832
scope:
  - src/review/**
  - test/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 79b55a106868757d
plan: recall
seq: "3"
state: done
priority: "1"
needs: recall/2
---

# notice the drift while it is happening, quietly and off by default

D42 PHASE 3. Plan: docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md Task 13. Design: docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md sections 13, 14.

LAST DELIBERATELY. Retrieval is the cure and stands alone; this is prevention and it needs anchors,
subjects and chronology to judge against. Built last, it is built on measured foundations - and he
can decide whether he still wants it once finding his way back is cheap.

IT MUST BE ABLE TO BE WRONG QUIETLY. Telling him he has drifted when he has not is worse than
silence, which is why it is OFF BY DEFAULT.

plan:loop seq:2 already computes "is this session worth looking at" and measured the shape: 3,924
tool calls became 261 considerations, 164 rubric fires and 3 passes - where firing on every Stop
would have been 766. This asks the same machinery a different question.

Drift is detected against an ANCHOR, never against a guess at intent.

BUILT 2026-09-11 - src/review/drift.ts, test/review/drift.test.ts

12 tests, 33 assertions, every one proved by removal. Nothing else changed under src/.

OFF BY DEFAULT IS ENFORCED IN ONE PLACE AND STATED IN THAT FILE'S HEADER. The gate is `driftCheck`,
the default is `DEFAULT_DRIFT = { enabled: false }`, and the header's second paragraph names both
and says why there is only one of them: every other export is pure, so a value nobody asked for
warns nobody. That paragraph exists because of plan:archive seq:9, where off-by-default was
enforced in three places and stated in none and the item read as never built.

THE CONFIG KEY IS TOP-LEVEL `drift`, NOT `review.drift`, AND THAT IS FORCED. config.ts
`requireReview` refuses any key it does not know inside the `review` block, so `review.drift` would
not switch this on - it would stop the whole config loading. A top-level key is the shape R14.2
makes survivable. Nothing in this lane edited config.json; the owner adds `"drift": {"enabled":
true}` if he ever wants it.

WHAT WAS REUSED FROM plan:loop seq:2, AND WHAT COULD NOT BE. `worthAPass` from src/review/rubric.ts
is imported and gates every verdict: a stretch the rubric would not have read is not a stretch to
warn about, and the test asserts the refusal sentence IS `worthAPass`'s own so a fork would be
visible the day it happened. `reviewTrigger` is NOT called, and the reason is specific: it is gated
on `review.enabled` and it spawns a detached child, so calling it would let a second switch decide a
first and would make this feature load-bearing on a subsystem this item says he may drop.

NOTHING CALLS IT. Asserted by reading the sources, with a positive control, so it stays true.

TWO FINDINGS.

1. AN ASSERTION OF THIS LANE'S OWN PASSED WITH ITS MECHANISM REMOVED. The test on normalised anchor
names stayed green with the whole of `normalise`'s punctuation strip taken out, because the first
fixture wrote the path before a COMMA. Measured 2026-09-11: from-selection.ts admits `.` as a path
character and does not admit `,`, so only a name that ENDS A SENTENCE carries punctuation into the
comparison - and that is the ordinary case in a label somebody wrote. The fixture now ends the
sentence, the removal proof reddens, and both files record it rather than quietly correcting it.

2. `every module in src/ that writes to the filesystem is named in WRITERS` WAS RED ON master AND
NOT BECAUSE OF THIS WORK. plan:recall seq:2's src/core/retrieval/mission.ts and result.ts landed
naming themselves nowhere in test/ui/no-writes.test.ts. Fixed here rather than filed - D37 closing
mode - with `writeMission` and `writeResult` as the symbol lists and the read half deliberately
left out, which is focus.ts's split. That test file is now green at 20/20.
