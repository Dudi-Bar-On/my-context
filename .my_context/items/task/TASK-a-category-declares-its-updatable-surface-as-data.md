---
id: TASK-a-category-declares-its-updatable-surface-as-data
type: task
title: a category declares its updatable surface as DATA
status: active
severity: soft
always: false
summary: Each kind of item should state, as data, which of its parts can be changed and how, so anyone can answer that without reading the code.
summary_of: 47ccd20dc5af3155
scope: []
tags:
  - "plan:categories"
  - "seq:13"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 84ad2cee5a16a622
plan: categories
seq: "13"
state: done
---

# a category declares its updatable surface as DATA

REQ-every-category-declares-what-may-be-updated-on-its-items-and requires that every category declare what may be updated on its items and how. This is the shape.

TODAY `CategoryDef` (core/categories.ts) is six fields: name, prefix, tier, defaultEnabled, description, extraFields. Nothing anywhere says what may be CHANGED on an item or by which command. Across 23 categories only five declare any extra fields at all.

ADD an `updates` declaration to `CategoryDef` and `ResolvedCategory`: per updatable name, which command changes it, what values are legal, and whether it is a FIELD (a value that changes) or a TAG (a fixed membership). Owner ruling 2026-08-23: "the tag is created for grouping and filtering purposes while fields could be used to store values either constant or editable and updatable", and update is NOT a legal operation on a tag - a set supports add and remove, so anything you would want to update is a field.

THE TIER SPLIT IS PART OF THIS TASK, not a follow-up. Most update rules belong to the TIER: severity governs only on normative, status is rationale-only. Declaring those per category would put 23 copies of one fact in the catalogue. Tier declares the general rules; a category declares only what is genuinely its own.

DONE WHEN the declaration exists, every shipped category has one, and a reader can answer "what can I change on this item and how" from the data alone.
