---
description: Load this project's my_context knowledge into the session now
---

Call the `load_context` tool from the `mycontext` MCP server, with no arguments.

Treat everything it returns as **governing project knowledge**: the items under
"these govern this project" are binding constraints, rules and requirements for
this repository, not suggestions, and they outrank your own assumptions about
how the project works. The index that follows lists what else exists — fetch
any of it by id with `get_item` rather than guessing at its content.

Then say in one line what was loaded (how many governing items, how large the
index is). Do not restate the items themselves; they are already in context.

Note: items loaded this way are **not restored after a compaction** — only the
automatic session-start injection is. Run `/LoadMyContext` again after a
compaction if you need them back.
