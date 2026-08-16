---
description: Record something learned, and derive candidate rules from it
argument-hint: "[what was learned, in one or two sentences]"
disable-model-invocation: true
---

Record a lesson in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what was learned and stop. A lesson is a specific thing that
   happened and what it cost — not a maxim.
2. Print this command for the user to run, filled in, and stop:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" lesson "<the lesson in one sentence>"`

   Do not run it yourself: `mycontext lesson` claims `origin: "human"`, which is the one
   claim you cannot make.
3. When they report the id it returned, the flow continues at `/mycontext:lesson-stage`,
   which is where candidate rules are derived from the lesson and staged for approval.

A lesson is worth recording on its own, even if no rule ever comes out of it. Rationale
items are never auto-injected — they are there to be found later — so recording one costs
nothing that a session has to carry.
