---
id: TASK-help-the-slash-command-topic-generated-from-src-plugin
type: task
title: "help: the slash-command topic, generated from src/plugin/commands.ts"
status: active
severity: soft
always: false
summary: A help page for the shortcut commands, generated from the same source they come from, saying plainly which ones only a person may run.
summary_of: af56eb9833bbaba1
scope: []
tags:
  - "plan:rulings"
  - "seq:31"
  - "state:done"
  - v2
  - help
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 9f5e8ba4e8aca371
plan: rulings
seq: "31"
state: done
progress: "100"
priority: "2"
source: src/plugin/commands.ts
last_change: "2026-08-21T00:49:59Z"
---

# help: the slash-command topic, generated from src/plugin/commands.ts

OWNER RULING, 2026-08-21: the third invocation surface. The slash commands already GENERATE 24 commands/*.md files from src/plugin/commands.ts, so the topic derives from the same source rather than listing them again.

What it must carry beyond the list: which slash commands are HUMAN-ONLY and why. lesson-accept creates a rule that governs the repository and claims origin human, and has no --agent spelling; that one is the user's and stays the user's. The recommended deny list in the README covers Bash(mycontext lesson-accept *), and the README itself says those rules are prefix matches that a node .../src/cli/index.ts spelling, npx, or a shell variable defeats — so the gate is settings.json, not the program. An agent reading this topic should learn that boundary rather than discover it.

Depends on the cli topic landing first — both edit HELP_TOPICS and the literal list in test/help/help.test.ts.
