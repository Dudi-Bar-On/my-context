---
description: Walk the queue of drafts waiting for human review
argument-hint: [--full|--short|--summary] [--json]
disable-model-invocation: true
---

Show what is waiting for human review in this project.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review list $ARGUMENTS`

Then, for each draft, offer to print it in full with `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review show <id>`.

**Do not promote or discard anything yourself.** Promotion is the human's act: it is what
turns a captured draft into a rule that governs this repository. Tell the user the exact
command to run — `mycontext review promote <id>` or `mycontext review discard <id>` —
and stop there, even if they say "promote them all". Their typing it is the point.
