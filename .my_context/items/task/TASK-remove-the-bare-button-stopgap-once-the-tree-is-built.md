---
id: TASK-remove-the-bare-button-stopgap-once-the-tree-is-built
type: task
title: remove the bare-button stopgap once the tree is built properly
status: active
severity: soft
always: false
summary: A blanket styling patch for unstyled buttons should be reconsidered once the screen that needed it is built properly.
summary_of: 69f8aa7b44a7fb71
scope: []
tags:
  - "plan:port"
  - "seq:3"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 83c5921ae1ff2f65
plan: port
seq: "3"
state: done
---

# remove the bare-button stopgap once the tree is built properly

button{background:none;border:0} exists only because classless buttons escaped every reset. When coverage.js stops inventing its tree, reconsider this rule rather than silently inheriting it - the carried rule from the mockup resets only font and color, and that is enough THERE because every button the mockup writes carries a class that paints it.
