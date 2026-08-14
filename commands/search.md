---
description: Search this project's my_context knowledge base
argument-hint: "[what to look for]"
disable-model-invocation: true
---

Search this project's my_context knowledge base for: $ARGUMENTS

1. Call the `query_items` tool on the `mycontext` MCP server. Use its `text` filter for
   words, `type` for a category, `tag` for a tag, and `path` when the user is asking what
   governs a particular file.
2. If nothing matches, widen once (drop the type filter, or try a synonym) before saying
   there is nothing — and then say so plainly rather than answering from your own
   assumptions about this project.
3. Report each hit as id — title, and offer to open one in full with `get_item`. Never
   guess an id; ids look guessable and are not.
