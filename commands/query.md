---
description: Run a read-only SQL query over this project's my_context index
argument-hint: "[a SELECT statement, or a question to turn into one]"
disable-model-invocation: true
---

Answer a question about this project's my_context corpus with SQL.

What the user typed: $ARGUMENTS

1. If they wrote a statement, use it. If they wrote a question, write the statement — and
   show it to them before you run it, so they can see what you asked.
2. Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" query "<the statement>"` (add `--json` when you need to compute on the
   result rather than read it).
3. Report the rows. If the answer is a count or a single value, say the value; do not
   paste a one-cell table.

The schema, which is one table:

    items(id, type, title, status, always, has_scope, layer, file_path, updated_at, data)

`data` holds the whole item as JSON — reach into it with `json_extract(data, '$.scope')`,
`'$.tags'`, `'$.severity'`, `'$.relations'`.

**`updated_at` is index write time, not a Markdown timestamp.** Every query rebuilds the
index first, so `updated_at` is rewritten to "now" on every row on every run. It answers
"when was this row last indexed" — always: this invocation — and never "when did this item
last change". For that, read the file or its git history. Sorting or filtering by it
produces an answer that looks meaningful and is not.

**What "read-only" here does and does not mean.** Only `SELECT` (or `WITH … SELECT`) is
accepted, one statement at a time; the connection is opened read-only, so the engine
itself refuses writes to the index. Those two together are the boundary. They are not a
proof: the denylist is a keyword scan over a full SQL grammar and cannot be complete, and
`VACUUM INTO` is the one statement that writes a file **outside** the index — the
read-only connection does not stop it, and the keyword scan is the only thing that does.
So: this is a read surface, and it is not a sandbox. Do not tell a user it cannot touch
their disk.

To change an item, that is `/mycontext:edit` — never a SQL statement.
