---
id: TASK-an-id-in-a-composer-result-opens-the-item-pane-the-same-as
type: task
title: an id in a composer result opens the item pane, the same as an id anywhere else
status: active
severity: soft
always: false
summary: Anything the command builder prints that names a stored item can be opened and read in place.
summary_of: 535b3ae405adc73f
scope:
  - src/ui/public/screens/palette.js
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:13"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: a014261cba829e93
plan: builder
seq: "13"
state: done
priority: "2"
verified_on: 2026-09-06
---

# an id in a composer result opens the item pane, the same as an id anywhere else

Owner request 2026-09-06 (plan D20), after driving the Composer and confirming it executes real
commands and returns correct results: when a result shows a list or contains item ids, those ids
should open the right-hand pane that already renders a full item with all its properties.

THE MECHANISM ALREADY EXISTS AND IS ONE LINE TO JOIN. app.js `installItemPane()` registers ONE
delegated click listener on `document` that matches `event.target.closest(‘[data-id]’)` and calls
`openPane(id)`. So ANY element anywhere carrying `data-id="<id>"` already opens the pane. Nothing
needs to be wired, imported or exported - `src/ui/public/screens/palette.js` carries ZERO `data-id`
today, and that is the entire gap.

THE REQUEST IS TWO POPULATIONS AND THEY ARE NOT THE SAME DIFFICULTY.

  1. STRUCTURED RESULTS - exact, and there is no excuse for getting them wrong. `resultRows(body)`
     already returns `{rows, total, truncated}` from `body.items` (each an item object) or a single
     `body.item` whose `.id` is checked to be a string. The id is a FIELD. Setting `dataset.id` on
     the row or the id cell is exact: no parsing, no regex, no false positives. Do this first and
     completely.

  2. TEXT OUTPUT from an executed command - where the id is prose in an ASCII table, and every hard
     question lives. RECOGNITION IS THE PROBLEM: there are 29 categories, so the id prefixes are a
     derived set and never a typed one. A string that merely LOOKS like an id is the failure mode -
     resolve against the index rather than against a regex’s opinion, or make a miss degrade to
     plain text rather than to a pane that opens on nothing.

THREE CONSTRAINTS THIS FILE ALREADY KNOWS ABOUT, so none of them is new work:

  NEVER BUILD HTML FROM COMMAND OUTPUT. Executed output is text this app did not compose. It is
  rendered as nodes, with `textContent`, and a linkified id is an element wrapping a text node -
  never a string of markup. app.js already carries the note about `#panebody` and markdown for the
  same reason.

  AN ID IS ISOLATED. `argvChip` already wraps every chip value in `<bdi>` and says why in a comment:
  this page is `dir="rtl"` in Hebrew, and an id reorders around neighbouring punctuation without
  isolation. A linkified id in a result needs the same treatment - the reason it exists for chips is
  the reason it applies here.

  ALIGNMENT SURVIVES. Text output is a monospace table whose columns line up by character count. A
  link that adds a border, padding or a different font breaks the alignment that makes the table
  readable. Whatever marks an id as clickable must not change its metrics.

AND THE PANE MUST REFUSE HONESTLY. `openPane` on an id the index does not hold has to say so
readably. A pane that opens empty is worse than a word that was never a link.

OUT OF SCOPE: a REF (`builder/10`, a plan and a seq) is not an id and `openPane` does not take one.
If refs should be clickable too that is a second task - name it, do not absorb it.

THE OWNER’S OWN ACCEPTANCE CASE, given 2026-09-06 and verified the same day. He ran the `list`
entry, chose `rule`, and got a list of rule ids - "which is classic and simple to use for getting
item details by asking it from the pane".

That case is measured and it is population 1 exactly:

  `list` is PALETTE entry `name: ‘list’, kind: ‘read’, runnable: true`, so it executes for real.
  `mycontext list rule --json` answers `{ items: [ { id: ‘RULE-…’, type, status, title, origin,
  layer, severity, always, scope, tags, sourceFile, filePath, … } ] }` - `items` is exactly the
  key `resultRows` already destructures, and `id` is already a string field on every row.

So for this case there is NOTHING TO PARSE. The row object carrying the id is the same object the
table cell is built from. This is the acceptance test: execute `list` with `rule` in the Composer,
click a returned id, and the pane opens on that item. If that does not work, nothing else in this
task matters.
