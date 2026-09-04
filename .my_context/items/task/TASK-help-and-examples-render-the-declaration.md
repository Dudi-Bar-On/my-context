---
id: TASK-help-and-examples-render-the-declaration
type: task
title: help and examples RENDER the declaration
status: active
severity: soft
always: false
summary: The built-in help should show what can be changed on each kind of item, since that is already written down and nothing currently displays it.
summary_of: 14d359589a3b8a98
scope: []
tags:
  - "plan:categories"
  - "seq:16"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 50873028d85d1197
plan: categories
seq: "16"
state: done
---

# help and examples RENDER the declaration

A declaration nothing renders is a declaration nobody reads.

MEASURED: nothing - not the catalogue, not the seven help topics, not `mycontext examples` - says what may be changed on an item or by which command.

DO: `mycontext help categories` shows, per category, its updatable surface. `mycontext examples <category>` shows the commands that change it, next to the example item it already prints. A custom category defined only in config.json must render exactly like a shipped one - that is the check that the data path is the only path.

DEPENDS ON seq 13 and 14.
