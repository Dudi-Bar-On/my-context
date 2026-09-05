---
id: TASK-the-shipped-pack-import-outcome-points-at-a-command-that
type: task
title: the shipped pack import outcome points at a command that does not exist until task 16
status: active
severity: soft
always: false
summary: A command tells you to run something the very same version would refuse, and prints it broken across two lines.
summary_of: 4c813538d312dd22
scope: []
tags:
  - "plan:export"
  - "seq:14o"
  - "state:doing"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 3e2e49631e69b58e
plan: export
seq: 14o
state: doing
priority: "2"
---

# the shipped pack import outcome points at a command that does not exist until task 16

mycontext pack import prints 'mycontext review promote --all --pack <name>' as the next step. That command lands in task 16. Today the shipped build prints it and would refuse it.

Deliberate per the plan, and the plan is the authority - recording it because between now and task 16 it is live text in a shipped command telling a user to run something that does not exist.

Second, smaller: at 100 columns paragraph() wraps that command across two lines, so the thing a user is meant to copy is broken in half. If it is meant to be copyable it wants its own line, the way the prefix ruling handled the same problem in the UI.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is a two-line fix that has been shipping a lie for days: `mycontext pack import` prints "mycontext review promote --all --pack <name>" as the next step, that command lands in task 16, and the shipped build would REFUSE it. A next-step instruction that the same build rejects is worse than no instruction. Either land task 16 or change the printed sentence -- and if the sentence changes, note that plan:ui2 seq:10p deliberately does NOT offer `review promote --all --pack` in the palette, on the approval boundary. The CLI printing it while the palette refuses it is a coherent position, but it should be a stated one.

**RE-VERDICT REQUIRED, 2026-08-29 — half of this is stale and half is still live**

Measured by `plan:export seq:14n` while fixing the collision beside it.

* **"points at a command that does not exist until task 16" — STALE.** Task 16 is `state: done`; `review promote --all --pack` is implemented and tested. That half of this item describes a world that no longer exists and should be struck rather than worked.
* **The WRAP is still live, and was measured**: at 100 columns the import outcome sentence still breaks `` `mycontext review promote --all --pack acme-security` `` across two lines. A command a reader is meant to copy, broken by wrapping, is not copyable.

`seq:14n` deliberately did NOT restructure that sentence — it is this item's own subject and its own priority-2 decision, with a stated tie to `plan:ui2 seq:10p`'s palette boundary. It only ensured the NEW command it introduced (`--source`) is emitted unwrapped on its own line, so it did not add a fourth instance of the defect while fixing a different one.

**Why they were not landed together**, and the reasoning is worth keeping: this is a rendering ruling about copyable commands; `14n` was a data-integrity fix. Landing them together would have coupled a priority-1 correctness change to a priority-2 typography decision, and the correctness change would have waited on the ruling.

**Done when**: the stale half is struck with a note saying why; the wrap is settled as a rendering ruling — probably "a command a reader may copy is emitted on its own line, never inside flowing prose" — and applied wherever the codebase emits one.
