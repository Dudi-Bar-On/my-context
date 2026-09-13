---
id: TASK-the-doctor-screen-is-20180-px-tall-with-no-filter-sort
type: task
title: the Doctor screen is 20180 px tall with no filter, sort, search, collapse or in-page navigation
status: active
severity: soft
always: false
summary: The health screen is an enormous unbroken list with no way to filter, sort, search or collapse it, while every other list in the tool pages properly.
summary_of: d70342e68ab7e465
scope:
  - src/ui/public/screens/**
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - doctor
  - paging
  - "plan:dxfindings"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: eae77d653a00b815
plan: dxfindings
seq: "2"
state: todo
priority: "2"
---

# the Doctor screen is 20180 px tall with no filter, sort, search, collapse or in-page navigation

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 2.8) as row 49 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The Doctor screen is 20,180 px tall: 1,883 nodes and 291 controls, with no filter, no sort, no search, no collapse and no in-page navigation -- while every other list in the app pages properly.

AND HALF THE CAUSE IS NOT THE SCREEN. Report 6's G3 supplies the other half: 53 of the 107 findings are `task_unverified`, produced by the hard-coded grandfather cutoff in row 17. Fix that and this page loses half its height without any UI work at all.

THE SUBJECT. A doctor finding has to earn its place on the page. This item is the screen half -- paging, filtering and collapsing; row 17 is the noise half; row 69 is the consumer-repo traps; row 67 is the anonymous finding that cannot say which check broke.
