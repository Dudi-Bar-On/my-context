---
id: TASK-coverage-js-builds-a-classless-button-tree-the-mockup-does
type: task
title: coverage.js builds a classless-button tree the mockup does not have
status: active
severity: soft
always: false
summary: The coverage tree builds nearly a thousand plain buttons the design never called for, and needs rebuilding the way the design describes.
summary_of: 2effb3e89308a399
scope: []
tags:
  - "plan:port"
  - "seq:2"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: a682213b4ee8b989
plan: port
seq: "2"
state: done
---

# coverage.js builds a classless-button tree the mockup does not have

The mockup’s entire coverage section contains exactly one button, <button data-copy>. coverage.js line ~234 builds one classless button per tree node - 957 of them against the real corpus. Rebuild the tree the way the design of record describes. This is what port task 3 is waiting on.
