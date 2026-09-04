---
id: TASK-create-item-cannot-capture-a-project-defined-extra-field
type: task
title: create_item cannot capture a project-defined extra field, only a built-in one
status: active
severity: soft
always: false
summary: Capturing an item through a tool cannot set a project's own custom field, because the tool offers only the fields the shipped categories declare.
summary_of: 178d137e6af7a921
scope:
  - src/mcp/tools.ts
tags:
  - v2
  - mcp
  - tools
  - "plan:mcp"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: a6c8cb7399f02969
plan: mcp
seq: "3"
state: done
priority: "2"
verified_on: 2026-09-04
---

# create_item cannot capture a project-defined extra field, only a built-in one

`create_item`'s schema builds its category-specific properties from `extraFieldSchema(DEFAULT_CONFIG)` (src/mcp/tools.ts, ~line 443 and ~544), where `DEFAULT_CONFIG` is the STATIC default resolved config — every built-in category's extra fields, and nothing a project has added in its own `config.json`. `update_item` does not have this gap: its schema already carries a genuine free-form `extra: { type: 'object', additionalProperties: { type: 'string' } }` (src/mcp/tools.ts, ~line 640), which is honoured by `updateItem` regardless of which project defined the field.

Give `create_item` the same free-form `extra` object parameter, mirroring `update_item`'s. Wire it into the create-item handler the same way `update_item` reads it (`optExtra(args)`), merged with — not silently overwritten by — the flattened built-in fields the schema already advertises; if a caller passes the same field name in both the flattened argument and the `extra` object, refuse it by name rather than letting one win silently, the way `unknownExtraFieldError` refuses an unrecognised field elsewhere in this file.

Keep the flattened `extraFieldSchema(DEFAULT_CONFIG)` properties as they are — they exist for prompt-visible documentation of the built-in fields, which `extra` alone would not give a model — this only adds the escape hatch `update_item` already has.
