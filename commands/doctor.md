---
description: Run this project's my_context self-check and explain what it found
argument-hint: "[--quiet] [--full|--short|--summary] [--json]"
disable-model-invocation: true
---

Run this project's my_context self-check.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" doctor $ARGUMENTS`

Print the report as it is printed. Then, and only then, add at most three lines: the
finding that matters most, why it matters, and the one command that addresses it.

`doctor` exits non-zero when it finds an error-level problem. That is the command
working, not failing — say what it found rather than reporting that a command failed.

Do not fix anything yourself. Several of the routes it names — `repair`, `supersede`,
`edit` — claim `origin: "human"` and are on the deny list this plugin's README
recommends. Name the command; let the user run it.
