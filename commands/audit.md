---
description: "Show what my_context did at run time: mutations, and injections by scope"
argument-hint: "[--since T] [--item ID] [--session ID] [--op O] [--limit N] [--summary|--items|--sessions|--files]"
disable-model-invocation: true
---

Show the run-time audit log: every mutation, and every hook action including injections.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" audit $ARGUMENTS`

Print the table as it is printed. Useful shapes: `--since 7d` for the last week,
`--item <id>` for everything that happened to one item (including the injections that
delivered it and the ones that spilled it), `--summary` for counts by operation,
`--items` for what the log names most, `--sessions` for which sessions it has seen.

**What an injection record does and does not contain.** It records the SCOPE of the
injection — which items, at which tier, and what the budget spilled — and never the
injected text. So it answers "what did this session see" and cannot answer "what did that
item say at the time"; the item's own file and `/mycontext:show` answer that.

The append-only JSONL under `.my_context/.audit/` is the record; the SQLite file beside
it is a derived query index and is safe to delete. Both are gitignored, so this log
describes THIS machine only — a clone of the repository elsewhere has its own.
