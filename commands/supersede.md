---
description: Retire an item in favour of a replacement, recorded in both directions
argument-hint: "[which item, and what replaces it]"
disable-model-invocation: true
---

Retire an item in this project's my_context knowledge base, in favour of a replacement.

What the user typed: $ARGUMENTS

1. Work out both ids — the item being RETIRED and the item that replaces it — and say
   which is which back to the user before going further. Getting them the wrong way round
   retires the wrong item, and this has happened: an agent recording that it had answered
   an open question retired the answer and left the question standing.

   If the replacement does not exist yet, capture it first with the matching
   `/mycontext:add-<type>` command. Retirement without a successor is not offered here;
   the status that means exactly that is `/mycontext:edit <id> --status deprecated`.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" supersede <retired id> --by <replacement id>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

