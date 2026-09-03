---
description: Show which tasks in this project can be started right now
argument-hint: "[--plan <plan>] [--held] [--limit <n>] [--full|--short|--summary] [--json]"
disable-model-invocation: true
---

Show the open work in this project whose dependencies have all landed.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" ready $ARGUMENTS`

Print the table and the note that follows it as they are printed. `--plan <plan>` narrows
it to one plan, `--held` also lists the work that is NOT ready and why, `--limit <n>`
raises the row cap. Held work is counted by reason on every level, so the count is there
even when the list is not.

**Readiness is derived on every run, and stored nowhere.** It is each task's `needs` plus
the `state` of what those needs name, computed when the command runs. There is no `ready`
state on an item and there must not be one — it would be a second copy of a fact, and the
two disagree the first time one is updated alone. So do not write this answer down anywhere
as if it were a field, and do not carry a row from an earlier run: re-run the command.

**A task with no `needs` is listed because nothing in the corpus says otherwise.** That is
a statement about the corpus, not a promise about the work — a dependency someone only ever
wrote in prose is invisible here. If you can see such a dependency, say so and let the user
record it with `/mycontext:edit`; `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" doctor` reports the blocked tasks that name
nothing.

This command reads. It changes no state, and starting a task is still the user's act — do
not set anything to `doing` off the back of this list.
