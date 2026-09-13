---
id: TASK-the-help-screen-shows-25-english-titles-under-a-hebrew-claim
type: task
title: the Help screen shows 25 English titles under a Hebrew claim of 24, right-aligned with no direction attribute
status: active
severity: soft
always: false
summary: One screen lists English titles under a Hebrew sentence that both miscounts them and leaves them laid out in the wrong reading direction.
summary_of: b6b38ffb58108845
scope:
  - src/ui/public/screens/**
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - i18n
  - rtl
  - "plan:walk"
  - "seq:163"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: b850574736e2e42c
plan: walk
seq: "163"
state: todo
priority: "2"
---

# the Help screen shows 25 English titles under a Hebrew claim of 24, right-aligned with no direction attribute

FOUND BY BOTH UI REVIEWS, unchanged between them and one row worse on the second. Row 30 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The Help screen shows 25 English document titles while the sentence above them claims, in Hebrew, that 24 of 24 were written and measured on disk. Every one of the 25 is right-aligned as RTL with a `dir` attribute of `null`.

WHY IT IS THE SHARPEST INSTANCE OF THIS SUBJECT. The Hebrew bidi work that landed the same day took `dir="auto"` from 0 to 1,371 attributes across the document. THIS IS THE ONE ELEMENT THOSE 1,371 DID NOT REACH -- and it is the element report 1 originally found. The claim and the content also disagree about the count.

THE SUBJECT. An English sentence reaches the screen with no string-table key, so it cannot be translated and it inherits the paragraph's direction.
