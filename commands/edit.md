---
description: Change a field on an item, with the preview and confirmation the CLI gives
argument-hint: "[the item id, and what to change]"
disable-model-invocation: true
---

Change a field on an item in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. Work out the id and the field. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" search "<their words>"`
   and offer what it returns; never guess an id.

   **If they named a field with a fixed set of values but not which value, present the
   values as a numbered list and stop until they answer.** Claude Code has no picker —
   `argument-hint` is placeholder text on the input line, not a control — so a numbered
   list and a wait is the whole mechanism, and it works because this command runs
   through you.

       severity   1. hard   2. soft
       status     1. active   2. draft   3. deprecated   4. validated
       always     1. yes (`--always`)   2. no (`--always=false`)

   `superseded` is deliberately absent from the status list: a retirement records its
   replacement in both directions, so it is `/mycontext:supersede`, not a status change.

   The flags are `--title`, `--body`, `--scope "a/**,b/**"`, `--tags "a,b"`,
   `--severity`, `--always[=false]`, `--status`, `--extra key=value`, and
   `--unlink <relation> <target>` to remove a relation.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" edit <id> <the flags>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

For the two changes people make constantly there are shorter commands with the same
gate: `/mycontext:pin`, `/mycontext:unpin`, `/mycontext:harden`, `/mycontext:soften`.
