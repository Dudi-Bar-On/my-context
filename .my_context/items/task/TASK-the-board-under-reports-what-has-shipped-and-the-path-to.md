---
id: TASK-the-board-under-reports-what-has-shipped-and-the-path-to
type: task
title: the board under-reports what has shipped, and the path to finishing a D subject is a conversation rather than a reading
status: active
severity: soft
always: false
summary: Work that is finished and committed still shows as open, so the progress table is wrong and there is no single place that says what is left in a subject.
summary_of: d06ea7c20fd54482
scope:
  - src/cli/**
  - src/core/needs.ts
  - scripts/**
  - .my_context/items/reference/**
tags:
  - v2
  - governance
  - silent-failure
  - "plan:rulings"
  - "seq:93"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 73000815ab8c6a3c
plan: rulings
seq: "93"
state: todo
priority: "1"
---

# the board under-reports what has shipped, and the path to finishing a D subject is a conversation rather than a reading

OWNER REQUEST 2026-09-16: "i want you to build a mechanism that will make all of them be dispatched,
progress tracked and 100% completed so i could use it as a reliable path to complete all currently
known opened Ds."

AND THE FIRST THING THE MECHANISM HAS TO FIX IS THAT THE BOARD IS NOT TRUE.

MEASURED 2026-09-16: 23 of 153 open task items are ALREADY NAMED BY A COMMIT since 2026-09-14.
Spot-checked and confirmed on two: `readmodel/1`’s work is in HEAD (`aebc76f0`, and
`src/ui/read-model-base.ts` resolves under `git cat-file`) and the item still reads `state: todo`;
same for `accretion/1`. So `D72` is reported as 0/4 when two of its four have shipped, and every
dispatch decision taken from that table rests on a number that is wrong.

THE CAUSE IS A RETURNED OUTCOME NOBODY READS — this project’s own defect, in its own dispatch loop.
Every lane brief says "close each finished item". Some lanes do it, some do not, and the commit step
verifies the code and the tests and NEVER VERIFIES THE ITEM STATE CHANGED. Nothing between "the lane
said done" and "the board says done" is checked by anything.

── PART 1: RECONCILE, WITH JUDGEMENT AND NOT IN BULK ───────────────────────────

DO NOT CLOSE THE 23 IN A SWEEP. Some are genuinely open and their lane said so — `readmodel/2` and
`/4` were MEASURED AND DELIBERATELY NOT CHANGED, and their lane wrote down why. Some of the 23 are
false positives: a commit that FILED an item names it too (`anchors/13`, `semantic/2`, `review/10`).

For each of the 23: read the commit that names it and the lane report behind it, and decide one of
  — DONE, and close it with the commit named in the closing act;
  — OPEN, because the lane deliberately left it, and record WHAT REMAINS on the item so the next
    reader does not re-derive it;
  — NOT ACTUALLY TOUCHED — the commit only mentioned it.
A wrong close is worse than the present state: it hides work rather than merely under-reporting it.

── PART 2: THE D MAP MUST BE DATA, NOT PROSE ───────────────────────────────

`REF-the-d-numbers-what-each-one-means-and-which-are-only` is the register and it is PROSE. Every
progress table in this campaign has been produced by a regex over it, and MINE GOT TWO ROWS WRONG
on 2026-09-16: `D78` was marked CLOSED because its text quotes D57’s closure, and `D57` was
reported 0/3 because it matched today’s `anchors/` items by name. A path the owner is meant to rely
on cannot rest on a parser that guesses.

The register’s prose is the argument and STAYS. What is needed beside it is a canonical, checkable
mapping of D number to the plan (or plans) it owns, plus a status the register already carries in
words: OPEN, CLOSED, DEFERRED, HELD-BY-OWNER, NOT-FILED-AGAINST-A-PLAN. Where it lives is the
lane’s call — a structured block in the item, a separate reference item, a generated file — but two
properties are not negotiable:
  — EVERY D ROW PARSES, or a gate fails and names the row. A silently unparsed row is how a subject
    disappears from the board.
  — EVERY PLAN IT NAMES EXISTS, and every plan with items belongs to at most one D or is explicitly
    recorded as belonging to none.

── PART 3: THE PATH ITSELF ────────────────────────────────────────

A reading that answers, per D, in one place: how many done of how many; which items are READY now;
which are blocked by a `needs:` that has not landed; and — the category `mycontext ready` cannot
see — WHICH ARE WAITING ON THE OWNER.

That last one is the difference between a list and a path. Three are waiting on him right now and
no command can tell him: D67 is HELD BY HIS OWN RULING (the instrument was wrong more often than
the paint); `semantic/1` ends in a decision about whether search may rank and whether a model is
worth a dependency; `anchors/12` leaves him the table-versus-report precedence. A mechanism that
reports those as "open work" will keep offering him work he has already decided to defer.

`mycontext ready` is the precedent and the constraint: it is DERIVED ON EVERY RUN from `needs:` and
state, it is stored nowhere, and it cannot go stale. This must be the same. A file that records
progress is a second place for a fact to be wrong — the defect this product exists to prevent.

── PART 4: THE GATE THAT KEEPS IT TRUE ───────────────────────────────

Without this the other three decay in a week. The drift is cheap to detect: A COMMIT NAMES AN ITEM
ADDRESS OR ID AND THAT ITEM IS STILL OPEN. That is not always wrong — a filing commit names its own
item, and a partial landing is legitimate — so the gate REPORTS rather than refuses, in the shape
`check:handover` and `check:cited-items` already use: a named list with a reason column, and a way
to record "yes, deliberately".

AND IT MUST BE RUN BY SOMETHING. `gates/3`’s whole finding was seven gates that could not be shown
to go red and four in no workflow at all: a checker nobody invokes is a script, not a gate. Wire it
where the others are wired and prove the wiring, not just the checker.

── WHAT 100% CAN AND CANNOT MEAN ──────────────────────────────────

He asked for a reliable path to 100%, and the honest version of that is a path where EVERY REMAINING
STEP IS EITHER DISPATCHABLE OR NAMED AS HIS. It is not a promise that every D closes: one is held by
his own ruling and two end in decisions only he can make. A mechanism that hid that distinction
would be telling him what he wants to hear, and he has said repeatedly that he wants the opposite.
