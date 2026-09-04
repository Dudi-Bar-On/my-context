---
id: TASK-config-task-override-is-red-because-the-test-carries-a-stale
type: task
title: config-task-override is red because the test carries a stale literal, not because the workspace declares retired fields
status: active
severity: soft
always: false
summary: A test compares against a hardcoded snapshot of a config entry this workspace no longer has, so no config change can close it.
summary_of: 1a9539c61754cd01
scope:
  - test/core/config-task-override.test.ts
  - src/core/config.ts
tags:
  - v2
  - config
  - tests
  - "plan:rulings"
  - "seq:59"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: ee928a563e9d72e3
plan: rulings
seq: "59"
state: todo
priority: "2"
---

# config-task-override is red because the test carries a stale literal, not because the workspace declares retired fields

Measured 2026-09-04 after the owner ran the command that was supposed to close it. His config.json declares profile, categories, budgets, watchedDocs, handover and ui, and categories.task is NOT among them. The field writer refused correctly: there is nothing to remove progress and last_change from.

So the diagnosis carried all afternoon was wrong, and it was repeated in several task bodies and commit messages. The test does not read the workspace config. It builds its own literal, a snapshot taken when that entry existed, and asserts a resolution against it. The literal is what is stale.

What to do: decide what the test should assert now that the shape it snapshotted is gone. It was written to prove that a config declaring a category in full resolves to the shipped shape, which is a real property worth keeping, so the fix is to rebuild the fixture from something that cannot go stale rather than to delete the test or to edit a number until it passes.

Worth noting for whoever picks it up: this red was used to justify prioritising field-level config editing. That capability is real and now in use, but it was argued partly from this false premise, and the argument should not be reused without checking it.
