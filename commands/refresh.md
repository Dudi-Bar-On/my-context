---
description: Re-snapshot a reference from the file it was captured from
argument-hint: "[the reference id]"
disable-model-invocation: true
---

Take a fresh snapshot of a `reference` item from the file it was captured from.

What the user typed: $ARGUMENTS

1. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" list reference` and offer what it returns.
   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" doctor` is what reports which snapshots have drifted from their source.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" refresh <id>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

A refresh replaces the stored body with the file as it is now. What the file said before
is not kept by this command — the item's own git history is where that lives.
