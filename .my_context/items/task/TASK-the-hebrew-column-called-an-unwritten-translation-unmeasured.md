---
id: TASK-the-hebrew-column-called-an-unwritten-translation-unmeasured
type: task
title: the hebrew column called an unwritten translation unmeasured when the manifest already named it
status: active
severity: soft
always: false
summary: Eighteen tutorial rows said nobody had looked at the Hebrew, when in fact the file was simply not written yet and was known to be owed.
summary_of: 236b2ce8ddedd0e0
scope:
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - docs
  - tutorials
  - i18n
  - "state:done"
  - "verified_on:2026-09-05"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 903838e2fb2d4a87
state: done
verified_on: 2026-09-05
---

# the hebrew column called an unwritten translation unmeasured when the manifest already named it

Reported 2026-09-05 by the lane that wrote the Hebrew tutorials and could see its own work uncounted.

THE DEFECT. tutorialListRow delegated the Hebrew column to tutorialFileState, whose "unmeasured"
means only "the file is absent" and cannot know whether the absence was expected. So a row whose
English tutorial exists and whose Hebrew file does not read "unmeasured" - nobody has looked -
when the truth is "todo": the manifest names that file, so the gap is owed and known.

THE HEADLINE WAS HONEST THROUGHOUT, which is what made this hard to see. heRollup counts he ===
done against measured English and reported 6 of 24 correctly, while the eighteen chips beside it
claimed the question had never been asked. A screen disagreeing with its own summary line.

WHY THE DISTINCTION IS THE POINT. unmeasured and todo are different claims and this product
spends real effort keeping them apart - LESSON-on-real-data-an-absent-feature-and-a-missing-
feature-look is the same argument, and the categories row on Learn earned its unmeasured mark the
same day for exactly this reason. A column that collapses them teaches the reader nothing.

FIXED. The three-way rule is now explicit: English unwritten -> Hebrew unmeasured, because there
is nothing to be behind on; English written and Hebrew absent -> todo; Hebrew present -> done or
todo on the four required headings. Verified live: chips moved from {done:6, unmeasured:18} to
{done:6, todo:18}, with the rollup unchanged at 6 of 24.

The endpoint test re-derived its expectation with the SAME bug, so it passed against wrong
behaviour and went red against right behaviour. Corrected there too - a second implementation that
repeats the first one\u2019s mistake proves only that the mistake is reproducible.
