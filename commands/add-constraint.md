---
description: Capture a constraint in this project's knowledge base
argument-hint: "[the constraint in one sentence]"
disable-model-invocation: true
---

Capture a **constraint** — Non-negotiable limit: budget, stack, regulation, SLA — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what to capture and stop. Do not invent one.
2. Call the `create_item` tool on the `mycontext` MCP server with
   `type: "constraint"` and a `title` that states the claim in one sentence
   (not a topic — "Postgres pool capped at 20", not "database pooling").
3. Fill `body` with WHY it holds, and `scope` with the glob(s) it governs, from what
   has actually been said in this conversation. Do not invent supporting detail, and do
   not interrogate the user — at most one clarifying question. `scope` RESTRICTS where the
   item applies, so leave it empty if the item is not about particular files — an item with
   no scope is unrestricted and applies everywhere.
4. Report the id it returns, in one line. It lands as a **draft**: it governs nothing until a human promotes it with `/mycontext:review`. Say so in your one-line report.

If the MCP server is not available, `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" add constraint "<title>" --body "<why it holds>" --scope "<glob>" --tags "<tag>" --yes` captures the same fields from a
shell — but not by the same route: `mycontext add` is the human-facing command, so the
item lands **active** rather than as a draft and governs this project the moment it is
written. That is why it requires `--yes`. Prefer the tool, which puts the capture through
review first.
