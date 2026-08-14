---
description: Show this project's my_context status and health
argument-hint: "[--full|--short|--summary] [--json]"
disable-model-invocation: true
---

Show the state of this project's my_context knowledge base.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" status $ARGUMENTS`

Print the report as-is, then add at most two lines: what, if anything, needs the user's
attention (drafts waiting, an unfinished ingest, an error-level health finding), and the
one command that addresses it. Do not restate the counts they can already see.

For the detail behind `health:`, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" doctor`.
