---
id: TASK-ui3-task-0-reconcile-plan-3-s-declared-string-keys-with-the
type: task
title: "ui3 task 0: reconcile plan 3's declared string keys with the mockup, subject by subject"
status: active
severity: soft
always: false
summary: "Compare the sentences one plan invented against the ones the design declares, and decide for each: adopt, drop, or match to an existing one."
summary_of: 2c50ac4a1ad74f01
scope: []
tags:
  - "plan:ui3"
  - "seq:0"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 8d1329db997ae55e
plan: ui3
seq: "0"
state: done
priority: "1"
last_change: "2026-08-21T01:45:20Z"
progress: "100"
---

# ui3 task 0: reconcile plan 3's declared string keys with the mockup, subject by subject

**Ruled 2026-08-21: the mockup is the base, and the difference is settled by judgement rather than by rule.**

Plan 3 declares 69 string keys for Watch and Ask; the mockup declares 21. The owner's instruction: take the mockup as the base, go over both, and combine what makes sense — nothing important is to be lost, and nothing is to be adopted merely because plan 3 says it.

So this is not a merge. For each family plan 3 declares and the mockup does not — watch.stream*, watch.kind.*, watch.spills.*, watch.volume.*, ask.tab.*, ask.projection.*, ask.field.*, plus nav.watch, nav.ask, watch.title, ask.title — decide one of three:

1. **adopt** — the subject is real and the mockup is missing it. Add the key to the mockup, in the mockup's own grammar.
2. **drop** — plan 3 invented a control the design does not want. Correct plan 3.
3. **fold** — the subject exists in the mockup under a different key. Record the mapping so neither document keeps its own spelling.

Every verdict carries its reason. A key adopted without one is the same defect as a key invented.

**Output is a proposal, not an edit.** Nothing is written to the mockup until the owner has read the three lists.

Then the parity test decides whether the result is coherent: it derives its count and refuses invented keys, so an adopted key that no screen renders reddens it.
