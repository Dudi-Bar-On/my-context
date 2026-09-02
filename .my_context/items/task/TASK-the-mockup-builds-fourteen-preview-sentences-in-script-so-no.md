---
id: TASK-the-mockup-builds-fourteen-preview-sentences-in-script-so-no
type: task
title: the mockup builds fourteen preview sentences in script, so no string table can carry them
status: active
severity: soft
always: false
summary: Fourteen sentences on the main screen can never be translated, because the design writes them in code instead of declaring them.
summary_of: 2f7eaad3e3a8f979
scope: []
tags:
  - "plan:screens"
  - "seq:1s-b"
  - "state:todo"
  - v2
  - ui
  - i18n
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: efa86ad1af1920d0
plan: screens
seq: 1s-b
state: todo
---

# the mockup builds fourteen preview sentences in script, so no string table can carry them

Found 2026-08-23 while building the tier ribbon and the gate ladder (screens plan, seq 1s). The mockup declares a string key with data-t, data-t-aria or data-t-title, and test/ui/strings-parity.test.ts holds the tables to exactly that set in BOTH directions - a key in a table the design of record does not declare fails as an invented string. But the ribbon and the ladder get their words from the mockup's own SCRIPT, with an inline HEB ternary and no data-t anywhere: the six GATES names and descriptions, the not reached prefix, the does not run on this event label, the four ribbon hint sentences, and the used / budget in / out label. Fourteen runs of prose that cannot become keys without the mockup declaring them first. screens/preview.js draws them as English literals - the same treatment parts.js TIERCHIP gives a tier name - so under the alef toggle the ladder's descriptions and the ribbon's hints stay English. Photographed in reports/2026-08-23-ui3-1s-preview/app-he-ladder.png. The tier CODES are product vocabulary and are right as literals; the DESCRIPTIONS are prose and are not. What it needs: the design of record moving those runs into data-t elements, then the keys into both tables. Owner's file, owner's edit.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. Nothing has changed the fact and no later task covers it.

The owner ruled the general case on 2026-08-25 -- "give the mockup a data-t and ship it" -- when the same question was asked about the simulate readout (plan:walk seq:6). That ruling settles the METHOD for these fourteen runs and does not do the edit.

IT IS PART OF THE ONE MOCKUP SESSION. The owner s file, the owner s edit, and it can only be done beside the others: plan:walk seq:20 (draw the builder once), seq:13 (the config composer), seq:14 (carry the budget), seq:25 (the markdown route), seq:19 (foreign_store), seq:1h (Hebrew emphasis), seq:3 (a command block per procedure card), seq:6 (the simulate readout s data-t), and plan:screens seq:1s-b, seq:1s-c and seq:10s. TWELVE items, not six -- the reconciliation found six more that had been counted as ordinary open work.
