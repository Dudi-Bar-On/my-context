---
id: TASK-the-pane-file-row-reads-source-file-so-it-shows-a-dash-on
type: task
title: the pane file row reads source_file, so it shows a dash on every hand-authored item
status: active
severity: soft
always: false
summary: The detail panel shows a dash where a file path should be, because it reads the wrong field for nearly every item.
summary_of: e351b2030af336cc
scope: []
tags:
  - v2
  - ui
  - "screen:preview"
  - tree-parity
  - "plan:walk"
  - "seq:42"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 162d4399437ad916
plan: walk
seq: "42"
state: done
priority: "2"
source: "owner request 2026-08-25: the item detail pane, app vs mockup, real corpus"
---

# the pane file row reads source_file, so it shows a dash on every hand-authored item

FOUND 2026-08-25 by owner request 2026-08-25: the item detail pane, app vs mockup, real corpus.

THE LINE: `app.js:331` -- `els.file.textContent = item.source_file ?? '-'`.

`source_file` is INGEST PROVENANCE: the document an item was ingested FROM. It is null for every hand-authored item, and this corpus is 489 items of which the overwhelming majority are authored. So the `file` row of the item detail pane shows a dash almost always.

THE MOCKUP SHOWS THE ITEM S OWN PATH: `items/constraint/CONST-postgres-pool-capped-at-20.md`. And the data is already on the wire -- every item JSON carries `filePath` beside `sourceFile`, so this is a field name, not a read-model gap.

CONFIRM THE INTENT BEFORE CHANGING IT, because both readings are defensible and only one is drawn: `pane.file` could mean "where this item lives" (the mockup s sample) or "where this item came from" (what the code reads). The mockup is the design of record and its sample is unambiguous -- but if the intent is provenance, then the row needs a different LABEL and an honest empty state under `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, because a bare dash does not distinguish "not ingested from anything" from "we do not know".

EITHER WAY THE CURRENT STATE IS WRONG: it shows a dash where the design of record shows a path, on nearly every item in a real corpus, and no gate can see it because the element is present and correctly classed.

DONE 2026-08-25, code 5e69257. All seven gates green: typecheck, 4,572 node tests, 136 browser tests (Chromium and real Chrome), four static gates.

One line, and the bug was worse than the task described.

It read `item.source_file`. THAT FIELD DOES NOT EXIST ON THE WIRE IN ANY CASE -- the payload spells it `sourceFile` -- so the row rendered `-` for EVERY item ever opened, not merely for un-ingested ones. And even spelled correctly it was the wrong fact: `sourceFile` is ingest provenance, null for every hand-authored item.

Now reads `item.filePath`, the item s own file, which is what the design of record shows in that row. Verified live: `items/constraint/CONST-evidence-must-cite-a-captured-record-id.md`.

TWO BUGS THAT HID EACH OTHER, and no parity gate could see either: the `<dd>` was present, correctly classed, and held a plausible dash.
