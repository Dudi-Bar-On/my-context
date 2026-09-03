---
id: NOTE-the-item-detail-pane-compared-45-nodes-in-the-mockup-28-in
type: note
title: "the item detail pane compared: 45 nodes in the mockup, 28 in the app, four differences"
status: active
severity: soft
always: false
summary: "The panel showing one entry's details compared against its design: a whole block missing, some parts unstyled, and one row reading the wrong value."
summary_of: cc584bd7a7e74ae5
acknowledged:
  - citation_form@cb9072c0848138c9
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:preview"
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: e16c5202504b1604
---

# the item detail pane compared: 45 nodes in the mockup, 28 in the app, four differences

Run 2026-08-25 at the owner s request. Both panes opened by clicking an item id, app served over the REAL corpus, mockup on 58800, 1568x1000.

WHAT IS IDENTICAL: the header (`h3.m#paneid` + `button.icon#paneclose`), the title paragraph, and the whole `<dl>` -- type, status, tier, scope, governs, file -- all six rows present and filled in both.

FOUR DIFFERENCES, all in the lower half:

1. THE ENTIRE "DELIVERED - TWELVE WEEKS" BLOCK IS ABSENT from the app -- four elements and seventeen of the mockup s forty-five nodes: the `.welllabel`, `div.spark.plate#panespark` holding twelve `<i>` bars, `p.small#panespn` ("Last delivered this week. 0 spills in that window.") and the paragraph explaining the hatching. Filed as plan:walk seq:40.

2. THE BODY WELL HAS NO WELL. The app EMITS `div.well` and `div.welllabel` -- verified live in the rendered pane -- and `styles.css` does not carry their rules, so the label renders as ordinary text instead of small-caps dim, and the body sits on bare panel instead of in an inset box. Filed as plan:walk seq:41.

3. THE `file` ROW READS THE WRONG FIELD. `app.js:331` is `els.file.textContent = item.source_file ?? '-'`. `source_file` is the INGEST provenance and is null for every hand-authored item, so the row shows a dash on essentially the whole corpus. The mockup shows the item s OWN path, `items/constraint/CONST-postgres-pool-capped-at-20.md`, and `/api/items` already serves it as `filePath`. Filed as plan:walk seq:42.

4. THE BODY RENDERS RAW MARKDOWN -- `>` blockquote markers as literal text, mid-sentence where newlines collapsed. Already filed this session as plan:walk seq:37. The pane is a SECOND renderer from the one that produced that finding: it handles inline backticks (emitting `span.m`) which `preview.js`'s `bodyNodes()` does not, and neither handles blockquotes. seq:37 is updated to say there are two.

AND ONE ASYMMETRY WORTH A RULING RATHER THAN A TASK: the mockup wraps the TITLE in `<bdi>` and leaves the body bare; the app wraps the BODY in `<bdi>` and leaves the title bare. Both are corpus text in an unknown direction, so the honest answer is probably BOTH -- but the two files currently disagree in opposite directions, which no gate can see because each has a `bdi` somewhere.
