---
description: Print one item from this project's knowledge base in full
argument-hint: "[the item id]"
disable-model-invocation: true
---

Print one item from this project's my_context knowledge base, in full.

What the user typed: $ARGUMENTS

1. If no id was given, ask which item — or, if they described one instead of naming it,
   run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" search "<their words>"` and offer the ids it returns. Never guess an id;
   ids look guessable and are not.
2. Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" show <id>`
3. Print what it returns as it is printed. The body, the observations and the relations are
   the item; a summary of them is not what was asked for.

The fields are explained by `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" help capture`. If the item is a `reference`, its body
is a snapshot of a file and may have drifted — `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" doctor` reports that.
