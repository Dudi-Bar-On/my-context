---
id: TASK-four-stale-claims-still-live-in-the-plans-found-by-sampling
type: task
title: four stale claims still live in the plans, found by sampling the moved citations
status: active
severity: soft
always: false
summary: Four statements in the plans are no longer true, and sampling suggests a couple of dozen more that no automatic check could ever find.
summary_of: 9fa0bd459e280444
scope: []
tags:
  - "plan:rulings"
  - "seq:33b"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 8dd3ed617d06278f
plan: rulings
seq: 33b
state: done
priority: "1"
---

# four stale claims still live in the plans, found by sampling the moved citations

Ruling 33 sampled 76 of 383 moved citations in three slices - every 9th, every 19th, and the top 18 by drift - and read every sampled prose line. Five hid a claim that had gone false; four are still live because the fifth was inside a document that sweep repaired.

1. web-ui-3:296 - 'the WHERE builder is still inline here, which is what Task 1 extracts'. Task 1 extracted it: filterSelect is exported and queryProjection calls it.
2. web-ui-3:422 - the same fact in prose.
3. v2-categories-and-runbooks:162 - 'the accepted keys are pinned and extraFields is deliberately absent'. CATEGORY_KEYS CONTAINS extraFields, and the comment directly beneath it says so.
4. v2-hooks:194 - 'source is branched on exactly once'. It is branched on twice, and the second branch's own comment reads 'The other source this function branches on'. Other rows in that same table were maintained; this one was walked past.

Extrapolated, roughly 25 to 30 of the 383 carry a false claim. Drift magnitude does NOT predict it: the five found had drifts of 336, 288, 121, 79 and 70, while the five highest-drift citations in the corpus - 426, 419, 368, 349, 347 - were all clean signature references. Sampling by drift would have missed them.
