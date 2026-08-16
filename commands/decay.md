---
description: Show items that have not been injected into a session lately
argument-hint: "[--sessions N] [--all] [--full|--short|--summary] [--json]"
disable-model-invocation: true
---

Show which items in this project have not reached a session lately.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" decay $ARGUMENTS`

Print the table as it is printed. `--sessions N` sets the window; `--all` includes the
items that have never been injected at all.

A cold item is **not** evidence that it is wrong. Read the list for what it actually
says: an item nothing has matched may be scoped to files nobody touched, may be a
rationale item that is never auto-injected by design, or may genuinely be stale. Say
which of those you think it is and why, and do not propose deleting anything — nothing in
this product deletes an item, and retirement names a replacement (`/mycontext:supersede`).
