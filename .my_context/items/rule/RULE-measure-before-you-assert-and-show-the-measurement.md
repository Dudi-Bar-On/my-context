---
id: RULE-measure-before-you-assert-and-show-the-measurement
type: rule
title: Measure before you assert, and show the measurement
status: active
severity: hard
always: false
summary: "Do not invent facts: check a claim about the code before you make it, show the actual output you got, and say plainly when something is unverified."
summary_of: 896e476b664e50d4
scope: []
tags:
  - v2
  - method
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: aa02b560b33aace1
---

# Measure before you assert, and show the measurement

Owner instruction, 2026-08-23, in two words: do not invent facts.

A claim about this codebase is made only after measuring it, and the measurement is shown. Not a recollection, not an inference from a grep whose scope was never checked, not a reasonable expectation.

DO

Run the thing and paste the number. Element counts, pixel heights, HTTP statuses, record counts, computed styles - the output, not a summary of it.
Widen the scope before trusting a search. Count the files first: find src/ui/public -name '*.js' | wc -l said 21 where a grep had covered 8, and all nine of the calls being denied lived in the thirteen it missed.
Prefer the product's own evidence when it exists. The server records every refusal with the CHECK that caused it, and that log named the real cause after three browser theories had failed.
Say measured or say unverified. Both are useful; a confident guess is not.
When a measurement contradicts an earlier claim, correct the claim in the same message, plainly, and move on.

DO NOT

Do not report a grep as an inventory. An incomplete search returns a confident answer in exactly the shape of a complete one, with no signal that the tree was half walked. Four wrong answers in two days came from this alone.
Do not match on a bare substring and call it a usage. pairing and repair both contain pair, and reporting that coverage.js and doctor.js used .pair sent a whole investigation the wrong way.
Do not read a screenshot approvingly. Look for what is wrong in it, name it, and if nothing is wrong say what you checked.
Do not pipe a gate through tail and then echo OK: the exit code becomes tail's. That printed TYPECHECK OK over a failing compile.
Do not let a claim stand because the next run happened to be green. One node test failed once in three runs and was not identified; it is filed rather than forgotten.

WHY THIS IS HARD SEVERITY

A wrong measurement is worse than no measurement, because it forecloses the question. The next agent reads the claim and does not re-check it. See [[LESSON-every-wrong-answer-i-gave-came-from-a-partial-measurement]].
