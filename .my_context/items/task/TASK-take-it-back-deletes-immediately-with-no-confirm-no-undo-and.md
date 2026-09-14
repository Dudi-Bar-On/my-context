---
id: TASK-take-it-back-deletes-immediately-with-no-confirm-no-undo-and
type: task
title: Take it back deletes immediately with no confirm, no undo and no announcement, on the one class nothing can regenerate
status: active
severity: soft
always: false
summary: A single click permanently deletes something the tool cannot recreate, with no confirmation, no way back, and nothing announced afterwards.
summary_of: bde728ceaca25045
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - destructive
  - confirm
  - "plan:confirm"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 03dafc1e6b49f94d
plan: confirm
seq: "2"
state: done
priority: "2"
---

# Take it back deletes immediately with no confirm, no undo and no announcement, on the one class nothing can regenerate

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) as row 25 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. "Take it back" deletes an anchor IMMEDIATELY -- no confirm, no undo, no announcement. And the sweep's own copy, on the same screen, says the sweep never touches a hand-marked anchor: so a hand-marked anchor is exactly the class that cannot be recovered by re-running anything.

THE INTERNAL INCONSISTENCY. This app confirms an `Execute` with the best-written confirmation copy in the product, quoting the exact argv, and does NOT confirm this. 684 buttons carrying the identical accessible name "Take it back" sit on the page at once.

THE SUBJECT. A write flow has to confirm that it landed and to leave a route back; this one does neither, on the only data on the screen that cannot be regenerated.
