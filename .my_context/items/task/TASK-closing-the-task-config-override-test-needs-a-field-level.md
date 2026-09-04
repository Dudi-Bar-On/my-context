---
id: TASK-closing-the-task-config-override-test-needs-a-field-level
type: task
title: closing the task config-override test needs a field-level config capability the config writer built one level too high
status: active
severity: soft
always: false
summary: Removing a retired field from a project's category override needs a capability nobody has built, so the test proving the override stays in step cannot pass.
summary_of: f5e6a67891f966e7
scope:
  - src/core/config.ts
  - test/core/config-task-override.test.ts
tags:
  - v2
  - rulings
  - config
  - "plan:rulings"
  - "seq:57"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 8c2e7e543a105705
plan: rulings
seq: "57"
state: done
priority: "1"
verified_on: 2026-09-04
---

# closing the task config-override test needs a field-level config capability the config writer built one level too high

`test/core/config-task-override.test.ts`'s third and fourth tests resolve a project's own full, pre-retirement `task` declaration (carrying `progress`, `last_change` and `source` in its `extraFields`) against the current catalogue's `task` (which no longer carries `progress`/`last_change`, per the 2026-09-03 retirement ruling in `core/categories.ts`). Because `resolveConfig` EXTENDS a built-in category's `extraFields` rather than replacing them, the resolved list keeps all nine names — the catalogue's six plus the project's three retired ones — where the test expects the catalogue's six alone.

`mycontext config <name> --delete|--disable` (cli/commands/config.ts, the rulings/20 config writer) operates at the CATEGORY level only: `--delete` is refused by name on a shipped category (`task` included), and `--disable` would switch the whole category off rather than drop one retired field name from it. Neither closes this gap.

Decide, and build, one of two answers:
1. A field-level config capability — a project-level 'drop these built-in extra-field names' override that `resolveConfig`'s EXTEND step consults before unioning, so a project's stale declaration of a retired field can be cleared without touching the rest of its config.
2. A ruling that a project's own full-category override is EXPECTED to keep retired names alive until the project edits its own config.json by hand — in which case `test/core/config-task-override.test.ts`'s two failing assertions are corrected to assert that behaviour explicitly, with a comment recording the ruling, rather than asserting a clean catalogue-only result.

Whichever is chosen, the answer must be recorded here rather than patched around, because it changes what 'extends' means for every other `extraFields` merge in this project, not only `task`'s.
