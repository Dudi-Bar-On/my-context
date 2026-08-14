---
description: Capture a adr in this project's knowledge base
argument-hint: [the adr in one sentence]
disable-model-invocation: true
---

Capture a **adr** — Formal decision record, MADR shape — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what to capture and stop. Do not invent one.
2. Call the `create_item` tool on the `mycontext` MCP server with
   `type: "adr"` and a `title` that states the claim in one sentence
   (not a topic — "Postgres pool capped at 20", not "database pooling").
3. Fill `body` with WHY it holds, and `scope` with the glob(s) it governs, from what
   has actually been said in this conversation. Do not invent supporting detail, and do
   not interrogate the user — at most one clarifying question. Leave `scope` empty if the
   item is not about particular files; an unscoped item is indexed and searchable but is
   never auto-injected.
4. Report the id it returns, in one line. Rationale items land active, and rationale is never auto-injected into a session — it is there to be found later. Say so in your one-line report.

If the MCP server is not available, `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" add adr "<title>"` captures the
title only — no body, scope or tags — so prefer the tool.
