---
id: DEC-a-missing-summary-is-drawn-and-named-in-the-item-pane-and
type: decision
title: a missing summary is drawn and named in the item pane, and the command that writes one is composed beside it
status: active
severity: soft
always: false
summary: When an item has no one-line explanation, the detail panel says so plainly and shows the command that would write one, instead of showing nothing.
summary_of: 9857aa09564031e6
scope:
  - src/ui/**
  - test/ui/**
tags:
  - v2
  - ui
  - pane
  - owner-ruling
  - walk
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: a07b9b7684e6a443
---

# a missing summary is drawn and named in the item pane, and the command that writes one is composed beside it

OWNER RULING 2026-09-11, settling a contradiction filed on 2026-09-07 and unresolved since.

THE CONTRADICTION, as `reports/2026-09-07-walk-review.md` (anchor `walk119`) states it.
`TASK-every-item-everywhere-needs-a-trigger-that-explains-it-in` requires a missing summary to be
"drawn and named rather than blank", and requires the trigger to compose the command that would
generate it. `fillPaneSummary` in `src/ui/public/app.js` ruled the opposite under its own heading
ABSENT IS ABSENT: "null hides all three elements rather than drawing an empty paragraph, a blank
line or a dash." One of the two was wrong and neither knew about the other.

THE RULING. The item stands. ABSENT IS ABSENT falls. An item with no summary is DRAWN and NAMED in
the item pane, in the app's own words, with the command that would write one composed beside it —
for every item, with no carve-out by status.

THE EVIDENCE, in the order it was checked rather than in the order it persuades.

1. THE STANDARD DRAWS NO LINE HERE. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
   is a hard owner ruling whose stated scope is READ SURFACES and the read models behind them. Its
   third clause is unconditional - "NEITHER IS EVER RENDERED AS BLANK. A blank is indistinguishable
   from a failure to load, and a reader who cannot tell those apart stops trusting the surface." A
   missing summary is on the MEASURED side of that standard: `summaryState` (core/content-hash.ts)
   returns `absent` as a first-class verdict, the server serves it (`read-model.ts`), and the pane
   received it and threw it away.

2. THE PREMISE `ABSENT IS ABSENT` RESTED ON IS GONE. It read: "every corpus predates the field, and
   the sixteen superseded and deprecated items in this project's own corpus carry none." Measured
   2026-09-11 over `.my_context/items/**`: 1101 items - 1032 active, 40 superseded, 29 deprecated -
   and ZERO of them carry no summary. They were backfilled. `summaryRequiredAtCreate`
   (core/summary-gate.ts) now refuses a capture that carries none, so nothing new can be born
   without one either. The noise the old ruling existed to prevent does not exist on this corpus in
   any status, which is also why the narrow form below was refused: it would have bought nothing
   measurable and cost a rule kept by hand.

3. `doctor` ALREADY RULED THIS WAY, ON EVERY ITEM. `checkSummary`'s `summary_absent` finding
   (src/doctor/checks.ts) is a `warn` raised for every item with `summary === null`, with no status
   carve-out, and its remedy is the same command composed here:
   `mycontext edit <id> --summary "<text>"`. Its own comment is the argument - "silence was
   indistinguishable from health" - and it explicitly refuses to mention the opt-out, "because
   offering it would be offering a way to silence a finding rather than answer it." The pane was
   the one surface left dropping a measured state silently, which is what
   `INV-nothing-is-dropped-silently` exists for.

A STATUS CARVE-OUT WAS PROPOSED AND IS REFUSED. The tempting synthesis was: draw it for an ACTIVE
item, whose missing summary is an actionable gap, and keep hiding it for a superseded or deprecated
one that legitimately never had one. It fails twice. The standard makes no such distinction. And the
ITEM CANNOT CARRY ONE: `--summary-omitted` is "an instruction about a write, not a field of an item"
(core/mutate.ts) - it is recorded in the audit row and nowhere else - so a deliberate omission and a
legacy absence both arrive at a read surface as the same `absent`, and status would be a proxy for a
fact the data does not hold.

THE COMMAND IS COMPOSED AND NOT EXECUTED, and this is the one place the implementation departs from
walk/119's letter, which asked for "the same compose-then-Execute pattern the Review queue and
Configure already use." `commandActions` is deliberately not used: the argv ends in the placeholder
`<text>`, because the sentence is written by an agent as an ordinary prompt and this app cannot
compose it - that is walk/119's own architecture. An Execute behind that argv would write the
literal word `<text>` into the corpus as an item's summary, behind an approval that looked like any
other. So the line is SHOWN, in the shape `showCodeSkew()` already uses for a remedy the reader runs
themselves, and `composeCommand` (lib/command.js) builds it so this line and doctor's cannot drift.
IF THE OWNER WANTS AN EXECUTE HERE, it needs a command that takes the sentence - not this one.

WHAT THIS RULING DOES NOT DECIDE. The injection preview's item ROWS (`addRowSummary`,
screens/preview.js) still draw nothing for an item with no summary. That is left as it is on
purpose: walk/119 puts the trigger in the pane and nowhere else - "one implementation, in the pane" -
and a row has its own constraint, "a row that grew to three would stop being a row." Whether a row
should say it too is open, and it is recorded here rather than decided.

## Relations
- answers [[TASK-every-item-everywhere-needs-a-trigger-that-explains-it-in]]
- unblocks [[TASK-every-item-everywhere-needs-a-trigger-that-explains-it-in]]
- derived_from [[STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is]]
