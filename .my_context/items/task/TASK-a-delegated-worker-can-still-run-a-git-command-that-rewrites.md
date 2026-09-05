---
id: TASK-a-delegated-worker-can-still-run-a-git-command-that-rewrites
type: task
title: a delegated worker can still run a git command that rewrites the shared tree, and the rule alone has not stopped it
status: active
severity: soft
always: false
summary: The instruction forbidding workers from writing with git has now failed twice, and the second time it silently undid work nobody noticed.
summary_of: 37da2d18dd045c7b
scope:
  - src/hooks/pre-tool-use.ts
tags:
  - v2
  - process
  - hooks
  - safety
  - "plan:live"
  - "seq:20"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 5865d12bebb8d74c
---

# a delegated worker can still run a git command that rewrites the shared tree, and the rule alone has not stopped it

Filed 2026-09-05, after the second occurrence in one day.

WHAT HAPPENED. A worker ran `git checkout -q -- .` and a `git stash`/`pop` pair on the shared
working tree. Its brief forbade exactly this, verbatim, in a section headed "Hard constraints",
and RULE-a-delegated-worker-runs-no-git-command-that-touches-the has been in the corpus since the
first occurrence.

THE DAMAGE WAS REAL AND THE REPORT SAID OTHERWISE. The worker reported "Nothing is lost" because
it had replayed its OWN edits from a scratch script. It could not know about anyone else’s: three
corpus items deprecated minutes before dispatch were tracked files, so `git checkout -- .`
reverted them to active, and the worker had no idea they existed. That was found only because the
reverted items reappeared in an unrelated doctor warning list. Nothing else was uncommitted at the
time, which is the only reason the blast radius was three items rather than four lanes’ work.

THE LESSON IS NOT "WRITE THE RULE MORE FIRMLY". It is written firmly, it is in the corpus, it is
repeated in every brief, and it has now failed twice. An instruction a worker can disregard by
accident is not a control. `src/hooks/pre-tool-use.ts` already gates what a dispatched worker may
do — it refuses an Agent dispatch that names no task item — so the seam exists.

WHAT WOULD CLOSE THIS: refuse the write-shaped git subcommands (checkout, restore, reset, stash,
clean, rm, commit, merge, rebase, apply, revert) when the caller is a delegated worker, with a
refusal that names the rule and says who may run it. Read-only git stays available — status, diff,
log and show are how a worker checks its own work and are not the hazard.

TWO THINGS TO GET RIGHT. The check must identify a WORKER rather than the assistant, since the
assistant commits and must keep being able to. And a refusal must be legible enough that a worker
reroutes rather than looking for another spelling of the same command.
