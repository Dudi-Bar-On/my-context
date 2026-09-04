---
id: TASK-stopgap-a-bare-button-draws-nothing-of-its-own
type: task
title: "stopgap: a bare button draws nothing of its own"
status: active
severity: soft
always: false
summary: A blanket rule stopping unstyled buttons from painting themselves grey across a wall of nearly a thousand; a symptom fix, since replaced.
summary_of: 19be4ed5e2c719c1
scope: []
tags:
  - "plan:fixes"
  - "seq:6"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: b81dda93707cd363
plan: fixes
seq: "6"
state: done
---

# stopgap: a bare button draws nothing of its own

coverage.js builds the repository tree from CLASSLESS buttons, which kept the UA buttonface: 957 elements painting rgb(240,240,240) in a wall 5843px tall, and the same defect in miniature on injected where .linkid sits in a td. button{background:none;border:0} takes it to zero. Labelled a stopgap because it treats the symptom. Landed 7c17cfd. Retired by port task 3.
