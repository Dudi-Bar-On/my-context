---
description: List this project's non_goal items
argument-hint: [--full|--short|--summary] [--json]
disable-model-invocation: true
---

List this project's **non_goal** items.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" list non_goal $ARGUMENTS`

Show the table as it is printed — it is already column-aligned with headers. Do not
re-format it, re-sort it or summarise it away. `--full` adds origin, layer and scope;
`--summary` counts instead of listing; `--json` is for piping.

If the user asked a question rather than for a listing, answer it from the rows, and say
which ids you used.
