---
id: KNOWN-the-corpus-pointed-into-the-plans-by-line-number-and-104-of
type: known_issue
title: the corpus pointed into the plans by line number and 104 of 109 pointers were wrong
status: deprecated
severity: hard
always: false
summary: References from the notes into the planning documents pointed at the wrong place, landing a reader in a different section with no sign of it.
summary_of: 5a2f81d6b3dbb94f
acknowledged:
  - body_disagrees_with_meta@ac649959aeaf749a
scope: []
tags:
  - v2
  - process
  - reconciliation
  - citations
  - documentation
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: 2026-09-03
checksum: 8987dbc45ebe9054
---

# the corpus pointed into the plans by line number and 104 of 109 pointers were wrong

MEASURED AND FIXED 2026-08-25 by plan:walk seq:23, the reconciliation. This is the finding that best explains the owner s own words -- that he could not say where v2.0.0 stands.

THE SHAPE. 110 of 344 corpus task items say, in their own words, "this item tracks state only" and hand the specification to a plan document. 109 of those 110 point at it with a LINE NUMBER, in one sentence form:

    my-context/docs/superpowers/plans/<file>.md#task-N at line L -- that file is the
    authority, and this item tracks state only.

THE MEASUREMENT. Resolved every one by finding the real line of its own `## Task N` heading in its own cited file:

    exact   5
    STALE 104
    unparsed 1

Drift up to `+1426` lines. The seven worst are all in `2026-08-16-web-ui-1-server-and-reads.md`, a 6,800-line plan: task 20 cited 5377 and lives at 6803, task 19 cited 5004 and lives at 6390, task 18 cited 4638 and lives at 5990. A reader following the citation lands in the middle of a different task and reads the wrong specification with no signal that anything is wrong.

THE ANCHOR WAS INTACT IN ALL 104. `#task-N` resolved every time -- which is how the true lines were found, and which is why the fix was mechanical and safe. All 104 are corrected; re-measured at 109 exact, 0 stale.

WHY NO GATE SAW IT, AND THIS IS THE PART THAT MATTERS. `verify:citations` EXISTS, and its own docblock states the governing principle -- "The fragment is the identity; the line is a convenience" -- and records that 186 file:line citations once drifted. IT DOES NOT SCAN `.my_context/items/`. Same blind spot as `plan:rulings seq:48`, "verify:citations does not scan either README, which is how six false claims sat there", and larger: 6 false claims there, 104 broken pointers here.

WHY IT MATTERS MORE THAN A WRONG NUMBER. These 110 items are how the corpus reaches the specification. ~43,900 lines of plan documents are unqueryable, and the corpus s answer was "look here" -- pointing 1,400 lines away. That is not a citation defect; it is the specification being unreachable from the one surface anybody queries.

THE DURABLE FIX IS NOT THE CORRECTION. Line numbers rot on the next plan edit, and these rotted without a single person doing anything wrong. See `TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should`.
