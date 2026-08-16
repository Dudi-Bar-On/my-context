---
description: Inject an item at every session start (edit --always=true)
argument-hint: "[the item id]"
disable-model-invocation: true
---

`pin` an item in this project's my_context knowledge base: it sets `always`, so the item is injected in full at every session start.

What the user typed: $ARGUMENTS

1. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" search "<their words>"` and offer what it returns.
   Never guess an id.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" pin <id>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   `pin` is `mycontext edit <id> --always=true` under a shorter name — same gate,
   same preview, same result — so it takes one id and nothing else. To change any other
   field, or more than one, that is `/mycontext:edit`.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.
