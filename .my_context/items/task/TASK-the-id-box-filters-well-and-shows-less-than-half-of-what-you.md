---
id: TASK-the-id-box-filters-well-and-shows-less-than-half-of-what-you
type: task
title: the id box filters well and shows less than half of what you picked
status: active
severity: soft
always: false
summary: "Done: the id picker shows what you actually chose rather than cutting it off halfway."
summary_of: 426f7fc410ba57a0
summary_was:
  - 2026-09-11 You can type to find an item, and then cannot read back which one you chose.
acknowledged:
  - task_unverified@35be1d7d4a37d49d
scope:
  - src/ui/public/styles.css
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 9b86aeb51f79d2df
plan: builder
seq: "17"
state: done
priority: "2"
---

# the id box filters well and shows less than half of what you picked

Found 2026-09-07 by the lane that converted the id picker, in a file it did not own, and confirmed
by me independently.

MEASURED: 986 ids in this corpus, average length 58 characters, longest 67. The control
`.card .suggin` renders at about 318px; the longest id needs about 615px. So less than half a
typical id is visible, and under `dir="rtl"` what you see is the TAIL rather than the head - the
least distinguishing part, since every id in a category shares its prefix.

THIS IS NOT A REGRESSION. The `<select>` it replaced was capped at 260px and showed even less, and
the cap exists for a measured reason: a select cannot shrink below its widest option, and 942
options once opened this page to 3,902px. The datalist has no such floor, so the cap is now
holding back a control that no longer needs holding back.

WHAT IT COSTS, and it is exactly half the ruling. The owner chose the datalist to get filtering,
and accepted knowingly that it suggests rather than constrains. Filtering works. READING BACK what
you picked does not, and that is the half nobody weighed - a reader who types three characters,
picks a row, and then cannot see which row they picked is no better off than before.

WHERE TO LOOK FIRST, because the obvious fix is probably wrong: simply widening `.suggin` puts a
615px control on a card that also holds a two-column form, and this screen has been bitten twice
by a control wider than its column - a 942-option select at 3,902px and a 600-character example
line at 1,325px of overflow. The measurement to take first is what width the CARD can actually
give, not what the id wants.

AND THERE IS A CHEAPER ANSWER WORTH COSTING BEFORE THE EXPENSIVE ONE: the value need not be the
only thing shown. The box already carries the item title as its datalist hint, and a chosen id
could be echoed under the control at full width, where there is no shrink-to-fit problem at all.
That is a paragraph rather than a layout fight.

BOTH LANGUAGES, and RTL is where this is worst rather than merely equal: the isolate makes the
box render LTR inside an RTL page, so an overflowing value shows its end. Whatever lands must be
looked at in Hebrew, not inferred from English.

Landed in `1be21693`, alongside `builder/6` and `builder/8`.

CLOSED 2026-09-11, FOUR DAYS LATE, AND THE LATENESS IS THE POINT. This shipped on 2026-09-07 and
nobody set the state. It was found by the handover measurement, not by an audit: the handover
checker flagged it as an instruction "carried into 3+ blocks with the work still open", and the
lane checking whether that meant HARD or IMPOSSIBLE found it meant NEITHER — the work was done and
the item was wrong.

WHAT THE STALENESS COST, measured rather than supposed: `mycontext ready --plan builder` was
offering these as dispatchable. A lane taking that list would have REBUILT SHIPPED, TESTED WORK —
and would have found the code already there, which is the confusing version of the failure rather
than the loud one.

AND THE HANDOVER WAS NOT AT FAULT, which was checked before it was blamed: the next block written
after the landing names none of these. The residual is a fossil of this item’s own `state` field,
and the checker reads "still open" from there.

Verified before closing: `test/ui/builder.test.ts` 24 of 24 green on 2026-09-11.
