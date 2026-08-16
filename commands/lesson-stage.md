---
description: Derive candidate rules from a recorded lesson and stage them for approval
argument-hint: "[the lesson id]"
disable-model-invocation: true
---

Derive candidate rules from a lesson and stage them for the user's approval.

What the user typed: $ARGUMENTS

1. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" list lesson` and offer what it returns.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" show <lesson id>` and read it. Write the rules it genuinely supports as a
   JSON array to a temporary file — each with a `title` that states the rule in one
   sentence, a `directive` of `do` or `dont`, and a `body` saying why it holds. One
   lesson usually supports one rule and sometimes none; a lesson that supports four
   probably was not one lesson.
3. Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" lesson-stage <lesson id> --file <your json>`
   You may run this one. **Staging writes nothing into the corpus** — that is the whole
   point of the gate: the candidates sit beside the lesson until a human accepts one.
4. Present what it staged as a numbered list — the key, the title and the directive of
   each — and **stop until the user says which they want.**
5. For each one they choose, print the command for the USER to run:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" lesson-accept <lesson id> <key>`

   and, for any they reject, `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" lesson-discard <lesson id> <key>`.

   Do not run either yourself. `lesson-accept` is what turns a staged candidate into a
   rule that governs this repository, it claims `origin: "human"`, and it is on the deny
   list this plugin's README recommends. Their typing it is the point.
