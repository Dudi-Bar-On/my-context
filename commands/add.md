---
description: Capture an item in this project's knowledge base, naming the category
argument-hint: "[category] [the item in one sentence]"
disable-model-invocation: true
---

Capture an item in this project's my_context knowledge base, in a category you name.

What the user typed: $ARGUMENTS

**The first word is the category; the rest is the item.** Every other capture command
carries its category in its own name, and those files are generated when the plugin is
built, from the catalogue it ships with. A category this project defined in
`.my_context/config.json`, or one a pack enabled, therefore has no command of its own —
and this is the command that reaches it, because here the category is an argument rather
than part of the name.

1. If nothing was typed, ask what to capture and which category it belongs in, and stop.
   Do not invent either.
2. If the category is not clear, run this and offer what it prints:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" help categories`

   That table is built from THIS project's resolved config rather than from any list
   written down, so it is the catalogue as it stands here — including whatever this
   project added, and excluding whatever it switched off. Its `tier` column is what
   step 5 needs.
3. Call the `create_item` tool on the `mycontext` MCP server with `type` set to that
   category and a `title` that states the claim in one sentence (not a topic — "Postgres
   pool capped at 20", not "database pooling").
4. Fill `body` with WHY it holds, and `scope` with the glob(s) it governs, from what
   has actually been said in this conversation. Do not invent supporting detail, and do
   not interrogate the user — at most one clarifying question. `scope` RESTRICTS where the
   item applies, so leave it empty if the item is not about particular files — an item with
   no scope is unrestricted and applies everywhere.
5. Report the id it returns, in one line, and say which tier it landed on. A **normative**
   category lands as a **draft**: it governs nothing until a human promotes it with
   `/mycontext:review`. A **rationale** category lands active, and rationale is never
   auto-injected into a session — it is there to be found later.

**A category this project does not have, or has switched off, is refused by name**, and
the refusal lists the catalogue it will accept. Read that list rather than guessing again.
It is the same refusal every other surface gives, because every write resolves the
category in one place — which is also why a switched-off category keeps no command file of
its own and cannot be captured under one.

**Prefer `/mycontext:add-<type>` when the category has one.** Those carry that category's
own description and example, so they are the better prompt; this command is for the
categories that have none. For `reference` it is not a preference:
`/mycontext:add-reference` is the only route, because that body is a
**snapshot of a file** and no tool call can make one.

If the MCP server is not available, `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" add <category> "<title>" --body "<why it holds>" --scope "<glob>" --tags "<tag>"` captures the same fields from a
shell — but not by the same route: `mycontext add` is the human-facing command, so it
claims `origin: "human"`, and on a normative category the item lands **active** rather
than as a draft and governs this project the moment it is written. That is why it
additionally requires `--yes` there, and why `Bash(mycontext add *)` is on the deny list
this plugin's README recommends. Prefer the tool, which puts a normative capture through
review first.
