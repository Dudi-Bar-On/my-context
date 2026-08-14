---
description: Capture a glossary in this project's knowledge base
argument-hint: [the glossary in one sentence]
disable-model-invocation: true
---

Capture a **glossary** — Ubiquitous language: the agreed term, and terms not to use — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what to capture and stop. Do not invent one.
2. Call the `create_item` tool on the `mycontext` MCP server with
   `type: "glossary"` and a `title` that states the claim in one sentence
   (not a topic — "Postgres pool capped at 20", not "database pooling").
3. Fill `body` with WHY it holds, and `scope` with the glob(s) it governs, from what
   has actually been said in this conversation. Do not invent supporting detail, and do
   not interrogate the user — at most one clarifying question. Leave `scope` empty if the
   item is not about particular files; an unscoped item is indexed and searchable but is
   never auto-injected.
4. Report the id it returns, in one line. It lands as a **draft**: it governs nothing until a human promotes it with `/mycontext:review`. Say so in your one-line report.

If the MCP server is not available, `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" add glossary "<title>" --body "<why it holds>" --scope "<glob>" --tags "<tag>" --yes` captures the same fields from a
shell — but not by the same route: `mycontext add` is the human-facing command, so the
item lands **active** rather than as a draft and governs this project the moment it is
written. That is why it requires `--yes`. Prefer the tool, which puts the capture through
review first.
