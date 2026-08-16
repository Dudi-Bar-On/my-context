---
description: Promote a draft so it starts governing this project
argument-hint: "[the draft id]"
disable-model-invocation: true
---

Promote a draft in this project's my_context knowledge base, so that it starts governing.

What the user typed: $ARGUMENTS

1. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review list` and show what is waiting. Then print each
   candidate in full with `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review show <id>`, and stop until the user names one.
   **Do not promote them all**, even if asked to: the point of this queue is that a human
   read each one.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review promote <id>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

Promotion is the act that turns captured text into a rule this repository is governed by.
It is the single decision this whole product exists to keep with the user.
