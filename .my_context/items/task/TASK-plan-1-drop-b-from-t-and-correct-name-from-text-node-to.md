---
id: TASK-plan-1-drop-b-from-t-and-correct-name-from-text-node-to
type: task
title: "plan 1: drop {b:} from t(), and correct {name} from text node to isolated element"
status: active
severity: soft
always: false
summary: "Two corrections to a translation plan: drop a marker that duplicated another, and build inserted values so they read correctly in Hebrew."
summary_of: 56b5344de7827f0c
scope: []
tags:
  - "plan:rulings"
  - "seq:29"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 3e719f875d2aafb4
plan: rulings
seq: "29"
state: done
progress: "100"
priority: "1"
source: docs/design/web-ui-mockup.html
last_change: "2026-08-20T17:42:46Z"
---

# plan 1: drop {b:} from t(), and correct {name} from text node to isolated element

Follows the owner amendment to ruling C3. Plan 1 Task 16 was amended this afternoon to honour a fourth {b:} marker and to build {name} as a TEXT NODE. Both are now wrong.

{b:} is dropped — it duplicated {v:}, because the mockup already renders every value slot as <span class="v"> with .v{unicode-bidi:isolate}. Nothing uses it: no string table may carry it and none does, so this is a removal, not a migration.

{name} must build an ISOLATED element, not a text node. That is what the mockup does and what the RTL case needs — a count or an id inside Hebrew prose keeps its own direction. My ruling table said text node and was wrong.

Also correct Task 1's note about the parity test gaining a {b:} matcher.
