---
id: TASK-the-ui-slash-command-is-hand-written-while-the-ruling-that
type: task
title: the ui slash command is hand-written while the ruling that created it says every slash command is generated
status: active
severity: soft
always: false
summary: The generator has emitted this command since 2026-08-21, two weeks before this was filed, and a byte-for-byte test pins it, so the ruling was never contradicted.
summary_of: bf8534d397be3f73
summary_was:
  - 2026-09-11 One slash command sits outside the generator that produces the other eighty-seven, against the ruling that authored it.
acknowledged:
  - task_unverified@917e779665b4db72
scope:
  - scripts/gen-commands.ts
  - commands/**
tags:
  - v2
  - plugin
  - slash
  - "state:done"
  - "plan:rulings"
  - "seq:66"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 91fad381f4c6d257
plan: rulings
seq: "66"
state: done
priority: "3"
---

# the ui slash command is hand-written while the ruling that created it says every slash command is generated

Found 2026-09-05 while settling rulings/20, which shipped and was closed the same day.

That ruling says plainly that the seventy-odd existing slash commands are GENERATED, pointing at scripts/gen-commands.ts and npm run gen:commands, and that the new one is generated too, not hand-written. commands/ui.md exists and works, carries disable-model-invocation true so a person types it and an agent cannot, and does not appear in the generator at all.

Three files are now hand-written rather than generated: LoadMyContext.md, session-name.md and session-carry.md were added deliberately and are named in the generator's own KEEP list. ui.md is the fourth, and whether it belongs there for a reason or only by accident is what this asks.

The question is not cosmetic, and the reason is the guard that shipped this morning. The generator can DELETE files it did not produce, and a guard now stops it, holding KEEP and HAND_WRITTEN to exactly the same set by test. A hand-written command that nobody recorded as deliberate is precisely the file that guard exists to save, and it was unprotected for as long as it has existed.

Two answers are legitimate and they differ. Either ui.md is generated like the rest, which honours the ruling and needs the generator taught to emit it with its argument hints and its model-invocation flag. Or it stays hand-written because something about it cannot be generated, in which case say what, and record it as deliberate the way the other three are.

Do not answer by adding it to KEEP without deciding which. That would make the symmetry test pass while leaving the ruling contradicted and nobody able to see it.

CLOSED 2026-09-12. THE PREMISE WAS ALREADY FALSE ON THE DAY THIS WAS WRITTEN, and that is the finding rather than the fix. This item says commands/ui.md `does not appear in the generator at all`. It does: src/plugin/commands.ts emits it from genericCommands as a CommandFile whose `file` is `ui.md`, with its argument hints and disable-model-invocation true, and it has done so since commit cbc9c9a7 on 2026-08-21 - fifteen days before this was filed on 2026-09-05. `git log -S` over that string in src/plugin/commands.ts returns that one commit and no other, so it was never added and removed. WHAT PINS IT. test/plugin/commands.test.ts holds `the committed command files are exactly the generated ones, byte for byte`, and ui.md is in the committed set and in neither KEEP nor HAND_WRITTEN, so it is compared as generated on every run: 28 of 28 pass. So the ruling this item worried was contradicted is honoured, the drift guard is not being asked to protect ui.md because the generator wants it, and the two answers this item offered - teach the generator, or record it as deliberate - are both already moot. NEITHER WAS TAKEN AND NOTHING WAS CHANGED. Filed as a measurement: this is the fourth item this week found asking for work that had shipped, and like the others it was settled by reading the code rather than the item.
