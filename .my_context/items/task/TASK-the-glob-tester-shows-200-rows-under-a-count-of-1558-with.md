---
id: TASK-the-glob-tester-shows-200-rows-under-a-count-of-1558-with
type: task
title: the Glob tester shows 200 rows under a count of 1558 with nothing saying the list is capped
status: active
severity: soft
always: false
summary: A list shows two hundred results under a heading claiming more than fifteen hundred, and nothing on the screen says the rest were left out.
summary_of: 6b5948567c6630e3
scope:
  - src/ui/public/screens/palette.js
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - silent-drop
  - bounded-list
  - "plan:walk"
  - "seq:149"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 6ee510f6d4c37e6d
plan: walk
seq: "149"
state: todo
priority: "2"
---

# the Glob tester shows 200 rows under a count of 1558 with nothing saying the list is capped

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 2.3) as row 48 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The Glob tester's count line reads `1,558 / 1,558` and the list beneath it contains exactly 200 rows. Nothing on the screen says the list is capped.

THREE THINGS MAKE IT THE SHARPEST INSTANCE IN THE PRODUCT:
- The sentence directly beneath the list argues the opposite case.
- `palette.js` · the comment recording the cap (line 113) ALREADY RECORDS THE DEFECT, in its own words, in a comment.
- It is one of only two lists in the whole product that break the bounded-list pattern, which both UI reviews named as one of the best things in it: "Showing the first 20 of 36 ... A display limit. All 36 were in the injection -- none were dropped."

THE CONSEQUENCE. A user testing a glob against 1,558 paths is shown 200 and told the number is 1,558. It is a silent truncation with a confident count on top of it.
