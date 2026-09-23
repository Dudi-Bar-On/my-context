---
id: TASK-the-capture-screen-offers-execute-for-a-command-its-own
type: task
title: the Capture screen offers Execute for a command its own field list can never complete
status: active
severity: soft
always: false
summary: The screen that builds an add command lets the reader press Execute, but the command it sends is missing the summary the tool now demands, so the run always ends in a refusal.
summary_of: e601f86aa4f8a41c
scope: []
tags:
  - "plan:release"
  - "seq:27"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 6c7d3985d97feccf
plan: release
seq: "27"
state: todo
---

# the Capture screen offers Execute for a command its own field list can never complete

Found by task 3.8's proof spec on 2026-09-23 and measured on the baseline before the CSP header existed, so it is not the header's doing: src/ui/public/screens/capture.js FIELDS (around line 314) has no summary field and no --summary-omitted switch, and since the summary gate (src/core/summary-gate.ts, task 3.4) every add without one is refused. Execute reaches the server, the server runs the command in the derivation copy, and the screen faithfully renders the CLI's refusal. Closing condition: the Capture builder carries the summary the way the CLI's own add does (a field, or the explicit omission switch where the category allows it), a Capture execution reaches an execute-done row with exit 0, and e2e/csp-executes.spec.ts's Capture phase is lifted to the same full runFrom + execute-done assertion the other three screens have (the spec's own docblock says to). Files: src/ui/public/screens/capture.js, e2e/csp-executes.spec.ts, test/ui coverage of the builder's fields. Release phase 6 (UI).
