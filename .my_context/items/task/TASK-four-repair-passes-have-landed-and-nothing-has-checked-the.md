---
id: TASK-four-repair-passes-have-landed-and-nothing-has-checked-the
type: task
title: four repair passes have landed and nothing has checked the documents as a whole since
status: active
severity: soft
always: false
summary: One final verification across both document sets, read-only, and the last one before the gates hold the line.
summary_of: bcadb0db5514fe7d
scope:
  - docs/capabilities/**
  - docs/system/**
  - README.md
  - docs/README.he.md
  - reports/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:110"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 2b695c0636213d76
plan: rulings
seq: "110"
state: todo
priority: "1"
---

# four repair passes have landed and nothing has checked the documents as a whole since

**THIS IS THE LAST VERIFICATION PASS OF THE CAMPAIGN AND IT SHOULD BE TREATED AS SUCH.** The owner,
2026-09-17: *"work sequentially until you close all the documentation actions... i do not want to
continue mess with this"*, and *"must end asap"*.

── WHY ONE MORE, AND WHY ONLY ONE ──────────────────────────

Measured, three times, on this repository: repairing 38 false claims produced 21 new findings;
repairing 28 produced 15; repairing 21 produced 15. **The rate was not falling, because a repair
pass is a writing pass and the fix is unverified text.**

What changed is the discipline: the last passes checked every sentence against code AS THEY WROTE
IT, and one of them disproved a claim in its own draft that had survived four verification passes.
**So this pass is asking a different question from its predecessors: not "is the repair correct"
but "did the discipline hold".** Sample hard, and if it did, STOP. If it did not, say so plainly
and the owner decides whether to spend another round.

── SPLIT IT, IT DOES NOT SERIALISE ─────────────────────────

Two read-only lanes — `docs/capabilities/**` and `docs/system/**` — sharing nothing. README and the
Hebrew README are read by both and written by neither.

── WHERE TO LOOK, RANKED BY WHAT ACTUALLY WENT WRONG ──────────────

1. **RELATIONSHIPS, NOT VALUES.** Every worst finding of this campaign was a direction read
   backwards — a guard claimed to run before the line that runs first, an "avoids" the code calls
   "sets", an "every" that is an "any", a false edge, and an edge LABEL carrying an inverted
   quantifier inside a diagram a verifier had just scored clean. **A line citation cannot see any
   of these.** Check the direction in the code.
2. **SENTENCES ADDED BY THE REPAIRS**, which is where all 15 of the capability findings lived.
3. **PASTED OUTPUT** — run the command, diff the whole thing. 10 abridged and 5 doctored were found
   in one sweep.
4. **VOLATILE FIGURES**: a count is a DATE. Undated moving numbers are findings.
5. **CITED IDS** against `.my_context/items/`.

── THE TWO THINGS THAT SHOULD HOLD THE LINE AFTERWARDS ────────────

`npm run check:diagrams` (38 fences, ~2 s, runs its own RED proof before every green report) and
`test/docs/*.test.ts` (112 pass). **Say in your report whether those two are enough to keep these
documents true, and name what they cannot see.** That judgement is the deliverable that lets this
campaign end — a gate nobody can describe the blind spots of is a gate nobody should trust.

READ-ONLY. CHANGE NO DOCUMENT; your report is the exception. RUN NO GIT COMMAND THAT CHANGES
REPOSITORY STATE. The server on 58888 is the owner’s.

REPORT the number of claims CHECKED, not only those found false — a denominator is what makes the
numerator mean anything — and say which chapters you swept and which you did not.
