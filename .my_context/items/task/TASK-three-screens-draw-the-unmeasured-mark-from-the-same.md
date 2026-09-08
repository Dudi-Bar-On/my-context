---
id: TASK-three-screens-draw-the-unmeasured-mark-from-the-same
type: task
title: three screens draw the unmeasured mark, from the same component and the same strings
status: active
severity: soft
always: false
summary: Three screens that have no verdict yet say so with the same mark used elsewhere, instead of leaving the slot empty.
summary_of: 71188d788badc577
scope:
  - src/ui/public/**
tags:
  - v2
  - ui
  - "plan:screens"
  - "seq:24"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 0f651f251b3fd61e
plan: screens
seq: "24"
state: todo
priority: "2"
---

# three screens draw the unmeasured mark, from the same component and the same strings

Filed 2026-09-07 as the prerequisite to retiring plan:walk seq:108, by owner ruling
(plan:walk seq:140, option A): file the ruling’s own implementation as a new item BEFORE closing.

WHY IT HAD TO BE FILED FIRST. DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never
is RULED, UNBUILT, and nothing in the corpus points at it. Retiring seq:108 - the only item that
mentioned the subject at all - would have left the ruling with no carrier, which is how a decision
stops being acted on without anyone deciding to stop.

WHAT THE RULING SAYS, and it REVERSES what seq:108 asked for: the three screens do NOT get a drafted
verdict sentence. What "implemented" means for them is undecided, and that question belongs to
plan:walk seq:127, 129, 130 and 131. Until it is answered they draw LEARN’S UNMEASURED MARK -
"the same component and the same strings" - so an unmeasured screen is visibly unmeasured rather
than blank.

SO THIS IS A REUSE TASK, NOT A DESIGN TASK. Find what Learn already draws for the unmeasured state,
and use that component and those keys on Procedures, Export / import and Template packs. Minting a
second mark, a second string or a second colour would be the defect the ruling exists to prevent.

## Observations
- [supersession] Replaces TASK-procedures-export-import-and-template-packs-are-the-only: Owner ruling 2026-09-07 (plan:walk seq:140, option A): retire it against DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never AND file the ruling's own implementation as a new item BEFORE closing. That ruling names this item by id in its second line and REVERSES its action: the three screens do not get a drafted verdict sentence - what implemented means for them is undecided and belongs to walk 127/129/130/131 - they draw Learn's unmeasured mark instead. The successor named here is that implementation, filed first so the ruling keeps a carrier.

## Relations
- supersedes [[TASK-procedures-export-import-and-template-packs-are-the-only]]
