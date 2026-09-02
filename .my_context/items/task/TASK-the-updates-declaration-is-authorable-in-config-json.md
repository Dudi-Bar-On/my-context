---
id: TASK-the-updates-declaration-is-authorable-in-config-json
type: task
title: the updates declaration is authorable in config.json
status: active
severity: soft
always: false
summary: Let people who define their own categories in the settings file also say which parts of one may be changed.
summary_of: 89a07b3111f1ddfe
scope: []
tags:
  - "plan:categories"
  - "seq:14"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 3f9d50abb87a7cf4
plan: categories
seq: "14"
state: done
---

# the updates declaration is authorable in config.json

The owner's explicit constraint, 2026-08-23: "custom categories are created by humen and it should be written in a way a user could edit and define it in the config".

MEASURED: `CATEGORY_KEYS` (core/config.ts ~267) accepts seven keys - enabled, tier, description, prefix, agentEdits, scopePolicy, extraFields. A person adding a custom category can already set all seven. They must be able to set `updates` too, or a custom category can describe its shape and not its rules.

This is not a special case for `task`: `task` is not special-cased anywhere in the code, it is a config.json entry like any other - measured, it is defined in this repo's own .my_context/config.json with a tier, a prefix, a description and seven extraFields.

DO: add `updates` to `CATEGORY_KEYS` and to `RawCategoryJson`; validate it in the loader with a refusal that NAMES what was wrong and what the accepted shape is, in the style of the existing extraFields refusal (config.ts ~361); decide and document the merge semantics against a shipped category - `extraFields` EXTENDS rather than replaces (config.ts ~831), and `updates` should say which it does rather than leave a reader to find out.
