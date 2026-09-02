---
id: TASK-the-audit-stream-renders-one-generic-what-cell-where-the
type: task
title: the audit stream renders one generic WHAT cell where the mockup composes a sentence per kind
status: active
severity: soft
always: false
summary: The activity feed prints raw fields the same way for every kind of event, where each kind should read as its own plain sentence.
summary_of: 957d27a55fc539bf
scope: []
tags:
  - "plan:screens"
  - "seq:1w"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: ecafd49b5c86e46d
plan: screens
seq: 1w
state: done
---

# the audit stream renders one generic WHAT cell where the mockup composes a sentence per kind

screens/watch.js whatOf() prints the record's raw fields in a fixed order - op, then itemId, then note, then path - for mutation, hook, access and progress alike. Only injection and focus have dedicated renderers. mutation happens to look correct because its shape is op plus id; the other three do not.

The mockup composes a DISTINCT sentence per kind. Its own rows: hook reads SessionStart - 2 pinned, 7 index, an event name and its counts; access reads ui-refused - a write was attempted from the read-only UI, a check name and an explanation of it; progress reads step-done - PROC-release-checklist, step 3 of 7, an op, a procedure and a position in it. None of those is op-itemId-note-path.

Build a renderer per kind, reading the mockup's own row for each as the specification, and keep every sentence in the string tables - the mockup keys them and this app has no data-t scanner, so each needs a key in both en.js and he.js.

WHY THE PARITY GATE DID NOT CATCH THIS, which matters as much as the defect: e2e/screen-parity.spec.ts compares element KINDS, and every one of these rows is the same bdi and span.m whichever kind it describes. The elements are identical and the PROSE differs, so the gate is blind to it by construction. Found by the owner looking at the two screens side by side. A comparison of kinds cannot replace looking, and this is the proof.
