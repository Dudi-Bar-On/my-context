---
id: TASK-hooks-task-16-the-slash-commands
type: task
title: "hooks task 16: The slash commands"
status: active
severity: soft
always: false
summary: Two shortcut commands for naming a session and carrying work into the next one, and a guard so the hand-written ones are not deleted by the generator.
summary_of: 1b799e1030879853
summary_was:
  - 2026-09-03 The shortcut commands for session and carry-over work, waiting on a measurement that only a live session can provide.
acknowledged:
  - body_disagrees_with_meta@a2233a0553063bf5
scope: []
tags:
  - "plan:hooks"
  - "seq:16"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: e7156384a6d5fdf8
plan: hooks
seq: "16"
state: todo
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md#task-16"
last_change: "2026-08-20T00:00:00Z"
priority: "4"
---

# hooks task 16: The slash commands

Task 16 of the hooks plan, and the specification is the task section itself: `docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md` · `## Task 16: The slash commands` · ~1870. That file is the authority and its decision table is not repeated here. What follows is what somebody picking this up needs to know before opening it.

WHAT TO BUILD. Two hand-written slash commands, `commands/session-name.md` and `commands/session-carry.md`, following `commands/LoadMyContext.md`'s frontmatter shape (`description:` only). They are what §6d and §6g require, so session selection works without the web UI. Consumes tasks 13, 15 and 18. Neither file exists: measured 2026-09-03 against `commands/`, which holds `LoadMyContext.md` and the generated `add-*` / `list-*` set and nothing else.

THE DRIFT GUARD GOES FIRST, and it is worth more than the two commands. Both files are hand-written, so both must be excluded from generation in TWO separately kept places: `scripts/gen-commands.ts` · `const KEEP = new Set(['LoadMyContext.md']);` · ~23 stops the generator deleting them, and `test/plugin/commands.test.ts` · `const HAND_WRITTEN = new Set(['LoadMyContext.md']);` · ~40 stops the parity test failing on them. Two hand-kept lists that must move together is the drift this project has found repeatedly, and it bites here.

So the first step is an assertion in the parity test that every file named in the generator's `KEEP` is also in the test's `HAND_WRITTEN`, and the reverse. It passes today with one entry; it is what fails when a later task adds to one list only. Measured 2026-09-03: that assertion has never been written -- `test/plugin/commands.test.ts` names `HAND_WRITTEN` and does not read `gen-commands.ts` at all -- so it is genuinely still the first step and not a formality. Then the two command files, then `npm test` green: the parity test is the one that proves this landed.

THE HOOK BRANCH IS DECIDED, and it is in scope. Step 3 of the plan's task is conditional on Task 2's outcome, and Task 2 was answered on 2026-08-22 on branch `b16-clear-probe`, recorded in `reports/probes/2026-08-20-clear-and-prompt-hooks.md` §3: a slash command fires TWO events carrying `session_id` -- `UserPromptExpansion`, with `command_name`, `command_args` and `command_source` already parsed, measured as `mycontext:status` / `plugin` against this project's own commands, and then `UserPromptSubmit`, carrying the raw `/name args` as `prompt`, the two sharing one `prompt_id`. Plain typed text fires only the second, which is what makes a slash command distinguishable. Row 1 of the decision table applies.

So the conditional work is real work: register the event in `hooks/hooks.json` with the warning suppressor, add its op to `HOOK_OPS` and `KIND_OF` and its name to the `hook?:` union -- the Task 4 pattern, which `src/core/audit.ts` · `declares op ${JSON.stringify(row.op)}, which is not one of` · ~1023 makes mandatory -- and write the binary.

ONE INSTRUCTION IN THE PLAN IS OVERTAKEN BY THAT MEASUREMENT, and following it would put a false sentence in a docstring. The plan tells step 3's docstring to state that the binary runs on EVERY prompt and that the Global Constraint about the absent in-process bound applies to it. `UserPromptExpansion` is not a hook on every prompt and needs no sentinel line -- Task 2 recorded that correction in the same breath as the answer, and it removes the cost row 1 of the decision table told this task to state.

Commit `commands/`, `scripts/gen-commands.ts` and `test/plugin/commands.test.ts`, plus `hooks/hooks.json`, the new binary and `src/core/audit.ts` when step 3 lands with them.

HISTORY, kept because it explains the shape of the work rather than where it stands. This was filed 2026-08-20 as "BLOCKED on Task 2" and could not be written until the measurement above was taken; it was taken on 2026-08-22, so nothing waits on it now. It was also once recorded as finished when it was not: a verification lane measured on 2026-09-03 that neither command file existed and that the drift guard had never been written, and that is the measurement re-taken above.
