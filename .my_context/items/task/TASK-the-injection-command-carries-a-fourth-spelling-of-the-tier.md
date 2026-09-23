---
id: TASK-the-injection-command-carries-a-fourth-spelling-of-the-tier
type: task
title: the injection command carries a fourth spelling of the tier test that agrees with the one answer only because it is unreachable
status: active
severity: soft
always: false
summary: One more place decides a category's tier with its own wording; it happens to agree today only because that code never runs for an unknown category, so a later change could make it disagree without anyone noticing.
summary_of: 9817e3a85493f55a
scope: []
tags:
  - "plan:release"
  - "seq:37"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: f6b7bef700005d5c
plan: release
seq: "37"
state: todo
---

# the injection command carries a fourth spelling of the tier test that agrees with the one answer only because it is unreachable

Found by task 4.13 on 2026-09-23 and adjudicated by its reviewer (TASK-the-unknown-category-default-is-answered-three-different closed the three surfaces the item names): src/cli/commands/injection.ts lines 120-122 spell the tier test a fourth way instead of calling tierForCategory in src/core/config.ts; injection() returns at isEligible (lines 95-101, 'category ... is not in this project's config') before that line for an unknown category, so the spelling is dead for that input and agrees with UNKNOWN_CATEGORY_TIER by accident. Closing condition: the line asks tierForCategory like tierOf, isNormative and addSnapshot do, a test plants an item of a category that is declared but whose tier is absent and asserts the command's answer equals config's, and a grep over src/ finds no other spelling of the tier test (record the grep in the report). Files: src/cli/commands/injection.ts, test/cli/injection*.test.ts. Release phase 5 (CLI).
