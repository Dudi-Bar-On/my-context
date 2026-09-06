---
id: TASK-the-composer-has-two-run-buttons-and-they-disagree-about
type: task
title: the composer has two run buttons and they disagree about what a command means
status: active
severity: soft
always: false
summary: Two ways of running the same composed command on one screen return different answers.
summary_of: c94836ee164b6838
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 442a820e137f3395
plan: builder
seq: "15"
state: todo
priority: "2"
---

# the composer has two run buttons and they disagree about what a command means

Found 2026-09-06 by the D20/D21 lane while proving the owner’s own acceptance case, and NOT
absorbed into that task on purpose - it is a different defect that happened to be underneath it.

MEASURED. Composing `mycontext list rule` in the Composer and pressing RUN calls
`endpoint: () => ‘/api/items’`, which ignores `values.category` entirely - and `apiItems` accepts
no query parameters at all (`unknownParams(url, [])`), so there is nowhere for the category to go
even if it were passed. The screen answers 965 rows of every type, captioned "965 rows", beneath a
composed line that says `mycontext list rule`.

The EXECUTE path - the real CLI - correctly returns 56 rules.

SO THE SCREEN DISAGREES WITH ITSELF, and that is worse than either answer being wrong alone. A
reader who presses Run is shown a result that does not match the command written directly above it,
and nothing on the screen says the two buttons mean different things.

WHY THIS MATTERS BEYOND ONE FLAG. The owner’s standing bar for the Composer is that "a test passes
only after execute and run it returns correct results". Run is one of the two things that sentence
names, and for at least one entry it returns a correct-LOOKING result for a different question.
D12 (`builder/11`) is the exhaustive test of this surface and has never been dispatched; this is a
sample of what it would find, discovered by accident rather than by the plan.

TWO SHAPES, and the choice is a ruling rather than a fix: `/api/items` grows the query parameters
the composed command implies, or Run refuses for any entry whose composed flags it cannot honour.
The second is smaller and more honest; the first is what a reader expects. Neither should be chosen
by whoever happens to be in the file.

ALSO FOUND IN THE SAME PASS, unrelated and much smaller: the glob tester’s own header says the
endpoint caps at 200 files (`GLOB_SAMPLE_CAP = 200`), and this repo measured 1,298 of 1,298 with
every row drawn. A comment that is wrong about a cap is the kind of stale claim this project
measures in days.
