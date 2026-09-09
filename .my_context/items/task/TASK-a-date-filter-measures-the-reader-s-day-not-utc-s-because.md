---
id: TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because
type: task
title: a date filter measures the reader’s day, not UTC’s, because the times beside it already do
status: active
severity: soft
always: false
summary: Filtering the list by date covers the day as you lived it, matching the times shown next to it, instead of a day that starts three hours off.
summary_of: faee2e5262626993
scope:
  - src/ui/read-model-conversations.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:37"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: b4d613715e91a518
plan: archive
seq: "37"
state: todo
priority: "2"
needs: archive/10
---

# a date filter measures the reader’s day, not UTC’s, because the times beside it already do

OWNER RULING 2026-09-09, on being shown what the date filter actually compares: use the reader’s
own zone.

WHAT SHIPPED. plan:archive seq:10 gave the list `since` and `until` bounds, and they compare whole
days as ISO TEXT PREFIXES with no zone arithmetic. The lane stated it in the code rather than
hiding it, and its reasoning was defensible: the alternative was the server guessing an offset it
does not have.

WHY IT IS STILL WRONG, AND IT IS THE OWNER’S OWN DEFECT ONE SURFACE OVER. He is UTC+3. A bound of
2026-09-08 selects 00:00-23:59 UTC, which is 03:00 to 02:59 in his day - so a conversation he had
at 01:00 lands under the previous date, silently. That is the same shape as the defect he reported
himself and that plan:archive seq:18 fixed: a value shown or filtered in one zone while the reader
lives in another, with nothing saying which.

AND THE INCONSISTENCY IS NOW VISIBLE ON ONE SCREEN. seq:18 made every timestamp say its zone -
`2026-09-08 17:11 GMT+3`. So the list already draws times in his zone and filters dates in UTC, a
row above and a control below. Either one alone is defensible; the pair is not.

THE FIX IS NOT A SERVER GUESS, which is what made the original call reasonable. seq:18 established
where the zone comes from: THE READER. `zonedStamp(at, timeZone)` takes it from the runtime, so
`undefined` means the browser and never the server. The same source answers this - the client that
already knows which zone it is rendering in sends the bound it means, or sends the zone with it.
The server still guesses nothing.

THREE THINGS TO GET RIGHT:
  - THE BOUND IS INCLUSIVE AT BOTH ENDS, which is what a person picking two dates means. An
    off-by-one at the `until` edge silently hides the newest day, which is the day anybody
    filtering is most likely to want.
  - DO NOT REGRESS THE REFUSAL. seq:10 refuses a malformed bound rather than accepting and
    ignoring it. Whatever shape carries the zone must be refused the same way when it is wrong.
  - PIN THE TEST’S ZONE. `e2e/playwright.config.ts` pins `timezoneId: UTC`, and seq:18’s lane
    proved a test asserting a zoned value passes or fails on the MACHINE unless the zone is pinned
    per test - it used `test.use({ timezoneId: 'Asia/Jerusalem' })`. A UTC-pinned suite cannot see
    this defect at all, which is exactly why it shipped.
