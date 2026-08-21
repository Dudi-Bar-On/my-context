---
description: Move a captured todo or note out of the inbox, into the category it really is
argument-hint: "[which captured item, and which category it belongs in]"
disable-model-invocation: true
---

Promote a `todo` or a `note` out of this project's my_context inbox, into a real category.

What the user typed: $ARGUMENTS

1. Work out the id of the CAPTURE being promoted and the category it should become, and say
   both back to the user before going further. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" todo` for the
   captured todos and `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" search "<their words>" --type note` for the notes, and offer
   what they return; never guess an id.

   **Which category it becomes is the user's decision, not yours.** Promoting a jotted line
   into a normative category is the act that makes it govern this repository, so propose one
   and say why, then wait. `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" help categories` prints the catalogue with what each
   name means.

   `--to todo` and `--to note` are refused: a promotion that stays in the inbox is not
   one. Add `--title "<better wording>"` when the capture's own wording would make a poor
   item title; everything else — the body, the tags and who authored the capture — travels
   unchanged.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" inbox-promote <id> --to <category>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   **This is not `/mycontext:promote`.** That one is `mycontext review promote`: it moves
   a **draft** — already the category it will govern as — into governing. This one moves a
   **capture** into a category in the first place, and the item it creates may itself land as
   a draft, because the capture's origin is carried forward rather than restamped. When it
   does, the preview says so and names `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review promote` as the next step.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

The capture is not deleted. It is marked `deprecated`, keeps its file, its body and its
observations, and the new item points back at it with `derived_from`.
