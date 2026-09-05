---
id: TASK-the-ui-slash-command-is-hand-written-while-the-ruling-that
type: task
title: the ui slash command is hand-written while the ruling that created it says every slash command is generated
status: active
severity: soft
always: false
summary: One slash command sits outside the generator that produces the other eighty-seven, against the ruling that authored it.
summary_of: 24c06dc545179e74
scope:
  - scripts/gen-commands.ts
  - commands/**
tags:
  - v2
  - plugin
  - slash
  - "plan:rulings"
  - "seq:66"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: dab63ca40cdee826
plan: rulings
seq: "66"
state: todo
priority: "3"
---

# the ui slash command is hand-written while the ruling that created it says every slash command is generated

Found 2026-09-05 while settling rulings/20, which shipped and was closed the same day.

That ruling says plainly that the seventy-odd existing slash commands are GENERATED, pointing at scripts/gen-commands.ts and npm run gen:commands, and that the new one is generated too, not hand-written. commands/ui.md exists and works, carries disable-model-invocation true so a person types it and an agent cannot, and does not appear in the generator at all.

Three files are now hand-written rather than generated: LoadMyContext.md, session-name.md and session-carry.md were added deliberately and are named in the generator's own KEEP list. ui.md is the fourth, and whether it belongs there for a reason or only by accident is what this asks.

The question is not cosmetic, and the reason is the guard that shipped this morning. The generator can DELETE files it did not produce, and a guard now stops it, holding KEEP and HAND_WRITTEN to exactly the same set by test. A hand-written command that nobody recorded as deliberate is precisely the file that guard exists to save, and it was unprotected for as long as it has existed.

Two answers are legitimate and they differ. Either ui.md is generated like the rest, which honours the ruling and needs the generator taught to emit it with its argument hints and its model-invocation flag. Or it stays hand-written because something about it cannot be generated, in which case say what, and record it as deliberate the way the other three are.

Do not answer by adding it to KEEP without deciding which. That would make the symmetry test pass while leaving the ruling contradicted and nobody able to see it.
