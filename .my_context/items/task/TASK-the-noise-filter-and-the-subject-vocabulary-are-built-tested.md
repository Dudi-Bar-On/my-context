---
id: TASK-the-noise-filter-and-the-subject-vocabulary-are-built-tested
type: task
title: the noise filter and the subject vocabulary are built, tested, and reach no mission
status: active
severity: soft
always: false
summary: Two pieces the retrieval feature is named for were built and never connected, so every brief it composes is missing both and two modes on the screen are dead.
summary_of: 225667ac820751e7
scope:
  - src/core/retrieval/**
  - src/ui/read-model-retrieval.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: d5e22a4ad1e6f000
plan: recall
seq: "7"
state: done
priority: "1"
---

# the noise filter and the subject vocabulary are built, tested, and reach no mission

> FOUND 2026-09-13 by two reviews that could not see each other, which is what makes it certain.
>
> `src/core/retrieval/subjects.ts` (336 lines) and `src/core/retrieval/noise.ts` (326 lines) ARE IMPORTED ONLY BY THEIR OWN TESTS. Verified by hand: every other mention of either, anywhere under `src/`, IS A COMMENT NAMING IT. `mission.ts` imports `node:fs` and `node:path` and nothing else.
>
> SO EVERY MISSION THIS PRODUCT COMPOSES IS COMPOSED WITHOUT THE NOISE FILTER AND WITHOUT THE DOCUMENT-DERIVED SUBJECT VOCABULARY - the two measured qualities the parent item is NAMED after: "reconstruct a subject from a passage you copied, WITHOUT THE NOISE REACHING YOUR CONTEXT". They are its Task 7 and Task 8 and BOTH ARE LISTED DONE, in an item otherwise meticulous about naming what it deliberately did not build.
>
> AND THE SAME DEFECT WAS FOUND AT THE SCREEN. Two of the four retrieval modes can never succeed: "I am lost" and "where were the fixed points?" declare `needsText: false`, correctly hide the passage box, and then ALWAYS emit "Paste something that names things" with a brief carrying zero points. `list-anchors` returns 0 WHILE 684 ANCHORS ARE RENDERED ON THE SAME SCREEN.
>
> IT FAILS THE DELIBERATELY-UNWIRED TEST ON TWO OF THREE COUNTS: tests yes, recorded ruling NO, revisit condition NO. The removal review looked for a ruling either way and found none.
>
> OWNER RULING 2026-09-13, after the alternative was put to him and the first recommendation was withdrawn as unsound: MEASURE FIRST, THEN WIRE, IN ONE PASS. No hiding step - hiding the dead modes for a few hours and un-hiding them the same day is churn, and the dead end has existed since the feature shipped.
>
> WHAT MEASURING MEANS HERE, and it is three separate questions:
>
> 1. WHY WERE THEY NEVER WIRED? Read the history. `git log` the two files and `mission.ts`, and read what Tasks 11 and 12 rebuilt. IF THE MISSION FORMAT CHANGED AND THE FILTER'S OUTPUT NO LONGER FITS, WIRING IT BLIND IS WRONG. Establish this before changing anything and say what you found.
>
> 2. WHAT DOES THE NOISE FILTER ACTUALLY CHANGE IN A REAL COMPOSED MISSION? Compose one brief on the real archive with the filter and without it, and show the difference. This is a BEHAVIOUR CHANGE TO A SHIPPED FEATURE, not a repair, and the item's own history is the reason to be careful: A LEXICAL NOISE CLASSIFIER MEASURED AUC 0.499, A COIN FLIP, and building one is forbidden. Noise reuses the document's own said/work/deed classification plus the repeat rule. Show that what you wire IMPROVES what a brief carries rather than merely running.
>
> 3. WHY DOES `list-anchors` RETURN ZERO? That one needs no vocabulary at all - 684 anchors exist and the screen renders them. It is a plain bug and probably unrelated to the other two. Do not let it hide inside the bigger change.
>
> THEN WIRE ALL THREE IN THE SAME PASS, with the measurement in hand.
