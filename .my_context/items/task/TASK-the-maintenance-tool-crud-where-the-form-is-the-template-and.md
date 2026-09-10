---
id: TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
type: task
title: "the maintenance tool: CRUD where the form is the template, and publishing is the gate"
status: active
severity: soft
always: false
summary: A private tool for the product owner to write and publish the rules, with the size limit enforced where it cannot hurt a user.
summary_of: e43cb7bf9efa9907
scope:
  - src/ui/maintenance/**
  - src/rules/**
  - package.json
  - test/rules/**
  - e2e/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 4a9c31b88e340c64
plan: store
seq: "3"
state: todo
priority: "1"
needs: store/2
---

# the maintenance tool: CRUD where the form is the template, and publishing is the gate

D41 PHASE 3. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 9-13. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md sections 10, 11, 12.

IT DOES NOT SHIP, AND THAT IS THE WHOLE SECURITY MODEL. `package.json`’s `files` already keeps
`scripts/` out of the published package; the same mechanism keeps this out. A user does not fail
to reach the tool - they do not have it. Assert that, rather than assuming it: if it ever ships,
the no-authentication decision is void.

THE FORM IS THE TEMPLATE. A prohibition’s form has a `why` field and will not save without one,
from the same table the schema and the check read. Three things that can drift are one thing.

AND THE BUDGET IS GOVERNED HERE BUT ENFORCED AT PUBLISH: a user’s install NEVER refuses on size,
because a user cannot fix a store that grew. Publishing refuses instead and names what to move.
Per-entry size is computed, never persisted - a persisted size is a cache that goes stale.
