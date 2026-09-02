---
id: TASK-one-audit-timestamp-three-spellings-watch-ask-and-preview
type: task
title: "one audit timestamp, three spellings: watch, ask and preview each format an instant in their own file"
status: active
severity: soft
always: false
summary: Three places format the same timestamp their own way, so two tables showing the same records can disagree about what time it was.
summary_of: 6865b9b56e614ace
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:ask"
  - "screen:watch"
  - "screen:preview"
  - "plan:walk"
  - "seq:101"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 316a4d1da8aaf2b2
plan: walk
seq: "101"
state: done
priority: "3"
progress: "0"
source: "plan:walk seq:27, measured against screens/watch.js, screens/ask.js and screens/preview.js on 2026-08-29"
---

# one audit timestamp, three spellings: watch, ask and preview each format an instant in their own file

FOUND 2026-08-29 under plan:walk seq:27, from `screens/ask.js`'s own `clockOf` docstring, which names the fix and says it belongs to a file that task did not own: "Both audit tables must read their At column the same way; the fix is to move it into `screens/parts.js` beside `num()`, and that is in this task's report."

THE THREE SPELLINGS, measured 2026-08-29:

  `screens/watch.js` `clockOf`  -- `new Date(at)`, then `toLocaleTimeString('en-GB', {hour12:false})`; on an unparsable value returns `String(at)`. Not exported.
  `screens/ask.js` `clockOf`    -- the same output, but GUARDED first: `/T.*(Z|[+-]\d\d:?\d\d)$/` must match or the raw text is returned unformatted. Exported, because its own test imports it.
  `screens/preview.js` `stampOf` -- deliberately DIFFERENT: a wall date AND a wall time, because two preview rows can be weeks apart and a bare clock would draw them identically.

SO IT IS NOT THREE COPIES OF ONE FUNCTION -- IT IS TWO NEAR-COPIES AND ONE CONSIDERED DIVERGENCE, WHICH IS WORSE. The two audit tables (Ask's `At` column and the Audit stream's) are drawing the SAME records from the same log with two different parse guards: `ask.js` refuses to reformat a stamp that does not end in an offset, `watch.js` reformats anything `Date` will accept. Feed both the same malformed record and they disagree about what is shown. `preview.js`' `stampOf` is a third reading of the same decision and states its reason, so it is the one that should survive as a variant rather than as a duplicate.

WHY IT IS WORTH DOING RATHER THAN NOTING. Every one of the three carries the identical two-paragraph argument about `en-GB` being a FORMAT choice and not a language one, and about an unparsable stamp being drawn AS IT ARRIVED because "rendering an unparsed stamp through a formatter is how a value gets shifted by the machine's offset and then shown as though it had been measured". That argument is now written three times and can rot in two places while staying right in the third -- which is the drift this whole project exists to end.

THE WORK: one exported pair in `screens/parts.js` beside `num()` -- a time-only form and a date-and-time form over ONE parse guard, the stricter of the two -- with the three call sites pointed at it and the argument written once. `parts.js` is where `num()`, `mono()`, `tierChip()` and `boundedList()` already live for exactly this reason.

TAKE THE STRICTER GUARD, and say so in the test: `ask.js`' regex is the one that was written after somebody thought about what `new Date` accepts. Moving `watch.js` onto it is a behaviour change on one screen -- small, and it is the direction that stops a machine-local offset being presented as a measurement.
