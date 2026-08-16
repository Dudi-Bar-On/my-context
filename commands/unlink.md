---
description: Remove a relation from an item
argument-hint: "[which item, which relation, pointing at what]"
disable-model-invocation: true
---

Remove a relation from an item in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. Run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" show <id>` first and read the relations it actually carries. Present them
   as a numbered list and stop until the user picks one — the exact relation AND target
   both have to match, and an unlink that matches nothing is refused rather than reported
   as a success.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" edit <id> --unlink <relation> <target>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

Two relations cannot be removed at all: `supersedes` and `superseded_by`. They are
written together with the lifecycle change that makes them true, and removing one would
leave an item marked as retired with nothing recording what replaced it. If a retirement
itself was wrong, the route is `/mycontext:edit <id> --status active`.

There is no MCP tool for this, deliberately: adding a relation cannot change what governs,
and removing one from a governing item can — it takes away part of what that item asserts.
That makes it the user's, the same way promotion is.
