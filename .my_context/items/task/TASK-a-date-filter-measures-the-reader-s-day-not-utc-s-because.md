---
id: TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because
type: task
title: a date filter measures the reader’s day, not UTC’s, because the times beside it already do
status: active
severity: soft
always: false
summary: Filtering the list by date covers the day as you lived it, matching the times shown next to it, instead of a day that starts three hours off.
summary_of: 3a7c4a78474ea6b8
acknowledged:
  - citation_form@fd3f124e02a7831b
  - task_unverified@fd3f124e02a7831b
scope:
  - src/ui/read-model-conversations.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:37"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: f2485d7a63af77f6
plan: archive
seq: "37"
state: done
priority: "2"
needs: archive/10
---

# a date filter measures the reader’s day, not UTC’s, because the times beside it already do

DONE 2026-09-10, commit a62ce66e. The list's date filter now measures the reader's day, and it is the SAME day the stamp on the row prints.

WHERE THE DAY IS COMPUTED, AND WHY THE TWO CANNOT DRIFT APART. `zonedFields` in `src/ui/public/lib/viewmodel.js` is the ONE derivation - one `Intl.DateTimeFormat`, one set of parts - and `zonedDay`, `zonedZone` and `zonedStamp` are three readings of it. `zonedStamp` no longer computes a date at all; it reads `fields.day`. So on the screen the printed date IS `zonedDay`'s output, by construction rather than by agreement.

THE SEAM IS THE WIRE, and it is named. The read model filters and the screen formats, because `matching`, `undated`, `omitted` and the page are all counted server-side and shipping 259 lane rows to the browser to filter them there would be moving the data to the code. `tsconfig.json` sets no `allowJs`, so the endpoint cannot import the browser module; `src/ui/zoned-day.ts` is a zero-import leaf carrying the same spelling. It is a FILE and not a paragraph inside `read-model-conversations.ts` because that module's whole claim is a runtime graph of two project files that cannot write and cannot spawn, and `format.ts` - where the CLI's copy of `zonedStamp` lives - sits behind the writer graph. What stands in for the import is `test/ui/zoned-stamp-parity.test.ts`: a sweep over 6 zones x 6 instants asserting server day == browser day == the first ten characters of the stamp, in the browser module, the CLI module and the leaf. Three assertions per pair, each able to fail alone.

THE CLIENT SENDS THE ZONE, THE SERVER GUESSES NOTHING. `READER_ZONE` is read once from `Intl.DateTimeFormat().resolvedOptions().timeZone` and used for BOTH the stamps and the `tz` parameter, so the string the column was drawn in is character-for-character the string the filter was answered in. `tz` rides only with a bound. An IANA NAME and never an offset: `+03:00` is refused even though `Intl` accepts it, because it has already thrown away the transitions. Unknown or empty `tz` is a 400 in the same breath as a malformed date, so `seq:10`'s refusal is not regressed; no `tz` at all still means UTC, which is what a script or `curl` means and what this endpoint has always answered.

BOTH ENDS INCLUSIVE BY CONSTRUCTION. Both bounds now compare YYYY-MM-DD against YYYY-MM-DD, so neither edge can be off by one; the `until` edge the item warned about is asserted on the screen over a range holding both fixtures. `undated` now also counts a stamp `zonedDay` cannot place, rather than only a missing one.

DST EVIDENCE, WHICH IS THE POINT AND NOT A FORMALITY. Two sessions at the SAME wall time - 21:30Z - on opposite sides of the Israeli transition: 23:30 on the 15th in January (GMT+2), 00:30 on the 16th in July (GMT+3). One instant-shape, two days, which no fixed offset can produce. Both wrong fixes were PLANTED and both went red on the half each gets wrong: the shipped UTC-prefix build files both on the 15th and fails the July filter; a "+3 everywhere" build files both on the 16th and fails the January filter, at `conversations.spec.ts:1086` in all four browser runs. Removing the client's `tz` also reddens all four. Restored, all four green again.

MEASURED. Browser, serial, both projects: 206 passed, 0 failed across `conversations`, `conversations-kept`, `conversation-secrets`, `lane-link-face`, `archive-chrome-face` - 4 of those 206 are new here (en and he, chromium and chrome). Node: 7,294 tests, 7,286 pass, 6 fail, and none of the six is this work - `ingest-lock`, `statusline-chain` and `execute-route` are the named contention set and each passes alone; `no-writes` and two pack tests fail on another lane's uncommitted `src/core/review-counter.ts` and its new `review` config key. Typecheck clean. The day pass costs 0.009 ms over this workspace's 2 sessions, 0.952 ms over 259 rows and 7.571 ms over 2,000 - best of nine, warm formatter - and is paid only when a bound is set.

WHAT MEASUREMENT ADDS TO THE ITEM. The item said `zonedStamp(at, timeZone)` takes the zone from the runtime so `undefined` means the browser. True, and the screen already relied on it - but "the runtime's zone" and an explicit zone string are two values that agree today and are not required to, so the fix names the value once and uses it for both halves. Nothing the item claims is contradicted.

ONE THING ADDED THAT THE ITEM DID NOT ASK FOR, stated so it is not mistaken for scope creep: `conv.datesIn` names the clock beside the counts, in both string tables. Its keep is earned in the EMPTY answer - "I asked for my own Tuesday and got nothing" is the report this item began as, and with no rows there is nothing on screen to read the zone off. It is anchored to the bound's own day, not to now, so a July filter is not labelled with January's offset.
