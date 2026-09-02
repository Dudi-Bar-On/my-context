---
id: TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should
type: task
title: "verify:citations must scan the corpus, and the corpus should cite by anchor not by line"
status: active
severity: soft
always: false
summary: The reference checker has three known blind spots; settle by rule what it covers, and stop pointing at line numbers that rot.
summary_of: 9d9cee3922d1935a
scope: []
tags:
  - v2
  - process
  - reconciliation
  - citations
  - "plan:walk"
  - "seq:30"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3dca5b7851067598
plan: walk
seq: "30"
state: done
priority: "1"
source: "plan:walk seq:23, the reconciliation"
---

# verify:citations must scan the corpus, and the corpus should cite by anchor not by line

THE DURABLE FIX for the 104 broken plan pointers corrected on 2026-08-25. Correcting them was necessary and is not the answer: line numbers rot on the next plan edit, and these rotted without anybody doing anything wrong.

TWO PARTS, and the first is worth more than the second.

ONE. `verify:citations` MUST SCAN `.my_context/items/`. The gate exists, it is one of the seven, it already knows this failure mode -- its docblock records 186 file:line citations drifting -- and it has now been found blind to a THIRD location. `plan:rulings seq:48` found it blind to both READMEs (six false claims). This found it blind to the corpus (104 broken pointers). A gate with three known blind spots has a scope problem, not three bugs: settle what it scans BY RULE -- every checked text file in the repository, with exclusions named and justified -- rather than by adding one directory at a time.

THE CORPUS CITATION FORM IS NOT THE GATE S CURRENT FORM. The gate checks `path` + backtick fragment. The corpus writes `path#task-N at line L`. Either teach the gate that form or normalise the corpus to the gate s -- and normalising is better, because one form in one checker is the whole point.

TWO. DECIDE WHETHER THE LINE NUMBER SHOULD BE THERE AT ALL. `verify-citations` states the principle in its own words: THE FRAGMENT IS THE IDENTITY; THE LINE IS A CONVENIENCE. A convenience that was wrong 95% of the time is a trap, because a plausible wrong number sends a reader somewhere real. The `#task-N` anchor resolved 104 times out of 104 -- it is strictly better. Options: drop the line and keep the anchor; keep both and let the gate repair the line mechanically, which it can, since the anchor resolves; or keep both and let the gate merely FAIL. Recommend the second -- a self-repairing citation is the only version that survives a 6,800-line plan being edited.

THE MEASUREMENT SCRIPT IS TRIVIAL and is the acceptance test: for each item saying "this item tracks state only", read its cited plan, find `^##+ Task N`, compare to the cited line. It found 104 in under a second.

AND IT OVERLAPS FOUR OPEN TASKS IN plan:rulings -- `33c` (about thirty bare citations inside fenced code blocks, nearly all stale), `38` (a plan that changes a command breaks the citations in its own survey table), `47` (the citation form has no answer for .html, and six source citations are stale) and `48`. FIVE OPEN TASKS ABOUT ONE GATE. They should be read as one piece of work, not five.

**MEASURED 2026-08-28 — the gate cannot see two whole surfaces**

`verify:citations`'s `SOURCE_ROOTS` are `src`, `test` and `scripts`, and it accepts `.ts` only. So **`src/ui/public/**/*.js` and `e2e/*.spec.ts` are entirely unscanned.** That is the browser modules — every screen, `app.js`, `live-invalidation.js` — and the whole browser suite.

Found by `plan:live seq:7`, whose two edited files were both invisible to the gate; it resolved its citations by hand instead. The irony is worth recording: `live-invalidation.js` exists because a hand-kept list drifts, and its own citations are held to no gate.

Whatever this task settles about scanning the corpus should settle this too, or say why not — a citation gate whose blind spot includes every file a UI change touches is a gate that passes most confidently where it checks least.
