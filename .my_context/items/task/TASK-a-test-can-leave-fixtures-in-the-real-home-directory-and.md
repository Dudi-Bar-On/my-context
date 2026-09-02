---
id: TASK-a-test-can-leave-fixtures-in-the-real-home-directory-and
type: task
title: a test can leave fixtures in the real home directory and turn 134 tests red
status: active
severity: soft
always: false
summary: Leftover files in a developer's home folder can fail over a hundred unrelated tests with a message that points nowhere near the real cause.
summary_of: d0d2c071c61a6213
scope: []
tags:
  - "plan:port"
  - "seq:13"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: 0f667313e1eec408
valid_from: 2026-08-23
valid_until: null
checksum: 3b9ac9ab91d5ee57
plan: port
seq: "13"
state: done
---

# a test can leave fixtures in the real home directory and turn 134 tests red

> Two stray files in the developer's REAL home directory made 134 unrelated tests
> fail, with a message that points nowhere near the cause.
>
> Measured 2026-08-23. `~/.my-context/items/constraint/CONST-global-one.md` and
> `CONST-global-two.md` were present, created that day. They are fixtures belonging
> to `test/cli/edit-global-layer.test.ts` and `supersede-global-layer.test.ts`,
> which redirect HOME and USERPROFILE to a temp directory before importing the module
> that resolves `GLOBAL_DIR`, and clean up in `test.after`. Under a normal
> `npm test` that works, and a full run afterwards left the home directory clean —
> so the leak came from an interrupted or differently-invoked run, of which there
> were many that day while fourteen agents worked concurrently.
>
> The damage is out of all proportion to the cause. Every sandboxed test that asserts
> "nothing was created" sees the global-layer items, and reports
> `no item may be created by a refused invocation` with a diff full of an item the
> test never heard of. Nothing names the home directory. Diagnosing it takes a long
> time precisely because the message is confident and wrong.
>
> What is missing is a guard, not a fix to those two files: something that fails
> loudly and early when the suite is about to read a global corpus it did not create.
> A check that `GLOBAL_DIR` is empty or absent at suite start, naming the path and
> the two tests that write there, would turn a day's confusion into one line.
