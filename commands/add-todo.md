---
description: Capture a todo in this project's knowledge base
argument-hint: "[the todo in one sentence]"
disable-model-invocation: true
---

Capture a **todo** — Something to build or fix later, captured the moment it occurs to you — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what to capture and stop. Do not invent one.
2. Call the `create_item` tool on the `mycontext` MCP server with
   `type: "todo"` and a `title` that states the claim in one sentence
   (not a topic — "Postgres pool capped at 20", not "database pooling").
3. Fill `body` with WHY it holds, and `scope` with the glob(s) it governs, from what
   has actually been said in this conversation. Do not invent supporting detail, and do
   not interrogate the user — at most one clarifying question. `scope` RESTRICTS where the
   item applies, so leave it empty if the item is not about particular files — an item with
   no scope is unrestricted and applies everywhere.
4. Fill `summary` with one plain sentence for a reader who does not know this codebase:
   what the item IS and why it matters — no ids, no file paths, no measurements, never how
   it was found. It is **required**: a capture without one is refused, because an item
   created with no summary can never afterwards be asked for one. If this item genuinely
   has nothing to say in one sentence that its title does not, pass
   `summary_omitted: true` instead and say in your report that you did.
5. Report the id it returns, in one line. Rationale items land active, and rationale is never auto-injected into a session — it is there to be found later. Say so in your one-line report.

If the MCP server is not available, `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" add todo "<title>" --body "<why it holds>" --summary "<one plain sentence>" --scope "<glob>" --tags "<tag>"` captures the same fields from a
shell, landing active exactly as the tool does.
